import 'package:lucide_icons/lucide_icons.dart';
import 'package:flutter/widgets.dart';

class Activity {
  final String id;
  final String clientId;
  final String type; // 'sello_agregado', 'canje', etc.
  final String description;
  final DateTime date;
  final String? locationText;

  Activity({
    required this.id,
    required this.clientId,
    required this.type,
    required this.description,
    required this.date,
    this.locationText,
  });

  factory Activity.fromMap(Map<String, dynamic> map) {
    return Activity(
      id: map['id'],
      clientId: map['cliente_id'],
      type: map['tipo'] ?? 'unknown',
      description: map['descripcion'] ?? '',
      date: DateTime.parse(map['fecha']),
      locationText: map['ubicacion_texto'],
    );
  }

  // Helper para UI
  IconData get icon {
    switch (type.toLowerCase()) {
      case 'entrega':
      case 'sello':
        return LucideIcons.packageCheck;
      case 'canje':
      case 'recompensa':
        return LucideIcons.gift;
      default:
        return LucideIcons.activity;
    }
  }
}
