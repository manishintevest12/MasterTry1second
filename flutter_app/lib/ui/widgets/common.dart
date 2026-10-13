import 'package:flutter/material.dart';

import '../../core/theme.dart';
import '../../core/verticals.dart';

/// Section header (site-style: small bold caps label + optional trailing).
class SectionHeader extends StatelessWidget {
  const SectionHeader(this.label, {super.key, this.trailing});

  final String label;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(4, 0, 4, 10),
      child: Row(
        children: [
          Expanded(
            child: Text(label,
                style: T1SText.label(context)
                    .copyWith(letterSpacing: 0.6, color: T1SColors.slate600)),
          ),
          if (trailing != null) trailing!,
        ],
      ),
    );
  }
}

/// Site-style white card with slate border.
class T1SCard extends StatelessWidget {
  const T1SCard({super.key, required this.child, this.padding, this.onTap});

  final Widget child;
  final EdgeInsets? padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return Material(
      color: dark ? T1SColors.slate900 : Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: padding ?? const EdgeInsets.all(14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: dark ? const Color(0xFF334155) : T1SColors.slate200),
          ),
          child: child,
        ),
      ),
    );
  }
}

/// Brand pill button (red gradient) + secondary outline button.
class T1SButton extends StatelessWidget {
  const T1SButton.primary({super.key, required this.label, this.onTap, this.icon})
      : _filled = true;
  const T1SButton.secondary({super.key, required this.label, this.onTap, this.icon})
      : _filled = false;

  final String label;
  final VoidCallback? onTap;
  final Widget? icon;
  final bool _filled;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    final child = Row(
      mainAxisSize: MainAxisSize.min,
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        if (icon != null) ...[icon!, const SizedBox(width: 6)],
        Text(label,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w800,
              color: _filled
                  ? Colors.white
                  : (dark ? T1SColors.slate100 : T1SColors.ink),
            )),
      ],
    );
    return _filled
        ? Material(
            color: Colors.transparent,
            child: Ink(
              decoration: BoxDecoration(gradient: T1SColors.badgeGradient, borderRadius: BorderRadius.circular(12)),
              child: InkWell(
                borderRadius: BorderRadius.circular(12),
                onTap: onTap,
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
                  child: child,
                ),
              ),
            ),
          )
        : OutlinedButton(
            onPressed: onTap,
            style: OutlinedButton.styleFrom(
              side: BorderSide(color: dark ? const Color(0xFF334155) : T1SColors.slate300),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
            ),
            child: child,
          );
  }
}

/// Honest status / empty-state block.
class HonestNote extends StatelessWidget {
  const HonestNote(this.text, {super.key, this.loading = false});

  final String text;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 4),
      child: Row(
        children: [
          if (loading) ...[
            const SizedBox(
              width: 13,
              height: 13,
              child: CircularProgressIndicator(strokeWidth: 2.2, color: T1SColors.red),
            ),
            const SizedBox(width: 10),
          ],
          Expanded(
            child: Text(text, style: T1SText.body(context).copyWith(color: T1SColors.slate400)),
          ),
        ],
      ),
    );
  }
}

/// Vertical chip used in the home grid.
class VerticalTile extends StatelessWidget {
  const VerticalTile({super.key, required this.vertical, required this.onTap});

  final VerticalMeta vertical;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return T1SCard(
      onTap: onTap,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: dark ? const Color(0xFF1E293B) : T1SColors.slate50,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(vertical.icon, size: 20, color: T1SColors.red),
          ),
          const SizedBox(height: 8),
          Text(vertical.name, style: T1SText.title(context)),
          const SizedBox(height: 3),
          Text(
            vertical.description,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: T1SText.body(context).copyWith(fontSize: 10.5, color: T1SColors.slate400),
          ),
        ],
      ),
    );
  }
}
