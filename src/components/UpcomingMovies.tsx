import { useEffect, useState } from 'react';
import { PlayCircle, CalendarDays, ThumbsUp, ExternalLink } from 'lucide-react';

/**
 * Upcoming Movies section (owner 22 Oct) — sits directly below the Instant
 * Launch Verticals grid. Real data from BookMyShow's own upcoming-discovery
 * tab via /api/movies/upcoming (server caches 30 min, honest empty state).
 * "Watch Trailer" opens the YouTube search for "<title> official trailer"
 * (a real link — never a fabricated stream). "Showtimes" exits through
 * /api/out masking pointers created server-side. Mobile responsive: 2-col
 * grid on phones, horizontal scroll rail on larger screens.
 */

interface UpcomingMovie {
  title: string;
  genres: string | null;
  likes: string | null;
  releaseDate: string | null;
  poster: string | null;
  pageUrl: string;
  eventCode: string | null;
  trailerUrl: string;
  goUrl: string;
}

export const UpcomingMovies: React.FC = () => {
  const [movies, setMovies] = useState<UpcomingMovie[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'empty'>('loading');

  useEffect(() => {
    let alive = true;
    fetch('/api/movies/upcoming')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        const ms: UpcomingMovie[] = Array.isArray(d?.movies) ? d.movies : [];
        setMovies(ms.slice(0, 12));
        setState(ms.length ? 'ready' : 'empty');
      })
      .catch(() => alive && setState('empty'));
    return () => { alive = false; };
  }, []);

  if (state !== 'ready') return null; // honest: no section when BMS is unreachable

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 bg-red-600 rounded-full animate-ping" />
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
            Upcoming Movies · Watch Trailers First
          </h2>
        </div>
      </div>

      {/* Phones: 2-col poster grid; sm+: horizontal scroll rail */}
      <div className="grid grid-cols-2 sm:hidden gap-3">
        {movies.slice(0, 6).map((m, i) => (
          <a
            key={`m-${i}`}
            href={m.goUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-lg transition-shadow"
          >
            <div className="aspect-[2/3] bg-slate-100">
              {m.poster && (
                <img
                  src={m.poster}
                  alt={m.title}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              )}
            </div>
            <div className="p-2">
              <p className="text-[12px] font-bold text-slate-900 leading-tight line-clamp-1">{m.title}</p>
              {m.releaseDate && (
                <p className="mt-0.5 text-[10px] font-bold text-red-600">{m.releaseDate}</p>
              )}
              <p className="mt-0.5 text-[10px] text-slate-500 line-clamp-1">{m.genres || ''}</p>
              <span className="mt-1.5 inline-flex items-center gap-1 bg-red-600 text-white text-[10px] font-bold px-2 py-1 rounded-md">
                <PlayCircle className="w-3 h-3" /> Watch Trailer
              </span>
            </div>
          </a>
        ))}
      </div>

      <div className="hidden sm:flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x">
        {movies.map((m, i) => (
          <div
            key={`d-${i}`}
            className="snap-start shrink-0 w-40 rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-lg transition-shadow"
          >
            <a href={m.goUrl} target="_blank" rel="noopener noreferrer" className="block">
              <div className="aspect-[2/3] bg-slate-100">
                {m.poster && (
                  <img
                    src={m.poster}
                    alt={m.title}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
            </a>
            <div className="p-2.5">
              <p className="text-[13px] font-bold text-slate-900 leading-tight line-clamp-1">{m.title}</p>
              {m.releaseDate && (
                <p className="mt-0.5 flex items-center gap-1 text-[10.5px] font-bold text-red-600">
                  <CalendarDays className="w-3 h-3" /> {m.releaseDate}
                </p>
              )}
              <p className="mt-0.5 text-[10.5px] text-slate-500 line-clamp-1">{m.genres || ''}</p>
              {m.likes && (
                <p className="mt-0.5 flex items-center gap-1 text-[10.5px] text-slate-400">
                  <ThumbsUp className="w-3 h-3" /> {m.likes.replace(/\s*Likes\s*$/i, '')}
                </p>
              )}
              <div className="mt-2 flex items-center gap-1.5">
                <a
                  href={m.trailerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 text-white text-[10.5px] font-bold px-2 py-1.5 rounded-md transition-colors"
                >
                  <PlayCircle className="w-3.5 h-3.5" /> Trailer
                </a>
                <a
                  href={m.goUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Showtimes on BookMyShow"
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

export default UpcomingMovies;
