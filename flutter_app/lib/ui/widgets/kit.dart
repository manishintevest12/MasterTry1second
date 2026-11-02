import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/api.dart';
import '../../core/app_state.dart';
import '../../core/theme.dart';
import '../screens/in_app_browser_screen.dart';

/// Shared building blocks that match the website's Tailwind look.

bool isDark(BuildContext c) => Theme.of(c).brightness == Brightness.dark;

Color surface(BuildContext c) => isDark(c) ? T1SColors.slate900 : Colors.white;
Color border(BuildContext c) => isDark(c) ? const Color(0xFF334155) : T1SColors.slate200;
Color muted(BuildContext c) => isDark(c) ? T1SColors.slate400 : T1SColors.slate500;
Color ink(BuildContext c) => isDark(c) ? T1SColors.slate100 : T1SColors.slate900;

TextStyle tx(BuildContext c, double size, {FontWeight w = FontWeight.w600, Color? color, double? h, double? ls, bool mono = false}) =>
    TextStyle(
      fontSize: size,
      fontWeight: w,
      color: color ?? ink(c),
      height: h,
      letterSpacing: ls,
      fontFamily: mono ? 'monospace' : null,
    );

/// White (or slate-900) rounded card with 1px border, like `bg-white rounded-2xl border border-slate-200`.
class Box extends StatelessWidget {
  const Box({super.key, required this.child, this.padding = const EdgeInsets.all(14), this.radius = 16, this.onTap, this.color, this.borderColor, this.shadow = false, this.clip = false});
  final Widget child;
  final EdgeInsets padding;
  final double radius;
  final VoidCallback? onTap;
  final Color? color;
  final Color? borderColor;
  final bool shadow;
  final bool clip;

  @override
  Widget build(BuildContext context) {
    final deco = BoxDecoration(
      color: color ?? surface(context),
      borderRadius: BorderRadius.circular(radius),
      border: Border.all(color: borderColor ?? border(context)),
      boxShadow: shadow ? [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 14, offset: const Offset(0, 4))] : null,
    );
    final inner = Padding(padding: padding, child: child);
    return Container(
      decoration: deco,
      clipBehavior: clip ? Clip.antiAlias : Clip.none,
      child: onTap == null
          ? inner
          : Material(
              color: Colors.transparent,
              child: InkWell(borderRadius: BorderRadius.circular(radius), onTap: onTap, child: inner),
            ),
    );
  }
}

/// Network image with a quiet placeholder + graceful failure (never a fake product photo).
class NetImage extends StatelessWidget {
  const NetImage(this.url, {super.key, this.fit = BoxFit.cover, this.width, this.height, this.radius = 0, this.fallbackIcon = Icons.image_outlined, this.bg, this.cacheWidthPx});
  final String? url;
  final BoxFit fit;
  final double? width;
  final double? height;
  final double radius;
  final IconData fallbackIcon;
  final Color? bg;

  /// Decode-budget override in physical pixels. When null (the normal case)
  /// it is derived from [width]/[height] x device pixel ratio with headroom,
  /// so a 1200x1200 CDN photo is decoded at card size instead of full size.
  final int? cacheWidthPx;

