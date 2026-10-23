import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Try1Second brand theme — mirrors the website exactly:
/// white/slate cards, red-600 (#E11D48) accent, badge gradient
/// FB2C53 → E11D48 → 9F1239, gold ring #EAB308, Plus Jakarta Sans.
abstract final class T1SColors {
  // Brand
  static const red = Color(0xFFE7000B); // Tailwind red-600
  static const redLight = Color(0xFFFB2C36);
  static const redDark = Color(0xFFC10007);
  static const gold = Color(0xFFEAB308);
  static const goldLight = Color(0xFFFDE047);

  // Slate scale (site palette)
  static const slate50 = Color(0xFFF8FAFC);
  static const slate100 = Color(0xFFF1F5F9);
  static const slate200 = Color(0xFFE2E8F0);
  static const slate300 = Color(0xFFCBD5E1);
  static const slate400 = Color(0xFF94A3B8);
  static const slate500 = Color(0xFF64748B);
  static const slate600 = Color(0xFF475569);
  static const slate800 = Color(0xFF1E293B);
  static const slate900 = Color(0xFF0F172A);
  static const slate950 = Color(0xFF020617);

  static const ink = slate900;
  static const green = Color(0xFF16A34A);
  static const greenBg = Color(0xFFF0FDF4);
  static const greenBorder = Color(0xFFBBF7D0);

  // Tailwind emerald extras (web HomeShowcase accents: '% Off', badges, rating)
  static const emerald50 = Color(0xFFECFDF5);
  static const emerald200 = Color(0xFFA7F3D0);
  static const emerald700 = Color(0xFF047857);

  // Website dark hero + accent palette (HomeView / FixedBottomBar spec)
  static const heroBg = Color(0xFF0D0714);
  static const heroGrid = Color(0xFF2A1B40);
  static const redPillBg = Color(0xB3450A0A); // red-950/70
  static const redPillBorder = Color(0x99991B1B); // red-800/60
  static const red300 = Color(0xFFFCA5A5);
  static const red400 = Color(0xFFF87171);
  static const red500 = Color(0xFFEF4444);
  static const rose500 = Color(0xFFF43F5E);
  static const amber300 = Color(0xFFFCD34D);
  static const amber400 = Color(0xFFFBBF24);
  static const amber500 = Color(0xFFF59E0B);
  static const emerald400 = Color(0xFF34D399);
  static const emerald500 = Color(0xFF10B981);
  static const emerald600 = Color(0xFF059669);
  static const sky300 = Color(0xFF7DD3FC);
  static const sky400 = Color(0xFF38BDF8);
  static const blue600 = Color(0xFF2563EB);
  static const blue50 = Color(0xFFEFF6FF);
  static const orange500 = Color(0xFFF97316);
  static const orange600 = Color(0xFFEA580C);
  static const orange50 = Color(0xFFFFF7ED);
  static const red50 = Color(0xFFFEF2F2);
  static const red200 = Color(0xFFFECACA);
  static const slate700 = Color(0xFF334155);

  static const heroGradientText = LinearGradient(colors: [red500, rose500, amber400]);
  static const ctaGradient = LinearGradient(colors: [orange500, amber500]);

  static const badgeGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [redLight, red, redDark],
  );
}

/// Text styles with the site's bold/black weights.
abstract final class T1SText {
  static TextStyle display(BuildContext c) =>
      GoogleFonts.plusJakartaSans(fontSize: 28, fontWeight: FontWeight.w900, color: T1SColors.ink);

  static TextStyle headline(BuildContext c) =>
      GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w800, color: T1SColors.ink);

  static TextStyle title(BuildContext c) =>
      GoogleFonts.plusJakartaSans(fontSize: 14, fontWeight: FontWeight.w800, color: T1SColors.ink);

  static TextStyle body(BuildContext c) =>
      GoogleFonts.plusJakartaSans(fontSize: 12.5, fontWeight: FontWeight.w500, color: T1SColors.slate600);

  static TextStyle price(BuildContext c) =>
      GoogleFonts.plusJakartaSans(fontSize: 18, fontWeight: FontWeight.w900, color: T1SColors.ink);

  static TextStyle label(BuildContext c) =>
      GoogleFonts.plusJakartaSans(fontSize: 10.5, fontWeight: FontWeight.w800, color: T1SColors.slate500);
}

