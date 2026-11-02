import 'package:flutter/material.dart';

import '../../core/api.dart';
import '../../core/session_cache.dart';
import '../../core/theme.dart';
import 'kit.dart';

/// "Currently Showing" rail (owner 31 Oct): same card as the approved Upcoming
/// Movies rail — poster, black likes bar with the green thumbs-up, bold title,
/// grey genres — but the footer is a red "Book" button that opens the app's own
/// MOVIES vertical (real showtimes in our feed), never an outside page.
/// The poster and the small square keep the /api/out-masked BookMyShow exit.
/// Data: /api/movies/currently-showing (server caches 30 min, honest empty state).
class CurrentlyShowingRail extends StatefulWidget {
  final Try1SecondApi api;
  final void Function() onBook;
  const CurrentlyShowingRail({super.key, required this.api, required this.onBook});

  @override
  State<CurrentlyShowingRail> createState() => _CurrentlyShowingRailState();
}

class _CurrentlyShowingRailState extends State<CurrentlyShowingRail> {
  List<UpcomingMovie> _movies = const [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    if (SessionCache.has('home.currentlyShowing')) {
      _movies = SessionCache.get('home.currentlyShowing', const <UpcomingMovie>[]).take(12).toList();
      _loading = false;
      return;
    }
    _load();
  }

  Future<void> _load() async {
    try {
      final ms = await SessionCache.once('home.currentlyShowing', () => fetchCurrentlyShowingMovies(widget.api));
      if (!mounted) return;
      setState(() { _movies = ms.take(12).toList(); _loading = false; });
    } catch (_) {
      // Honest empty state: when BMS is unreachable the section simply hides.
      if (mounted) setState(() => _loading = false);
    }
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
            'CURRENTLY SHOWING · BOOK IN THEATRES',
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
          itemBuilder: (context, i) => _CurrentCard(movie: _movies[i], onBook: widget.onBook),
        ),
      ),
    ]);
  }
}

class _CurrentCard extends StatelessWidget {
  final UpcomingMovie movie;
  final void Function() onBook;
  const _CurrentCard({required this.movie, required this.onBook});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 132,
      child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Expanded(
          child: GestureDetector(
            onTap: () { if (movie.goUrl.isNotEmpty) openDeal(movie.goUrl, sellerName: 'BookMyShow'); },
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Stack(fit: StackFit.expand, children: [
                movie.poster == null
                    ? Container(color: Colors.grey.shade200, child: const Center(child: Icon(Icons.movie, color: Colors.grey)))
                    : Image.network(movie.poster!, fit: BoxFit.cover, width: double.infinity,
                        errorBuilder: (_, __, ___) => Container(color: Colors.grey.shade200, child: const Center(child: Icon(Icons.movie, color: Colors.grey)))),
                if (movie.likes != null && movie.likes!.isNotEmpty)
                  Positioned(
                    left: 0, right: 0, bottom: 0,
                    child: Container(
                      color: const Color(0xFF1A1A1A),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                      child: Row(children: [
                        const Icon(Icons.thumb_up, size: 10, color: Color(0xFF10B981)),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            movie.likes!,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 9.5, fontWeight: FontWeight.w800, color: Colors.white),
                          ),
                        ),
                      ]),
                    ),
                  ),
              ]),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(movie.title, maxLines: 1, overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800)),
        if (movie.genres != null)
          Text(movie.genres!, maxLines: 1, overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 9.5, color: Colors.grey.shade600)),
        const SizedBox(height: 6),
        Row(children: [
          Expanded(
            child: GestureDetector(
              onTap: onBook,
              child: Container(
                height: 26,
                decoration: BoxDecoration(color: T1SColors.red, borderRadius: BorderRadius.circular(6)),
                child: const Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.confirmation_number_outlined, size: 12, color: Colors.white),
                  SizedBox(width: 3),
                  Text('Book', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Colors.white)),
                ]),
              ),
            ),
          ),
          const SizedBox(width: 4),
          GestureDetector(
            onTap: () { if (movie.goUrl.isNotEmpty) openDeal(movie.goUrl, sellerName: 'BookMyShow'); },
            child: Container(
              width: 26, height: 26,
              decoration: BoxDecoration(border: Border.all(color: Colors.grey.shade300), borderRadius: BorderRadius.circular(6)),
              child: Icon(Icons.open_in_new, size: 12, color: Colors.grey.shade700),
            ),
          ),
        ]),
      ]),
    );
  }
}
