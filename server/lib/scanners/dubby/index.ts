import DubbyAPI, { getDubbyUrl } from '@server/api/dubbyApi';
import type { DubbyLibraryItem } from '@server/api/dubbyApi';
import { MediaServerType } from '@server/constants/server';
import type {
  ProcessableSeason,
  RunnableScanner,
  StatusBase,
} from '@server/lib/scanners/baseScanner';
import BaseScanner from '@server/lib/scanners/baseScanner';
import type { Library } from '@server/lib/settings';
import { getSettings } from '@server/lib/settings';
import { uniqWith } from 'lodash';

interface DubbySyncStatus extends StatusBase {
  currentLibrary: Library;
  libraries: Library[];
}

class DubbyScanner
  extends BaseScanner<DubbyLibraryItem>
  implements RunnableScanner<DubbySyncStatus>
{
  private dubbyApi: DubbyAPI;
  private libraries: Library[];
  private currentLibrary: Library;
  private isRecentOnly = false;

  constructor({ isRecentOnly }: { isRecentOnly?: boolean } = {}) {
    super('Dubby Sync');
    this.isRecentOnly = isRecentOnly ?? false;
  }

  public status(): DubbySyncStatus {
    return {
      running: this.running,
      progress: this.progress,
      total: this.totalSize ?? 0,
      currentLibrary: this.currentLibrary,
      libraries: this.libraries,
    };
  }

  public async run(): Promise<void> {
    const settings = getSettings();

    if (settings.main.mediaServerType !== MediaServerType.DUBBY) {
      this.log('Dubby is not configured as the media server. Skipping.', 'info');
      return;
    }

    if (this.running) {
      this.log('Dubby scan already running. Skipping.', 'info');
      return;
    }

    const sessionId = this.startRun();

    const { dubby } = settings;
    this.dubbyApi = new DubbyAPI(getDubbyUrl(dubby), dubby.apiKey);
    this.libraries = dubby.libraries.filter((lib) => lib.enabled);

    if (this.libraries.length === 0) {
      this.log('No enabled Dubby libraries. Skipping.', 'info');
      this.endRun(sessionId);
      return;
    }

    try {
      if (this.isRecentOnly) {
        // Fetch recent items once (global), deduplicate, then process
        const recentItems = await this.dubbyApi.getRecentlyAdded(50);

        // Fetch full details for each recent item to get resolution/seasons
        const fullItems: DubbyLibraryItem[] = [];
        for (const item of recentItems) {
          try {
            const details = await this.dubbyApi.getItemDetails(item.id);
            fullItems.push({
              id: details.id,
              title: details.title,
              year: details.year,
              tmdbId: details.tmdbId,
              imdbId: details.imdbId ?? null,
              tvdbId: details.tvdbId ?? null,
              resolution: details.resolution ?? null,
              addedAt: details.addedAt,
              seasons: details.seasons,
            } as DubbyLibraryItem);
          } catch (e) {
            this.log(
              `Failed to fetch details for recent item ${item.id}`,
              'error',
              { errorMessage: e instanceof Error ? e.message : String(e) }
            );
          }
        }

        // Deduplicate by id
        this.items = uniqWith(fullItems, (a, b) => a.id === b.id);
        this.totalSize = this.items.length;

        await this.loop(this.processItem.bind(this), { sessionId });
      } else {
        for (const library of this.libraries) {
          this.currentLibrary = library;
          this.log(`Processing library: ${library.name}`, 'info');

          // Paginate through all items and collect
          this.items = [];
          let offset = 0;
          const pageSize = 500;
          let hasMore = true;

          while (hasMore) {
            const items = await this.dubbyApi.getLibraryItems(
              library.id,
              offset,
              pageSize
            );

            this.items.push(...items);
            offset += items.length;
            hasMore = items.length === pageSize;
          }

          this.totalSize = this.items.length;
          await this.loop(this.processItem.bind(this), { sessionId });
        }
      }

      this.log(
        this.isRecentOnly
          ? 'Recently Added Scan Complete'
          : 'Full Scan Complete',
        'info'
      );
    } catch (e) {
      this.log(
        `Dubby scan failed: ${e instanceof Error ? e.message : String(e)}`,
        'error'
      );
    } finally {
      this.endRun(sessionId);
    }
  }

  private async processItem(item: DubbyLibraryItem): Promise<void> {
    try {
      if (!item.tmdbId) return;

      // Determine type from item seasons presence or library type
      const isShow = item.seasons && item.seasons.length > 0;

      if (isShow) {
        await this.processDubbyShow(item);
      } else {
        await this.processDubbyMovie(item);
      }
    } catch (e) {
      this.log(
        `Failed to process Dubby item ${item.id} (${item.title})`,
        'error',
        { errorMessage: e instanceof Error ? e.message : String(e) }
      );
    }
  }

  private async processDubbyMovie(item: DubbyLibraryItem): Promise<void> {
    if (!item.tmdbId) return;

    const is4k = item.resolution
      ? item.resolution.includes('2160') ||
        item.resolution.toLowerCase().includes('4k')
      : false;

    await this.processMovie(item.tmdbId, {
      is4k,
      mediaAddedAt: new Date(item.addedAt),
      dubbyMediaId: item.id,
      imdbId: item.imdbId ?? undefined,
      title: item.title,
    });
  }

  private async processDubbyShow(item: DubbyLibraryItem): Promise<void> {
    if (!item.tmdbId) return;

    const tvdbId = item.tvdbId ?? undefined;

    const processableSeasons: ProcessableSeason[] = (item.seasons ?? []).map(
      (s) => ({
        seasonNumber: s.seasonNumber,
        totalEpisodes: s.episodeCount,
        episodes: s.episodeCount,
        episodes4k: 0,
      })
    );

    await this.processShow(item.tmdbId, tvdbId, processableSeasons, {
      mediaAddedAt: new Date(item.addedAt),
      dubbyMediaId: item.id,
      title: item.title,
    });
  }
}

export const dubbyFullScanner = new DubbyScanner();
export const dubbyRecentScanner = new DubbyScanner({ isRecentOnly: true });
