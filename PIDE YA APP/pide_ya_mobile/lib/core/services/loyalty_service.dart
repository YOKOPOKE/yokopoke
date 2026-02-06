import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter/foundation.dart';

class LoyaltyService {
  final SupabaseClient _supabase;

  LoyaltyService(this._supabase);

  // --- Client History ---
  Future<List<Map<String, dynamic>>> fetchRecentHistory() async {
    try {
      final response = await _supabase
          .from('movimientos')
          .select('*')
          .order('fecha', ascending: false)
          .limit(10);
      return List<Map<String, dynamic>>.from(response);
    } catch (e) {
      debugPrint('Error fetching history: $e');
      rethrow;
    }
  }

  // --- Client Lookup ---
  Future<Map<String, dynamic>?> findClientByPhone(String phone) async {
    try {
      // 1. Try 'clientes'
      Map<String, dynamic>? data = await _supabase
          .from('clientes')
          .select('*, tarjeta_lealtad(*)')
          .eq('telefono', phone)
          .maybeSingle();

      // 2. Try 'restaurantes' if not found
      if (data == null) {
        final restaurantData = await _supabase
            .from('restaurantes')
            .select()
            .eq('telefono', phone)
            .maybeSingle();

        if (restaurantData != null) {
          data = Map<String, dynamic>.from(restaurantData);
          // Manually fetch loyalty card for restaurant
          final card = await _supabase
              .from('tarjeta_lealtad')
              .select()
              .eq('cliente_id', data['id'])
              .maybeSingle();

          if (card != null) {
            data['tarjeta_lealtad'] = card;
          }
        }
      }
      return data;
    } catch (e) {
      debugPrint('Error finding client: $e');
      rethrow;
    }
  }

  // --- Loyalty Card Management ---
  Future<Map<String, dynamic>> ensureLoyaltyCard(Map<String, dynamic> clientData) async {
    final rawCard = clientData['tarjeta_lealtad'];
    final existingCard = (rawCard is List && rawCard.isNotEmpty)
        ? rawCard.first
        : (rawCard is Map ? rawCard : null);

    if (existingCard != null) {
      return clientData;
    }

    // Create new card
    try {
      await _supabase.from('tarjeta_lealtad').insert({
        'cliente_id': clientData['id'],
        'sellos_aumulados': 0,
        'recompensa_disponible': false,
      });

      // Refetch card
      final card = await _supabase
          .from('tarjeta_lealtad')
          .select()
          .eq('cliente_id', clientData['id'])
          .single();

      final updatedClient = Map<String, dynamic>.from(clientData);
      updatedClient['tarjeta_lealtad'] = card;
      return updatedClient;
    } catch (e) {
      debugPrint('Error creating loyalty card: $e');
      rethrow;
    }
  }

  // --- Add Stamp / Transaction ---
  Future<void> addStamp({
    required String clientId,
    required String phone,
    required int newCount,
    double? latitude,
    double? longitude,
  }) async {
    final isReward = newCount >= 6;
    final cardUpdates = {
      'sellos_aumulados': newCount,
      'recompensa_disponible': isReward
    };

    // 1. Update/Upsert Card
    final existingCard = await _supabase
        .from('tarjeta_lealtad')
        .select()
        .eq('cliente_id', clientId)
        .maybeSingle();

    if (existingCard == null) {
      await _supabase.from('tarjeta_lealtad').insert({
        'cliente_id': clientId,
        ...cardUpdates
      });
    } else {
      await _supabase
          .from('tarjeta_lealtad')
          .update(cardUpdates)
          .eq('cliente_id', clientId);
    }

    // 2. Record Movement
    final desc = isReward ? "Canjeó Recompensa" : "Tiene $newCount Sellos";
    await _supabase.from('movimientos').insert({
      'cliente_id': clientId,
      'tipo': isReward ? 'REWARD' : 'STAMP',
      'descripcion': desc,
      'latitud': latitude,
      'longitud': longitude,
    });
  }

  // --- Analytics: Free Deliveries / Rewards Today ---
  Future<List<Map<String, dynamic>>> getDailyRewards() async {
    final now = DateTime.now();
    final startOfDay = DateTime(now.year, now.month, now.day).toIso8601String();
    
    // Fetch movements of type REWARD from today
    // We join with 'clientes' to get names if possible, 
    // but simplified query first:
    final response = await _supabase
        .from('movimientos')
        .select('*, clientes(nombre, telefono)') // Assuming FK exists, otherwise simplistic fetch
        .eq('tipo', 'REWARD')
        .gte('fecha', startOfDay) // 'fecha' probably timestamp
        .order('fecha', ascending: false);
        
    return List<Map<String, dynamic>>.from(response);
  }

