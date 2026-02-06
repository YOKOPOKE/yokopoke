import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:provider/provider.dart';

// Core
import 'package:pide_ya_mobile/core/config/supabase_config.dart';
import 'package:pide_ya_mobile/core/theme/app_theme.dart';
import 'package:pide_ya_mobile/core/providers/theme_provider.dart';
import 'package:pide_ya_mobile/core/navigation/main_navigator.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  if (SupabaseConfig.isValid) {
      await Supabase.initialize(
          url: SupabaseConfig.url, anonKey: SupabaseConfig.anonKey);
  } else {
      debugPrint("WARNING: Supabase Config Missing. Run with --dart-define args.");
  }
  
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => ThemeProvider()),
      ],
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    
    if (!SupabaseConfig.isValid) {
      return MaterialApp(
        home: Scaffold(
          body: Center(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(Icons.error_outline, color: Colors.red, size: 60),
                  const SizedBox(height: 24),
                  const Text(
                    "Error de Configuración",
                    style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    "No se encontraron las credenciales de Supabase.\n\nAsegúrate de ejecutar la app con:\n--dart-define=SUPABASE_URL=...\n--dart-define=SUPABASE_ANON_KEY=...",
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return MaterialApp(
      title: 'Pide Ya Driver Pro',
      debugShowCheckedModeBanner: false,
      themeMode: themeProvider.themeMode,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      home: const MainNavigator(),
    );
  }
}
