import ExternalAPI from '@server/api/externalapi';
import { ApiErrorCode } from '@server/constants/error';
import type { DubbySettings } from '@server/lib/settings';
import { ApiError } from '@server/types/error';
import logger from '@server/logger';

export const getDubbyUrl = (dubby: DubbySettings): string => {
  return `${dubby.useSsl ? 'https' : 'http'}://${dubby.hostname}:${dubby.port}${dubby.urlBase || ''}`;
};

export interface DubbySystemInfo {
  id: string;
  name: string;
  version: string;
  type: 'dubby';
}

export interface DubbyLibrary {
  id: string;
  name: string;
  type: 'movie' | 'tv';
  enabled: boolean;
  itemCount: number;
}

export interface DubbySeasonSummary {
  seasonNumber: number;
  episodeCount: number;
}

export interface DubbyLibraryItem {
  id: string;
  title: string;
  year: number | null;
  tmdbId: number | null;
  imdbId: string | null;
  tvdbId: number | null;
  resolution: string | null;
  addedAt: string;
  seasons?: DubbySeasonSummary[];
}

export interface DubbyItemDetails extends DubbyLibraryItem {
  overview: string | null;
  posterPath: string | null;
  backdropPath: string | null;
  mediaType: 'movie' | 'tv';
  episodes?: {
    seasonNumber: number;
    episodeNumber: number;
    title: string | null;
    addedAt: string;
  }[];
}

export interface SeasonAvailability {
  seasonNumber: number;
  available: boolean;
  episodesAvailable: number;
  episodesTotal: number;
}

export interface AvailabilityCheckResponse {
  available: boolean;
  available4k: boolean;
  dubbyId: string | null;
  dubbyId4k: string | null;
  seasons?: SeasonAvailability[];
}

export interface DubbyRecentItem {
  id: string;
  title: string;
  year: number | null;
  tmdbId: number | null;
  mediaType: 'movie' | 'tv';
  addedAt: string;
}

export interface DubbyRegistrationResponse {
  id: string;
  dubbyApiKey: string;
  webhookSecret: string;
  webhookUrl: string;
}

class DubbyAPI extends ExternalAPI {
  constructor(dubbyUrl: string, apiKey: string) {
    super(dubbyUrl, {}, {
      headers: {
        'X-Dubby-Token': apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    });
  }

  public async getSystemInfo(): Promise<DubbySystemInfo> {
    try {
      return await this.get<DubbySystemInfo>('/api/seerr/system/info');
    } catch (e) {
      logger.error('Failed to get Dubby system info', {
        label: 'DubbyAPI',
        errorMessage: e.message,
        status: e.response?.status,
      });
      throw new ApiError(e.response?.status, ApiErrorCode.InvalidUrl);
    }
  }

  public async getLibraries(): Promise<DubbyLibrary[]> {
    try {
      return await this.get<DubbyLibrary[]>('/api/seerr/libraries');
    } catch (e) {
      logger.error('Failed to get Dubby libraries', {
        label: 'DubbyAPI',
        errorMessage: e.message,
        status: e.response?.status,
      });
      throw new ApiError(e.response?.status, ApiErrorCode.Unknown);
    }
  }

  public async getLibraryItems(
    libraryId: string,
    offset = 0,
    limit = 500
  ): Promise<DubbyLibraryItem[]> {
    try {
      return await this.get<DubbyLibraryItem[]>(
        `/api/seerr/libraries/${encodeURIComponent(libraryId)}/items`,
        { params: { offset, limit } }
      );
    } catch (e) {
      logger.error('Failed to get Dubby library items', {
        label: 'DubbyAPI',
        errorMessage: e.message,
        status: e.response?.status,
      });
      throw new ApiError(e.response?.status, ApiErrorCode.Unknown);
    }
  }

  public async checkAvailability(
    tmdbId: number,
    mediaType: 'movie' | 'tv'
  ): Promise<AvailabilityCheckResponse> {
    try {
      return await this.post<AvailabilityCheckResponse>(
        '/api/seerr/availability/check',
        { tmdbId, mediaType }
      );
    } catch (e) {
      logger.error('Failed to check Dubby availability', {
        label: 'DubbyAPI',
        errorMessage: e.message,
        status: e.response?.status,
      });
      throw new ApiError(e.response?.status, ApiErrorCode.Unknown);
    }
  }

  public async getRecentlyAdded(limit = 20): Promise<DubbyRecentItem[]> {
    try {
      return await this.get<DubbyRecentItem[]>('/api/seerr/recent', {
        params: { limit },
      });
    } catch (e) {
      logger.error('Failed to get Dubby recently added', {
        label: 'DubbyAPI',
        errorMessage: e.message,
        status: e.response?.status,
      });
      throw new ApiError(e.response?.status, ApiErrorCode.Unknown);
    }
  }

  public async getItemDetails(id: string): Promise<DubbyItemDetails> {
    try {
      return await this.get<DubbyItemDetails>(
        `/api/seerr/items/${encodeURIComponent(id)}`
      );
    } catch (e) {
      logger.error('Failed to get Dubby item details', {
        label: 'DubbyAPI',
        errorMessage: e.message,
        status: e.response?.status,
      });
      throw new ApiError(e.response?.status, ApiErrorCode.Unknown);
    }
  }

  public async registerInstance(
    name: string,
    baseUrl?: string
  ): Promise<DubbyRegistrationResponse> {
    try {
      return await this.post<DubbyRegistrationResponse>(
        '/api/seerr/register',
        { name, baseUrl }
      );
    } catch (e) {
      logger.error('Failed to register Dubby instance', {
        label: 'DubbyAPI',
        errorMessage: e.message,
        status: e.response?.status,
      });
      throw new ApiError(e.response?.status, ApiErrorCode.Unknown);
    }
  }
}

export default DubbyAPI;
