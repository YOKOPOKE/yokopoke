import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/client_model.dart';
import '../models/activity_model.dart';

class SupabaseService {
  static final _supabase = Supabase.instance.client;

  // Obtener actividades recientes (movimientos + clientes join)
  static Future<List<Activity>> getRecentActivity() async {
    try {
      final response = await _supabase
          .from('movimientos')
          .select('*, clientes(nombre)')
          .order('fecha', ascending: false)
          .limit(10); // Traemos más para asegurar

      // Mapear respuesta
      // Nota: Supabase devuelve List<Map<String, dynamic>>
      return (response as List).map((e) {
        // Podríamos inyectar el nombre del cliente en la descripción si queremos
        return Activity.fromMap(e);
      }).toList();
    } catch (e) {
      print('Error fetching activity: $e');
      return [];
    }
  }

  // Buscar clientes por teléfono o nombre
  static Future<List<Client>> searchClients(String query) async {
    try {
      final response = await _supabase
          .from('clientes')
          .select('*, tarjeta_lealtad(*)') // Traemos la tarjeta vinculada
          .or('nombre.ilike.%$query%,telefono.ilike.%$query%')
          .limit(20);

      return (response as List).map((e) {
        // Extraer datos de la tarjeta (puede ser una lista o objeto único dependiendo de la relación)
        // Asumimos relación 1-1, supabase devuelve tarjeta_lealtad como objeto o lista
        Map<String, dynamic>? cardData;
        if (e['tarjeta_lealtad'] != null) {
            if (e['tarjeta_lealtad'] is List && (e['tarjeta_lealtad'] as List).isNotEmpty) {
                 cardData = e['tarjeta_lealtad'][0];
            } else if (e['tarjeta_lealtad'] is Map) {
                 cardData = e['tarjeta_lealtad'];
            }
        }
        
        return Client.fromMap(e, cardData);
      }).toList();
    } catch (e) {
      print('Error searching clients: $e');
      return [];
    }
  }

  // Obtener cliente por ID (usado al escanear QR)
  static Future<Client?> getClientById(String id) async {
    try {
      final response = await _supabase
          .from('clientes')
          .select('*, tarjeta_lealtad(*)')
          .eq('id', id)
          .maybeSingle();

      if (response == null) return null;

      Map<String, dynamic>? cardData;
       if (response['tarjeta_lealtad'] != null) {
            if (response['tarjeta_lealtad'] is List && (response['tarjeta_lealtad'] as List).isNotEmpty) {
                 cardData = response['tarjeta_lealtad'][0];
            } else if (response['tarjeta_lealtad'] is Map) {
                 cardData = response['tarjeta_lealtad'];
            }
        }

      return Client.fromMap(response, cardData);
    } catch (e) {
      print('Error getting client: $e');
      return null;
    }
  }

  // Agregar sello (Transacción: Update tarjeta + Insert movimiento)
  static Future<bool> addStamp(String clientId, String? repartidorId) async {
    try {
      // 1. Obtener tarjeta actual
      final cardRes = await _supabase
          .from('tarjeta_lealtad')
          .select()
          .eq('cliente_id', clientId)
          .single();
      
      final currentStamps = cardRes['sellos_aumulados'] as int;
      final newStamps = currentStamps + 1;
      // Lógica simple: cada 10 sellos, recompensa disponible (ejemplo)
      final hasReward = newStamps >= 10; 

      // 2. Actualizar tarjeta
      await _supabase.from('tarjeta_lealtad').update({
        'sellos_aumulados': newStamps,
        'recompensa_disponible': hasReward, // O la lógica que tengas
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('cliente_id', clientId);

      // 3. Registrar movimiento
      await _supabase.from('movimientos').insert({
        'cliente_id': clientId,
        'tipo': 'Sello',
        'fecha': DateTime.now().toIso8601String(),
        'descripcion': 'Sello agregado por QR',
        'repartidor_id': repartidorId, // Opcional si lo tenemos
        // 'latitud': ... (si tuviéramos)
      });

      return true;
    } catch (e) {
      print('Error adding stamp: $e');
      return false;
    }
  }
}
