import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/theme.dart';
import 'kit.dart';

/// Upcoming Movies rail (owner 22 Oct) — mirrors the web section directly
/// under the Instant Launch Verticals grid. Real BookMyShow upcoming data
/// via /api/movies/upcoming: poster, release date, genres, likes.
/// "Watch Trailer" opens the YouTube search (external app/browser);
/// the poster routes through the /api/out masking pointer like every exit.
class UpcomingMoviesRail extends StatefulWidget {
  final Try1SecondApi api;
  const UpcomingMoviesRail({super.key, required this.api});

  @override
  State<UpcomingMoviesRail> createState() => _UpcomingMoviesRailState();
}

class _UpcomingMoviesRailState extends State<UpcomingMoviesRail> {
  List<UpcomingMovie> _movies = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final ms = await fetchUpcomingMovies(widget.api);
      if (!mounted) return;
      setState(() { _movies = ms.take(12).toList(); _loading = false; });
    } catch (_) {
      // Honest empty state: when BMS is unreachable the section simply hides.
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _openTrailer(String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    try {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {/* YouTube link always resolves on a phone; ignore */}
  }

  @override
  Widget build(BuildContext context) {
    if (_loading || _movies.isEmpty) return const SizedBox.shrink();

    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 10),
        child: Row(children: [
          Container(width: 8, height: 8, decoration: const BoxDecoration(color: T1SColors.red, shape: BoxShape.circle)),
          const SizedBox(width: 8),
          const Text(
            'UPCOMING MOVIES · WATCH TRAILERS FIRST',
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 0.6),
          ),
        ]),
      ),
      SizedBox(
        height: 268,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 16),
          itemCount: _movies.length,
          separatorBuilder: (_, __) => const SizedBox(width: 10),
          itemBuilder: (context, i) => _UpcomingCard(movie: _movies[i], onTrailer: _openTrailer),
        ),
      ),
    ]);
  }
}

class _UpcomingCard extends StatelessWidget {
  final UpcomingMovie movie;
  final void Function(String) onTrailer;
  const _UpcomingCard({required this.movie, required this.onTrailer});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 132,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        // Poster (taps through the /api/out masking pointer)
        Expanded(
          child: GestureDetector(
            onTap: () { if (movie.goUrl.isNotEmpty) openDeal(movie.goUrl, sellerName: 'BookMyShow'); },
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: movie.poster == null
                  ? Container(color: Colors.grey.shade200, child: const Center(child: Icon(Icons.movie, color: Colors.grey)))
                  : Image.network(movie.poster!, fit: BoxFit.cover, width: double.infinity,
                      errorBuilder: (_, __, ___) => Container(color: Colors.grey.shade200, child: const Center(child: Icon(Icons.movie, color: Colors.grey)))),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(movie.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800)),
        if (movie.releaseDate != null)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(movie.releaseDate!, style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800, color: T1SColors.red)),
          ),
        if (movie.genres != null && movie.genres!.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 2),
            child: Text(movie.genres!, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 10, color: Colors.grey.shade600)),
          ),
        const SizedBox(height: 6),
        SizedBox(
          height: 30,
          child: FilledButton.icon(
            style: FilledButton.styleFrom(
              backgroundColor: T1SColors.red,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 8),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            onPressed: () { if (movie.trailerUrl.isNotEmpty) onTrailer(movie.trailerUrl); },
            icon: const Icon(Icons.play_circle, size: 15),
            label: const Text('Trailer', style: TextStyle(fontSize: 10.5, fontWeight: FontWeight.w800)),
          ),
        ),
      ]),
    );
  }
}