  @override
  Widget build(BuildContext context) {
    final back = bg ?? (isDark(context) ? T1SColors.slate800 : T1SColors.slate50);
    Widget fallback() => Container(width: width, height: height, color: back, alignment: Alignment.center, child: Icon(fallbackIcon, color: T1SColors.slate300, size: 26));
    final u = url;
    if (u == null || u.isEmpty) return fallback();
    // SPEED (22 Oct, web mirror): network downscale via wsrv.nl — a 1.4MB OYO/Agoda
    // photo transfers as ~10-30KB WebP at the card's pixel budget (decode budget only
    // fixed memory; this fixes the wire + cold-start time). Two-stage self-healing
    // degrade like the web chain: sized -> RAW CDN URL -> placeholder icon. Never a
    // fake product photo.
    final proxied = _proxiedUrl(u, cacheWidthPx ?? _decodeBudget(context));
    final direct = CachedNetworkImage(
      imageUrl: u,
      width: width,
      height: height,
      fit: fit,
      memCacheWidth: cacheWidthPx ?? _decodeBudget(context),
      fadeInDuration: const Duration(milliseconds: 150),
      errorWidget: (_, __, ___) => fallback(),
      placeholder: (_, __) => Container(width: width, height: height, color: back),
    );
    final child = proxied == u
        ? direct
        : CachedNetworkImage(
            // SPEED (21 Oct): photos persist on disk across launches and scrolls
            // (Image.network kept re-downloading every hotel/dish/product image).
            imageUrl: proxied,
            width: width,
            height: height,
            fit: fit,
            // SPEED (22 Oct): decode downscale — full-res product photos decode
            // at card size (5-10x less bitmap memory, far fewer GC hitches mid-scroll).
            memCacheWidth: cacheWidthPx ?? _decodeBudget(context),
            fadeInDuration: const Duration(milliseconds: 150),
            errorWidget: (_, __, ___) => direct,
            placeholder: (_, __) => Container(width: width, height: height, color: back),
          );
    return radius == 0 ? child : ClipRRect(borderRadius: BorderRadius.circular(radius), child: child);
  }

  /// wsrv.nl sizing URL; returns [u] untouched when it cannot be proxied.
  String _proxiedUrl(String u, int? budgetPx) {
    if (!u.startsWith('https://')) return u;
    final wpx = budgetPx != null && budgetPx > 0 ? (budgetPx < 320 ? 320 : (budgetPx > 800 ? 800 : budgetPx)) : 480;
    final bare = u.replaceFirst('https://', '');
    return 'https://wsrv.nl/?url=${Uri.encodeComponent(bare)}&w=$wpx&q=72&output=webp';
  }

  /// Physical-pixel decode budget from the logical box size (1.25x headroom so
  /// pinch/overscroll never rasterises a soft image).
  int? _decodeBudget(BuildContext context) {
    // Guard (owner 23 Oct): double.infinity here crashed .round() in release,
    // blanking whole image grids. Non-finite sizes fall back to the default budget.
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final w = width;
    if (w != null && w.isFinite) return (w * dpr * 1.25).round();
    final h = height;
    if (h != null && h.isFinite) return (h * dpr * 1.25).round();
    return null;
  }
}

/// Merchant / bank logo: the site's `google favicons` circle.
class SiteLogo extends StatelessWidget {
  const SiteLogo(this.domain, {super.key, this.size = 28});
  final String domain;
  final double size;
  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: Colors.white, shape: BoxShape.circle, border: Border.all(color: T1SColors.slate200)),
      clipBehavior: Clip.antiAlias,
      padding: EdgeInsets.all(size * 0.16),
      child: CachedNetworkImage(
        imageUrl: 'https://www.google.com/s2/favicons?domain=$domain&sz=64',
        fit: BoxFit.contain,
        errorWidget: (_, __, ___) => Icon(Icons.storefront_outlined, size: size * 0.5, color: T1SColors.slate400),
      ),
    );
  }
}

/// Small coloured pill (badges like "Live Verified", "Best price").
class Pill extends StatelessWidget {
  const Pill(this.text, {super.key, this.bg, this.fg, this.borderColor, this.icon, this.size = 10});
  final String text;
  final Color? bg;
  final Color? fg;
  final Color? borderColor;
  final IconData? icon;
  final double size;
  @override
  Widget build(BuildContext context) {
    final f = fg ?? T1SColors.slate600;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: bg ?? T1SColors.slate100,
        borderRadius: BorderRadius.circular(999),
        border: borderColor == null ? null : Border.all(color: borderColor!),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: size + 1, color: f), const SizedBox(width: 3)],
        Flexible(child: Text(text, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: size, fontWeight: FontWeight.w800, color: f))),
      ]),
    );
  }
}

