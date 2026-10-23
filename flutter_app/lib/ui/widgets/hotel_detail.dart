import 'package:flutter/material.dart';

import '../../core/compare.dart';
import '../../core/theme.dart';
import 'kit.dart';
import 'redirect_sheet.dart';

/// Hotel detail sheet — Flutter mirror of the web HotelDetailModal (17 Oct).
/// Photo grid with lightbox, amenities, and every site's live price with Book.
void showHotelDetail(BuildContext context, HotelGroup g) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (c) => DraggableScrollableSheet(
      expand: false,
      initialChildSize: .9,
      maxChildSize: .95,
      minChildSize: .45,
      builder: (c, sc) => Container(
        decoration: BoxDecoration(
          color: surface(c),
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          border: Border.all(color: border(c)),
        ),
        clipBehavior: Clip.antiAlias,
        child: ListView(
          controller: sc,
          padding: const EdgeInsets.fromLTRB(14, 8, 14, 26),
          children: [
            Center(
              child: Container(
                width: 36,
                height: 4,
                margin: const EdgeInsets.only(bottom: 10),
                decoration: BoxDecoration(
                  color: muted(c).withValues(alpha: .35),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Text(
              g.name,
              style: tx(c, 17, w: FontWeight.w900),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 4),
            Row(
              children: [
                Icon(Icons.location_on_rounded, size: 12, color: muted(c)),
                const SizedBox(width: 2),
                Expanded(
                  child: Text(
                    '${g.locality != null ? '${g.locality}, ' : ''}${g.city}',
                    style: tx(c, 10.5, color: muted(c)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            if (g.rating10 != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Pill(
                    '${g.rating10}/10',
                    bg: T1SColors.emerald500.withValues(alpha: .15),
                    fg: T1SColors.emerald600,
                    icon: Icons.star_rounded,
                    size: 9.5,
                  ),
                  if (g.ratingCount != null) ...[
                    const SizedBox(width: 6),
                    Text('${g.ratingCount} reviews', style: tx(c, 10, color: muted(c))),
                  ],
                  const Spacer(),
                  Text(
                    'from ${formatPrice('hotels', g.best.price)}',
                    style: tx(c, 13, w: FontWeight.w900, mono: true),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 12),
            if (_photos(g).isNotEmpty) ...[
              Text('Photos', style: tx(c, 13, w: FontWeight.w900)),
              const SizedBox(height: 8),
              _PhotoGrid(g: g),
              const SizedBox(height: 14),
            ],
            if (g.amenities.isNotEmpty) ...[
              Text('Amenities', style: tx(c, 13, w: FontWeight.w900)),
              const SizedBox(height: 8),
              Wrap(
                spacing: 6,
                runSpacing: 5,
                children: [
                  for (final a in g.amenities.take(10))
                    Pill(
                      a,
                      bg: isDark(c) ? T1SColors.slate800 : T1SColors.slate50,
                      fg: muted(c),
                      size: 9,
                    ),
                ],
              ),
              const SizedBox(height: 14),
            ],
            Text('Every site, cheapest first', style: tx(c, 13, w: FontWeight.w900)),
            const SizedBox(height: 4),
            Text(
              'Same stay, real prices — we never adjust them.',
              style: tx(c, 10, color: muted(c)),
            ),
            const SizedBox(height: 10),
            for (var i = 0; i < g.rows.length; i++)
              _DetailSiteRow(row: g.rows[i], isBest: i == 0),
          ],
        ),
      ),
    ),
  );
}

List<String> _photos(HotelGroup g) {
  final out = <String>[];
  for (final p in [g.image, ...g.gallery]) {
    if (p != null && p.isNotEmpty && !out.contains(p)) out.add(p);
  }
  return out;
}

class _PhotoGrid extends StatelessWidget {
  const _PhotoGrid({required this.g});
  final HotelGroup g;

  @override
  Widget build(BuildContext context) {
    final photos = _photos(g);
    final wide = MediaQuery.of(context).size.width > 620;
    final cross = wide ? 4 : 2;
    final shown = photos.take(6).toList(growable: false);
    final extra = photos.length - shown.length;
    return GridView.count(
      crossAxisCount: cross,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 6,
      crossAxisSpacing: 6,
      childAspectRatio: 1.25,
      children: [
        for (var i = 0; i < shown.length; i++)
          GestureDetector(
            onTap: () => _openLightbox(context, photos, i),
            // Owner 23 Oct fix: height infinity crashed the decode-budget math
            // (.round() on infinity) in release builds -> every grid cell rendered
            // as a blank ErrorWidget rectangle. The GridView cell already gives
            // tight constraints; the image just fills them with cover fit.
            child: NetImage(
              shown[i],
              fit: BoxFit.cover,
              fallbackIcon: Icons.hotel_rounded,
              radius: 10,
            ),
          ),
        if (extra > 0)
          GestureDetector(
            onTap: () => _openLightbox(context, photos, shown.length),
            child: Container(
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: .72),
                borderRadius: BorderRadius.circular(10),
              ),
              alignment: Alignment.center,
              child: Text(
                '+$extra photos',
                style: tx(context, 13, w: FontWeight.w900, color: Colors.white),
              ),
            ),
          ),
      ],
    );
  }
}

void _openLightbox(BuildContext context, List<String> photos, int initial) {
  Navigator.of(context, rootNavigator: true).push(
    PageRouteBuilder(
      opaque: false,
      barrierColor: Colors.black.withValues(alpha: .95),
      pageBuilder: (c, anim, _) => _Lightbox(photos: photos, initial: initial),
    ),
  );
}

class _Lightbox extends StatefulWidget {
  const _Lightbox({required this.photos, required this.initial});
  final List<String> photos;
  final int initial;

  @override
  State<_Lightbox> createState() => _LightboxState();
}

class _LightboxState extends State<_Lightbox> {
  late final PageController _pc = PageController(initialPage: widget.initial);
  late int _page = widget.initial;

  @override
  void dispose() {
    _pc.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          Positioned.fill(
            child: PageView.builder(
              controller: _pc,
              itemCount: widget.photos.length,
              onPageChanged: (i) => setState(() => _page = i),
              itemBuilder: (c, i) => Interactive(
                photo: widget.photos[i],
              ),
            ),
          ),
          SafeArea(
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: Colors.white),
                  onPressed: () => Navigator.of(context).pop(),
                ),
                const Spacer(),
                Padding(
                  padding: const EdgeInsets.only(right: 16),
                  child: Text(
                    '${_page + 1} / ${widget.photos.length}',
                    style: tx(context, 12, w: FontWeight.w800, color: Colors.white70),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class Interactive extends StatelessWidget {
  const Interactive({required this.photo});
  final String photo;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: NetImage(
        photo,
        fit: BoxFit.contain,
        fallbackIcon: Icons.hotel_rounded,
        bg: Colors.black,
      ),
    );
  }
}

class _DetailSiteRow extends StatelessWidget {
  const _DetailSiteRow({required this.row, required this.isBest});
  final HotelRow row;
  final bool isBest;

  @override
  Widget build(BuildContext context) {
    final url = row.item.bestQuote?.url ?? '';
    final price = row.price > 0 ? formatPrice('hotels', row.price) : 'Price on site';
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        row.site,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: tx(context, 12, w: FontWeight.w800),
                      ),
                    ),
                    if (isBest) ...[
                      const SizedBox(width: 5),
                      Pill('BEST', bg: T1SColors.greenBg, fg: T1SColors.green, size: 7.5),
                    ],
                  ],
                ),
                if (row.freeCancellation || row.breakfast)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Text(
                      [
                        if (row.freeCancellation) 'Free cancellation',
                        if (row.breakfast) 'Breakfast included',
                      ].join(' · '),
                      style: tx(context, 9, color: muted(context)),
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(price, style: tx(context, 13, w: FontWeight.w900, mono: true)),
          const SizedBox(width: 8),
          RedButton(
            'Book',
            dense: true,
            onTap: url.isEmpty
                ? null
                : () => showRedirectSheet(
                      context,
                      sellerName: row.site,
                      title: row.item.title,
                      goUrl: url,
                      price: row.price > 0 ? row.price : null,
                      image: row.item.imageUrl,
                      isLowest: isBest,
                    ),
          ),
        ],
      ),
    );
  }
}
