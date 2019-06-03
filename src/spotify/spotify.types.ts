export interface ILimitedResult<T> {
  href: string;
  items: T[];
  next: string;
  offset: number;
  previous: string;
  total: number;
  limit: number;
}

/**
 * provider: Identifier like 'spotify'
 */
export type ExternalIds = { [provider: string]: string; }
export type ExternalUrls = { [provider: string]: string; }

export interface IUser {
}

export interface IImage {
  width: number;
  height: number;
  url: string;
}

export type AlbumType = 'album' | 'single'; // ToDo
export type ReleaseDatePrecision = 'day' | 'year';

export interface IArtist {
  name: string;
  uri: string;
  images?: IImage[];
  image?: string; // Used locally to store selected image
}

export interface IAlbum {
  id: string;
  name: string;
  images?: IImage[];
  album_type: AlbumType;
  artists: IArtist[];
  available_markets: string[];
  external_ids: ExternalIds;
  external_urls: ExternalUrls;
  release_date: string;
  release_date_precision: ReleaseDatePrecision;
  type: AlbumType;
  total_tracks: number;
  uri: string;
  image?: string; // Used locally to store selected image
  tracks?: ILimitedResult<ITrack>;
}

export interface ITrack {
  id: string;
  album: IAlbum;
  artists: IArtist[];
  available_markets: string[];
  disc_number: number;
  duration_ms: number;
  explicit: boolean;
  external_ids: ExternalIds;
  external_urls: ExternalUrls;
  href: string;
  is_local: boolean;
  name: string;
  popularity: 35,
  preview_url: string;
  track_number: 3,
  type: 'track';
  uri: string;
}

export interface IPlaylist {
  external_urls: { [provider: string]: string };
  tracks?: ILimitedResult<ITrack>;
  owner: IUser;
}

export interface ITracksResult {
  tracks?: ILimitedResult<ITrack>;
}

export interface IAlbumResult {
  tracks?: ILimitedResult<IAlbum>;
}