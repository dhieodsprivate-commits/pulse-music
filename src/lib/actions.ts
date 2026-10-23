import { api } from './api';
import type { AlbumData, ArtistData, Collection, Item, PlaylistData, QueueSource, Track } from './types';
import { isTrack } from './types';
import { usePlayer } from '../store/player';
import { toast } from '../store/ui';

/** Resolves any item to the tracks it represents (album/playlist/artist top songs). */
export async function resolveTracks(item: Item): Promise<{ tracks: Track[]; source: QueueSource }> {
  if (isTrack(item)) return { tracks: [item], source: { kind: 'radio', id: item.id, title: `${item.title} Radio`, thumbnail: item.thumbnail } };
  const c = item as Collection;
  if (c.kind === 'album') {
    const a = await api<AlbumData>(`/album/${c.id}`);
    return { tracks: a.tracks, source: { kind: 'album', id: c.id, title: a.title, thumbnail: a.thumbnail ?? c.thumbnail } };
  }
  if (c.kind === 'playlist') {
    const p = await api<PlaylistData>(`/playlist/${c.id}`);
    return { tracks: p.tracks, source: { kind: 'playlist', id: c.id, title: p.title || c.title, thumbnail: p.thumbnail ?? c.thumbnail } };
  }
  const ar = await api<ArtistData>(`/artist/${c.id}`);
  return { tracks: ar.songs, source: { kind: 'artist', id: c.id, title: ar.name, thumbnail: ar.avatar ?? c.thumbnail } };
}

const loading = new Set<string>();

export async function playItem(item: Item, opts: { shuffle?: boolean } = {}) {
  const player = usePlayer.getState();
  if (isTrack(item)) {
    player.playTrack(item);
    return;
  }
  const key = `${item.kind}:${item.id}`;
  if (loading.has(key)) return;
  loading.add(key);
  try {
    const { tracks, source } = await resolveTracks(item);
    if (!tracks.length) {
      toast({ title: 'Nothing to play here', description: `“${item.title}” has no playable tracks.` });
      return;
    }
    // Autoplay radio picks up after the last track, like YouTube Music.
    player.playQueue(tracks, 0, source, { shuffle: opts.shuffle ?? false });
  } catch (err) {
    toast({ title: 'Could not load', description: err instanceof Error ? err.message : String(err) });
  } finally {
    loading.delete(key);
  }
}

export async function queueItem(item: Item, mode: 'next' | 'end') {
  try {
    const { tracks } = isTrack(item) ? { tracks: [item] } : await resolveTracks(item);
    const p = usePlayer.getState();
    if (mode === 'next') p.playNext(tracks);
    else p.addToQueue(tracks);
    toast({
      title: mode === 'next' ? 'Playing next' : 'Added to queue',
      description: isTrack(item) ? item.title : `${tracks.length} tracks from “${item.title}”`,
    });
  } catch (err) {
    toast({ title: 'Could not add to queue', description: err instanceof Error ? err.message : String(err) });
  }
}

export async function radioFor(item: Item) {
  try {
    if (isTrack(item)) return usePlayer.getState().startRadio(item);
    const { tracks } = await resolveTracks(item);
    if (tracks[0]) usePlayer.getState().startRadio(tracks[0], `${item.title} Radio`);
  } catch (err) {
    toast({ title: 'Could not start radio', description: err instanceof Error ? err.message : String(err) });
  }
}

export function itemUrl(item: Item): string {
  if (isTrack(item)) return `https://music.youtube.com/watch?v=${item.id}`;
  if (item.kind === 'artist') return `https://music.youtube.com/channel/${item.id}`;
  if (item.kind === 'album') return `https://music.youtube.com/browse/${item.id}`;
  return `https://music.youtube.com/playlist?list=${item.id}`;
}

export async function copyLink(item: Item) {
  const url = itemUrl(item);
  try {
    await navigator.clipboard.writeText(url);
    toast({ title: 'Link copied', description: url });
  } catch {
    toast({ title: 'Could not copy link', description: url });
  }
  return url;
}