/// Light theme (site default).
ThemeData t1sLightTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.light,
    colorScheme: ColorScheme.light(
      primary: T1SColors.red,
      onPrimary: Colors.white,
      secondary: T1SColors.slate900,
      surface: Colors.white,
      onSurface: T1SColors.ink,
      error: const Color(0xFFDC2626),
    ),
    scaffoldBackgroundColor: T1SColors.slate50,
    dividerColor: T1SColors.slate200,
  );
  return base.copyWith(
    textTheme: GoogleFonts.plusJakartaSansTextTheme(base.textTheme),
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.white,
      foregroundColor: T1SColors.ink,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w900,
        color: T1SColors.ink,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      hintStyle: const TextStyle(color: T1SColors.slate400, fontSize: 13),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: T1SColors.slate200),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFFFDA4AF), width: 1.5),
      ),
    ),
  );
}

/// Dark theme (kept brand-true: slate-950 bg, same red accent).
ThemeData t1sDarkTheme() {
  final base = ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: ColorScheme.dark(
      primary: T1SColors.red,
      onPrimary: Colors.white,
      secondary: T1SColors.slate100,
      surface: T1SColors.slate900,
      onSurface: T1SColors.slate100,
      error: const Color(0xFFF87171),
    ),
    scaffoldBackgroundColor: T1SColors.slate950,
    dividerColor: const Color(0xFF1E293B),
  );
  return base.copyWith(
    textTheme: GoogleFonts.plusJakartaSansTextTheme(base.textTheme),
    appBarTheme: const AppBarTheme(
      backgroundColor: T1SColors.slate900,
      foregroundColor: T1SColors.slate100,
      elevation: 0,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: T1SColors.slate900,
      hintStyle: const TextStyle(color: T1SColors.slate500, fontSize: 13),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: Color(0xFF334155)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: T1SColors.red, width: 1.5),
      ),
    ),
  );
}


/// Per-vertical search surface colors — web SearchAndFilterHeader parity (21 Oct).
/// hotels #003580 (Booking blue), bus #d84e55, food #fc8019, grocery emerald/teal,
/// cab slate-950, ecommerce #232f3e, movie #333545, loans indigo-950,
/// insurance #0f3d64, account red-950, creditcards rose-950, flights slate-100.
class T1SSearchSurface {
  final int bg;
  final int accent;
  final bool dark;
  const T1SSearchSurface(this.bg, this.accent, {this.dark = true});

  static const Map<String, T1SSearchSurface> map = {
    'flights': T1SSearchSurface(0xFFF1F5F9, 0xFF64748B, dark: false),
    'hotels': T1SSearchSurface(0xFF003580, 0xFFFCD34D),
    'bus': T1SSearchSurface(0xFFD84E55, 0xFFFDE68A),
    'cab': T1SSearchSurface(0xFF0B1220, 0xFFFBBF24),
    'food': T1SSearchSurface(0xFFFC8019, 0xFFFFF7ED),
    'grocery': T1SSearchSurface(0xFF0F766E, 0xFFA7F3D0),
    'ecommerce': T1SSearchSurface(0xFF232F3E, 0xFFFBBF24),
    'movie': T1SSearchSurface(0xFF333545, 0xFFF87171),
    'loans': T1SSearchSurface(0xFF1E1B4B, 0xFFFCD34D),
    'insurance': T1SSearchSurface(0xFF0F3D64, 0xFF6EE7B7),
    'account': T1SSearchSurface(0xFF450A0A, 0xFFFCA5A5),
    'creditcards': T1SSearchSurface(0xFF4C0519, 0xFFFDA4AF),
  };

  static T1SSearchSurface of(String id) =>
      map[id] ?? const T1SSearchSurface(0xFFFFFFFF, 0xFF64748B, dark: false);
}
