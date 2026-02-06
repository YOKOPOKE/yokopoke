import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

// Imports de nuestras features
import 'theme/app_theme.dart';
import 'features/dashboard/dashboard_screen.dart';
import 'features/scanner/scanner_screen.dart';
import 'features/clients/clients_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Inicialización de Supabase con credenciales reales
  await Supabase.initialize(
    url: 'https://xmayprmxlorhqomypqyb.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtYXlwcm14bG9yaHFvbXlwcXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTkzODksImV4cCI6MjA4NDY5NTM4OX0.eS8DWDJ9pAZr3uTzhqprUjORR0q91xGZcPK1w5IOy7s',
  );

  runApp(const PideYaAdminApp());
}

final _router = GoRouter(
  initialLocation: '/',
  routes: [
    GoRoute(
      path: '/',
      builder: (context, state) => const DashboardScreen(),
    ),
    GoRoute(
      path: '/scan',
      builder: (context, state) => const ScannerScreen(),
    ),
    GoRoute(
      path: '/clients',
      builder: (context, state) => const ClientsScreen(),
    ),
  ],
);

class PideYaAdminApp extends StatelessWidget {
  const PideYaAdminApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Pide Ya Admin',
      theme: AppTheme.lightTheme,
      routerConfig: _router,
      debugShowCheckedModeBanner: false,
    );
  }
}
