// Shapes returned by the local /api server (see server/ytm.ts).

export interface ArtistRef {
  name: string;
  id?: string;
}

export interface Track {
  kind: 'song' | 'video';
  id: string;
  title: string;
  artists: ArtistRef[];
  album?: { name: string; id?: string };
  duration?: number;
  thumbnail?: string;
  views?: string;
}

export interface Collection {
  kind: 'album' | 'playlist' | 'artist';
  id: string;
  title: string;
  subtitle?: string;
  thumbnail?: string;
  year?: string;
}

export type Item = Track | Collection;

export interface Section {
  title: string;
  subtitle?: string;
  items: Item[];
}

export interface HomeData {
  moods: string[];
  sections: Section[];
}

export interface SearchData {
  top: Item | null;
  items: Item[];
}

export interface AlbumData {
  id: string;
  title: string;
  type: string;
  artists: ArtistRef[];
  year?: string;
  meta?: string;
  description?: string;
  thumbnail?: string;
  playlistId?: string;
  tracks: Track[];
  sections: Section[];
}

export interface PlaylistData {
  id: string;
  title: string;
  subtitle?: string;
  author?: string;
  meta?: string;
  description?: string;
  thumbnail?: string;
  tracks: Track[];
  sections: Section[];
}

export interface ArtistData {
  id: string;
  name: string;
  description?: string;
  subscribers?: string;
  banner?: string;
  avatar?: string;
  songs: Track[];
  sections: Section[];
}

export interface LyricLine {
  t: number;
  text: string;
}

export interface LyricsData {
  synced: LyricLine[] | null;
  plain: string | null;
  source: string | null;
}

export interface RelatedData {
  sections: Section[];
  about: string | null;
}

export interface RecommendData {
  quickPicks: Track[];
  artists: Item[];
  playlists: Item[];
  because: { seed: string; items: Item[] }[];
}

/** Where the current queue came from; shown as "Playing from …". */
export interface QueueSource {
  kind: 'album' | 'playlist' | 'artist' | 'radio' | 'search' | 'liked' | 'local' | 'history' | 'mix' | 'home';
  id?: string;
  title: string;
  thumbnail?: string;
}

export const isTrack = (i: Item | null | undefined): i is Track => !!i && (i.kind === 'song' || i.kind === 'video');
