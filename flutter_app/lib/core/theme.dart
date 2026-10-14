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
