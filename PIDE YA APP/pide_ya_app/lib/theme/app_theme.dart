import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  static const primaryColor = Color(0xFFFF5722); // Deep Orange
  static const secondaryColor = Color(0xFF1E293B); // Slate 900
  static const backgroundColor = Color(0xFFF8FAFC); // Slate 50
  static const surfaceColor = Colors.white;

  static final textTheme = GoogleFonts.outfitTextTheme().copyWith(
    displayLarge: GoogleFonts.outfit(
      fontSize: 32,
      fontWeight: FontWeight.bold,
      color: secondaryColor,
    ),
    titleLarge: GoogleFonts.outfit(
      fontSize: 20,
      fontWeight: FontWeight.w600,
      color: secondaryColor,
    ),
    bodyMedium: GoogleFonts.inter(
      fontSize: 14,
      color: const Color(0xFF64748B), // Slate 500
    ),
  );

  static final lightTheme = ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(
      seedColor: primaryColor,
      primary: primaryColor,
      secondary: secondaryColor,
      surface: surfaceColor,
    ),
    scaffoldBackgroundColor: backgroundColor,
    textTheme: textTheme,
    appBarTheme: const AppBarTheme(
      backgroundColor: surfaceColor,
      elevation: 0,
      centerTitle: false,
      iconTheme: IconThemeData(color: secondaryColor),
      titleTextStyle: TextStyle(
        color: secondaryColor,
        fontSize: 20,
        fontWeight: FontWeight.bold,
        fontFamily: 'Outfit',
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: secondaryColor,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        textStyle: const TextStyle(
          fontWeight: FontWeight.bold,
          fontSize: 16,
        ),
      ),
    ),
  );
}