  // --- Analytics: Top Loyal Clients ---
  Future<List<Map<String, dynamic>>> getTopClients() async {
    // Determine Top Clients by accumulated stamps
    final response = await _supabase
        .from('clientes')
        .select('nombre, telefono, tarjeta_lealtad(sellos_aumulados)')
        .order('tarjeta_lealtad(sellos_aumulados)', ascending: false) // Syntax might vary depending on PostgREST version
        .limit(5); // Top 5
        
    // Note: Cross-table ordering can be tricky in Supabase Dart client without RPC or specific setup.
    // If strict ordering fails, we might need to fetch cards and join manually or use a view.
    // Fallback approach if join sorting fails:
    
    // Fetch top cards first
    final topCards = await _supabase
      .from('tarjeta_lealtad')
      .select('*, clientes(nombre, telefono)')
      .order('sellos_aumulados', ascending: false)
      .limit(5);
      
      
    return List<Map<String, dynamic>>.from(topCards);
  }

  // --- Analytics: Weekly Income (From Orders) ---
  Future<List<double>> getWeeklyIncome() async {
    // 1. Calculate start of the week (Monday)
    final now = DateTime.now();
    // Monday = 1. Subtract (weekday - 1) days to get to Monday.
    final startOfWeek = now.subtract(Duration(days: now.weekday - 1));
    final startOfDay = DateTime(startOfWeek.year, startOfWeek.month, startOfWeek.day);
    
    // 2. Fetch orders from this week
    // We try to be compatible with both schema versions seen (total or total_amount)
    // We'll select both and coalesce in Dart
    try {
      final response = await _supabase
          .from('orders')
          .select('created_at, total, total_amount')
          .gte('created_at', startOfDay.toIso8601String())
          .neq('status', 'cancelled'); // Exclude cancelled
          
      final List<double> incomePerDay = List.filled(7, 0.0);
      
      for (final order in response) {
        final dateStr = order['created_at'] as String;
        final date = DateTime.parse(dateStr).toLocal();
        
        // standard total or total_amount
        final amount = (order['total'] ?? order['total_amount'] ?? 0);
        final val = (amount is int) ? amount.toDouble() : (amount as double);
        
        // Map 1(Mon)..7(Sun) to 0..6
        final dayIndex = date.weekday - 1; 
        if (dayIndex >= 0 && dayIndex < 7) {
          incomePerDay[dayIndex] += val;
        }
      }
      
      return incomePerDay;
    } catch (e) {
      debugPrint("Error fetching income: $e");
      return List.filled(7, 0.0);
    }
  }

  // --- Loyalty Max: Customer 360 Stats ---
  Future<Map<String, dynamic>> getCustomerStats(String clientId) async {
      try {
          // 1. Fetch total movements count (visits)
          final visits = await _supabase
              .from('movimientos')
              .select('id, created_at')
              .eq('cliente_id', clientId)
              .eq('tipo', 'STAMP')
              .count(CountOption.exact); // Just count
          
          final int visitCount = visits.count;

          // 2. Fetch last visit
          final lastMove = await _supabase
              .from('movimientos')
              .select('fecha')
              .eq('cliente_id', clientId)
              .order('fecha', ascending: false)
              .limit(1)
              .maybeSingle();
              
          // 3. Rewards earned lifetime
          final rewards = await _supabase
              .from('movimientos')
              .select('id')
              .eq('cliente_id', clientId)
              .eq('tipo', 'REWARD')
              .count(CountOption.exact);
          
          final int rewardsCount = rewards.count;

          // 4. Calculate Tier
          // 0-10: Bronze, 11-30: Silver, 30+: Gold
          String tier = 'BRONZE';
          if(visitCount > 30) tier = 'GOLD';
          else if(visitCount > 10) tier = 'SILVER';

          return {
              'visits': visitCount,
              'last_visit': lastMove != null ? lastMove['fecha'] : null,
              'rewards_claimed': rewardsCount,
              'tier': tier,
          };

      } catch (e) {
          debugPrint("Error fetching stats: $e");
          return {};
      }
  }

  // --- Loyalty Ultra: Client Notes ---
  Future<List<String>> getClientNotes(String clientId) async {
      try {
          final response = await _supabase
              .from('client_notes')
              .select('note')
              .eq('client_id', clientId)
              .order('created_at', ascending: false);
          
          return (response as List).map((e) => e['note'] as String).toList();
      } catch (e) {
          // If table doesn't exist yet, return empty to avoid crash
          return [];
      }
  }

  Future<void> addClientNote(String clientId, String note) async {
      await _supabase.from('client_notes').insert({
          'client_id': clientId,
          'note': note
      });
  }

  // --- Loyalty Mega: Profiles (Birthday & Tags) ---
  Future<Map<String, dynamic>> getClientProfile(String clientId) async {
      try {
          final data = await _supabase
              .from('client_profiles')
              .select()
              .eq('client_id', clientId)
              .maybeSingle();
          return data ?? {};
      } catch (e) {
          return {};
      }
  }

  Future<void> updateClientProfile({
      required String clientId, 
      String? birthDate, 
      List<String>? tags
  }) async {
      // Upsert profile
      final updates = {
          'client_id': clientId,
          if(birthDate != null) 'birth_date': birthDate,
          if(tags != null) 'tags': tags,
      };
      
      await _supabase.from('client_profiles').upsert(updates);
  }

  bool isBirthdayToday(String? dateStr) {
      if(dateStr == null) return false;
      final date = DateTime.parse(dateStr);
      final now = DateTime.now();
      return date.month == now.month && date.day == now.day;
  }
}
