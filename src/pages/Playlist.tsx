import { useParams } from 'react-router-dom';
import { ListPlus } from 'lucide-react';
import { useApi } from '../lib/api';
import type { Collection, PlaylistData } from '../lib/types';
import { useUI } from '../store/ui';
import { CollectionHeader, CollectionSkeleton, CoverArt, PlayButtons, TrackList, totalDuration } from '../components/media/Collection';
import { SectionShelf } from '../components/media/Shelf';
import { ErrorState, IconButton } from '../components/ui/primitives';
import { SaveButtons } from './Album';

export default function Playlist() {
  const { id = '' } = useParams();
  const { data, error, loading, reload } = useApi<PlaylistData>(`/playlist/${id}`);
  const openAddToPlaylist = useUI((s) => s.openAddToPlaylist);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <CollectionSkeleton />;

  const item: Collection = { kind: 'playlist', id, title: data.title, thumbnail: data.thumbnail, subtitle: data.author };
  const source = { kind: 'playlist' as const, id, title: data.title, thumbnail: data.thumbnail };
  return (
    <div>
      <CollectionHeader
        art={<CoverArt src={data.thumbnail} alt={data.title} />}
        artSrc={data.thumbnail}
        type="Playlist"
        title={data.title}
        meta={
          <span className="flex flex-wrap items-center justify-center gap-x-1.5 md:justify-start">
            {data.author && <span className="font-semibold text-white">{data.author}</span>}
            {data.author && <span>•</span>}
            <span>{data.meta || `${data.tracks.length} songs • ${totalDuration(data.tracks)}`}</span>
          </span>
        }
        description={data.description}
        actions={
          <>
            <PlayButtons tracks={data.tracks} source={source} />
            <SaveButtons item={item} />
            <IconButton
              label="Copy into a playlist"
              onClick={() => openAddToPlaylist(data.tracks)}
              disabled={!data.tracks.length}
              className="bg-white/10 backdrop-blur"
              size="lg"
            >
              <ListPlus className="h-5 w-5" />
            </IconButton>
          </>
        }
      />
      {data.tracks.length ? (
        <TrackList tracks={data.tracks} source={source} />
      ) : (
        <p className="py-16 text-center text-ink-3">This playlist is empty.</p>
      )}
      <div className="mt-12">
        {data.sections.map((s) => (
          <SectionShelf key={s.title} section={s} />
        ))}
      </div>
    </div>
  );
}
