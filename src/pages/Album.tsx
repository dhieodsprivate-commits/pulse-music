import { useParams, Link } from 'react-router-dom';
import { Library, MoreHorizontal, Pin } from 'lucide-react';
import { useApi } from '../lib/api';
import type { AlbumData, Collection } from '../lib/types';
import { useLibrary } from '../store/library';
import { useUI, toast } from '../store/ui';
import { CollectionHeader, CollectionSkeleton, CoverArt, PlayButtons, TrackList, totalDuration } from '../components/media/Collection';
import { SectionShelf } from '../components/media/Shelf';
import { ErrorState, IconButton } from '../components/ui/primitives';

export function SaveButtons({ item }: { item: Collection }) {
  const saved = useLibrary((s) => s.saved.some((c) => c.id === item.id && c.kind === item.kind));
  const pinned = useLibrary((s) => s.pins.some((c) => c.id === item.id && c.kind === item.kind));
  const toggleSaved = useLibrary((s) => s.toggleSaved);
  const togglePin = useLibrary((s) => s.togglePin);
  const openMenu = useUI((s) => s.openMenu);
  return (
    <>
      <IconButton
        label={saved ? 'Remove from library' : 'Save to library'}
        active={saved}
        onClick={() => {
          const now = toggleSaved(item);
          toast({ title: now ? 'Saved to library' : 'Removed from library', description: item.title });
        }}
        className="bg-white/10 backdrop-blur"
        size="lg"
      >
        <Library className="h-5 w-5" />
      </IconButton>
      <IconButton
        label={pinned ? 'Unpin from Speed dial' : 'Pin to Speed dial'}
        active={pinned}
        onClick={() => {
          const now = togglePin(item);
          toast({ title: now ? 'Pinned to Speed dial' : 'Unpinned from Speed dial', description: item.title });
        }}
        className="bg-white/10 backdrop-blur"
        size="lg"
      >
        <Pin className="h-5 w-5" />
      </IconButton>
      <IconButton
        label="More"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          openMenu({ item, x: r.left, y: r.bottom + 6 });
        }}
        className="bg-white/10 backdrop-blur"
        size="lg"
      >
        <MoreHorizontal className="h-5 w-5" />
      </IconButton>
    </>
  );
}

export default function Album() {
  const { id = '' } = useParams();
  const { data, error, loading, reload } = useApi<AlbumData>(`/album/${id}`);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (loading || !data) return <CollectionSkeleton />;

  const item: Collection = { kind: 'album', id, title: data.title, thumbnail: data.thumbnail, subtitle: data.artists.map((a) => a.name).join(', ') };
  const source = { kind: 'album' as const, id, title: data.title, thumbnail: data.thumbnail };
  return (
    <div>
      <CollectionHeader
        art={<CoverArt src={data.thumbnail} alt={data.title} />}
        artSrc={data.thumbnail}
        type={data.type}
        title={data.title}
        meta={
          <span className="flex flex-wrap items-center justify-center gap-x-1.5 md:justify-start">
            {data.artists.map((a, i) => (
              <span key={a.name}>
                {i > 0 && ', '}
                {a.id ? (
                  <Link to={`/artist/${a.id}`} className="font-semibold text-white hover:underline">
                    {a.name}
                  </Link>
                ) : (
                  <span className="font-semibold text-white">{a.name}</span>
                )}
              </span>
            ))}
            {data.year && <span>• {data.year}</span>}
            <span>• {data.meta || `${data.tracks.length} songs • ${totalDuration(data.tracks)}`}</span>
          </span>
        }
        description={data.description}
        actions={
          <>
            <PlayButtons tracks={data.tracks} source={source} />
            <SaveButtons item={item} />
          </>
        }
      />
      <TrackList tracks={data.tracks} source={source} numbered showAlbum={false} />
      <div className="mt-12">
        {data.sections.map((s) => (
          <SectionShelf key={s.title} section={s} />
        ))}
      </div>
    </div>
  );
}
