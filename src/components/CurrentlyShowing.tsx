import { useEffect, useState } from 'react';
import { Ticket, ThumbsUp, ExternalLink } from 'lucide-react';

/**
 * "Currently Showing" section (owner 31 Oct: "ye jaisa homepage pr hai upcoming movies
 * ka waisa hi ek section, currently showing ke naam se bnao Picked Just for You ke
 * neeche aur isme Book button lgao aur ye movie vertical pr le jaayega").
 *
 * Card anatomy is deliberately IDENTICAL to the approved Upcoming Movies card: poster,
 * dark likes strip at the bottom-left of the poster with the green thumbs-up count, bold
 * title, grey genres line, then the footer row. Only the footer differs, exactly as the
 * owner asked: the red pill says "Book" instead of "Trailer", and tapping it takes the
 * visitor to the MOVIES vertical (the app's own film feed with real showtimes), not to
 * an outside page. The small outlined square keeps the external-link behaviour for the
 * movie's own BookMyShow page, routed through /api/out like every other exit.
 *
 * Data is real in-theatre inventory from BookMyShow's now-showing discovery via
 * /api/movies/currently-showing (server-side cache, honest empty state — the section
 * simply does not render when BMS cannot be reached, never mock cards).
 *
 * Mobile: same responsive shape as Upcoming Movies — a 2-column poster grid on phones,
 * a horizontal scroll rail from `sm` upwards.
 */

interface CurrentMovie {
  title: string;
  genres: string | null;
  likes: string | null;
  poster: string | null;
  pageUrl: string;
  eventCode: string | null;
  goUrl: string;
}

interface CurrentlyShowingProps {
  /** Called when the visitor taps Book: the caller switches to the movies vertical. */
  onBook: (movie: CurrentMovie) => void;
}

const likesLabel = (likes: string | null): string | null =>
  likes ? likes.replace(/\s*Likes\s*$/i, ' Likes') : null;

export const CurrentlyShowing: React.FC<CurrentlyShowingProps> = ({ onBook }) => {
  const [movies, setMovies] = useState<CurrentMovie[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'empty'>('loading');

  useEffect(() => {
    let alive = true;
    fetch('/api/movies/currently-showing')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const ms: CurrentMovie[] = Array.isArray(d?.movies) ? d.movies : [];
        setMovies(ms.slice(0, 12));
        setState(ms.length ? 'ready' : 'empty');
      })
      .catch(() => { if (alive) setState('empty'); });
    return () => { alive = false; };
  }, []);

  if (state !== 'ready') return null; // honest: no section when BMS is unreachable

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping" />
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
            Currently Showing · Book In Theatres
          </h2>
        </div>
      </div>

      {/* Phones: 2-col poster grid; sm+: horizontal scroll rail (identical to Upcoming) */}
      <div className="grid grid-cols-2 sm:hidden gap-3">
        {movies.slice(0, 6).map((m, i) => (
          <div
            key={`cm-${i}`}
            className="rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
          >
            <a href={m.goUrl} target="_blank" rel="noopener noreferrer" className="block relative">
              <div className="relative aspect-[2/3] bg-slate-100">
                {m.poster && (
                  <img src={m.poster} alt={m.title} loading="lazy" className="w-full h-full object-cover" />
                )}
                {likesLabel(m.likes) && (
                  <div className="absolute bottom-0 inset-x-0 bg-[#1a1a1a] px-2 py-1.5 flex items-center gap-1">
                    <ThumbsUp className="w-3 h-3 text-emerald-500 fill-emerald-500 shrink-0" />
                    <span className="text-[10px] font-bold text-white truncate">{likesLabel(m.likes)}</span>
                  </div>
                )}
              </div>
            </a>
            <div className="p-2 flex flex-col flex-1">
              <p className="text-[12px] font-bold text-slate-900 leading-tight line-clamp-1">{m.title}</p>
              <p className="mt-0.5 text-[10px] text-slate-500 line-clamp-1">{m.genres || ''}</p>
              <div className="mt-1.5 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onBook(m)}
                  className="flex-1 inline-flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-2 py-1 rounded-md transition-colors cursor-pointer"
                >
                  <Ticket className="w-3 h-3" /> Book
                </button>
                <a
                  href={m.goUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open on BookMyShow"
                  className="inline-flex items-center justify-center border border-slate-200 hover:border-red-300 text-slate-600 p-1 rounded-md transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="hidden sm:flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {movies.map((m, i) => (
          <div
            key={`cmd-${i}`}
            className="snap-start shrink-0 w-40 rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
          >
            <a href={m.goUrl} target="_blank" rel="noopener noreferrer" className="block relative">
              <div className="relative aspect-[2/3] bg-slate-100">
                {m.poster && (
                  <img src={m.poster} alt={m.title} loading="lazy" className="w-full h-full object-cover" />
                )}
                {likesLabel(m.likes) && (
                  <div className="absolute bottom-0 inset-x-0 bg-[#1a1a1a] px-2.5 py-2 flex items-center gap-1.5 z-10">
                    <ThumbsUp className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500 shrink-0" />
                    <span className="text-[11px] font-bold text-white truncate">{likesLabel(m.likes)}</span>
                  </div>
                )}
              </div>
            </a>
            <div className="p-2.5 flex flex-col flex-1">
              <p className="text-[13px] font-bold text-slate-900 leading-tight line-clamp-1">{m.title}</p>
              <p className="mt-0.5 text-[10.5px] text-slate-500 line-clamp-1">{m.genres || ''}</p>
              <div className="mt-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onBook(m)}
                  className="flex-1 inline-flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 text-white text-[10.5px] font-bold px-2 py-1.5 rounded-md transition-colors cursor-pointer"
                >
                  <Ticket className="w-3.5 h-3.5" /> Book
                </button>
                <a
                  href={m.goUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open on BookMyShow"
                  className="inline-flex items-center justify-center border border-slate-200 hover:border-red-300 text-slate-600 px-1.5 py-1.5 rounded-md transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

export default CurrentlyShowing;