/// Red filled button (website `bg-red-600 text-white rounded-xl font-black`).
class RedButton extends StatelessWidget {
  const RedButton(this.label, {super.key, this.onTap, this.icon, this.trailing, this.dense = false, this.expand = false, this.loading = false});
  final String label;
  final VoidCallback? onTap;
  final IconData? icon;
  final IconData? trailing;
  final bool dense;
  final bool expand;
  final bool loading;
  @override
  Widget build(BuildContext context) {
    return Material(
      color: onTap == null ? T1SColors.red.withValues(alpha: 0.5) : T1SColors.red,
      borderRadius: BorderRadius.circular(dense ? 10 : 12),
      child: InkWell(
        borderRadius: BorderRadius.circular(dense ? 10 : 12),
        onTap: loading ? null : onTap,
        child: Padding(
          padding: EdgeInsets.symmetric(horizontal: dense ? 12 : 22, vertical: dense ? 9 : 13),
          child: Row(
            mainAxisSize: expand ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (loading) const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
              else if (icon != null) Icon(icon, size: dense ? 14 : 16, color: Colors.white),
              if (loading || icon != null) const SizedBox(width: 6),
              Flexible(child: Text(label, overflow: TextOverflow.ellipsis, style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: dense ? 11.5 : 12.5))),
              if (trailing != null) ...[const SizedBox(width: 6), Icon(trailing, size: 16, color: Colors.white)],
            ],
          ),
        ),
      ),
    );
  }
}

/// Secondary outline button (website slate-50 border button).
class T1SOutlineButton extends StatelessWidget {
  const T1SOutlineButton(this.label, {super.key, this.onTap, this.icon});
  final String label;
  final VoidCallback? onTap;
  final IconData? icon;
  @override
  Widget build(BuildContext context) {
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        side: BorderSide(color: border(context)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        backgroundColor: isDark(context) ? T1SColors.slate900 : T1SColors.slate50,
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        if (icon != null) ...[Icon(icon, size: 15, color: T1SColors.red), const SizedBox(width: 6)],
        Text(label, style: tx(context, 12, w: FontWeight.w800)),
      ]),
    );
  }
}

/// Dark section title with a small coloured dot, as on the site ("● QUICK APPS").
class SectionTitle extends StatelessWidget {
  const SectionTitle(this.title, {super.key, this.trailing, this.dot = T1SColors.red});
  final String title;
  final Widget? trailing;
  final Color dot;
  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(children: [
        Container(width: 8, height: 8, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
        const SizedBox(width: 8),
        Expanded(child: Text(title.toUpperCase(), style: tx(context, 12, w: FontWeight.w900, ls: 0.8))),
        if (trailing != null) trailing!,
      ]),
    );
  }
}

/// Opens a masking-pointer / external URL. `/api/out?t=` is relative to the API base, so the
/// server (not the app) adds affiliate parameters and records the click.
///
/// Owner request (21 Oct): offer redirections open INSIDE the app in the
/// embedded browser (dark header + favicon/seller pill, hidden URL, bottom
/// Back/Forward/Refresh/Share/More toolbar) instead of leaving to Chrome.
Future<bool> openDeal(String url, {String? sellerName, double? price}) async {
  if (url.isEmpty) return false;
  // Resolved against the PUBLIC site host, never the API relay: a webview request is
  // neither our Dart client UA nor an allow-listed browser Origin, so the relay refused it
  // and the partner page never loaded (see exitUrl in core/api.dart).
  final full = exitUrl(url);
  final uri = Uri.tryParse(full);
  if (uri == null) return false;
  final nav = AppState.instance.navigator.currentState;
  if (nav != null) {
    try {
      await nav.push(MaterialPageRoute<void>(
        builder: (_) => InAppBrowserScreen(url: full, sellerName: sellerName, price: price),
      ));
      return true;
    } catch (_) {
      // The embedded webview failed to start (missing system WebView, plugin
      // error, ...). NEVER leave a dead button: fall back to the external
      // browser so the redirect still happens.
    }
  }
  try {
    return await launchUrl(uri, mode: LaunchMode.externalApplication);
  } catch (_) {
    return false;
  }
}

void toast(BuildContext c, String msg, {bool error = false}) {
  ScaffoldMessenger.of(c)
    ..hideCurrentSnackBar()
    ..showSnackBar(SnackBar(
      content: Text(msg, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
      backgroundColor: error ? T1SColors.red : T1SColors.slate900,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 90),
    ));
}
