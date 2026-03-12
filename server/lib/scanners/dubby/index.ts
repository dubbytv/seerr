import DubbyAPI from '@server/api/dubbyApi';
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

    this.running = true;
    this.progress = 0;

    const { dubby } = settings;
    const baseUrl = `${dubby.useSsl ? 'https' : 'http'}://${dubby.hostname}:${dubby.port}${dubby.urlBase || ''}`;

    this.dubbyApi = new DubbyAPI(baseUrl, dubby.apiKey);
    this.libraries = dubby.libraries.filter((lib) => lib.enabled);

    if (this.libraries.length === 0) {
      this.log('No enabled Dubby libraries. Skipping.', 'info');
      this.running = false;
      return;
    }

    try {
      for (const library of this.libraries) {
        this.currentLibrary = library;
        this.log(`Processing library: ${library.name}`, 'info');

        if (this.isRecentOnly) {
          const recentItems = await this.dubbyApi.getRecentlyAdded(50);

          for (const item of recentItems) {
            if (item.mediaType === 'movie') {
              await this.processDubbyMovie({
                ...item,
                imdbId: null,
                tvdbId: null,
                resolution: null,
                seasons: undefined,
              });
            } else {
              await this.processDubbyShow({
                ...item,
                imdbId: null,
                tvdbId: null,
                resolution: null,
                seasons: undefined,
              });
            }
          }
        } else {
          // Full scan: paginate through library items
          let offset = 0;
          const pageSize = 500;
          let hasMore = true;

          while (hasMore) {
            const items = await this.dubbyApi.getLibraryItems(
              library.id,
              offset,
              pageSize
            );

            for (const item of items) {
              if (library.type === 'show') {
                await this.processDubbyShow(item);
              } else {
                await this.processDubbyMovie(item);
              }
            }

            offset += items.length;
            hasMore = items.length === pageSize;
          }
        }
      }

      this.log('Dubby scan complete', 'info');
    } catch (e) {
      this.log(`Dubby scan failed: ${e.message}`, 'error');
    } finally {
      this.running = false;
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

  public cancel(): void {
    this.running = false;
  }
}

export const dubbyFullScanner = new DubbyScanner();
export const dubbyRecentScanner = new DubbyScanner({ isRecentOnly: true });
