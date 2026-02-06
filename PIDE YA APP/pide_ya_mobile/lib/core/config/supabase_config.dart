class SupabaseConfig {
  // Run with: flutter run --dart-define=SUPABASE_URL=... --dart-define=SUPABASE_ANON_KEY=...
  // Hardcoded for direct build ease-of-use (User Request)
  static const String url = String.fromEnvironment('SUPABASE_URL', defaultValue: 'https://xmayprmxlorhqomypqyb.supabase.co');
  static const String anonKey = String.fromEnvironment('SUPABASE_ANON_KEY', defaultValue: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtYXlwcm14bG9yaHFvbXlwcXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjkxMTkzODksImV4cCI6MjA4NDY5NTM4OX0.eS8DWDJ9pAZr3uTzhqprUjORR0q91xGZcPK1w5IOy7s');

  static bool get isValid => true; // Always valid with defaults
}
