class Client {
  final String id;
  final String name;
  final String phone;
  final int stamps;      // De tarjeta_lealtad.sellos_aumulados
  final bool hasReward;  // De tarjeta_lealtad.recompensa_disponible
  final int totalRedemptions; // De tarjeta_lealtad.total_canjes
  final DateTime registeredAt;

  Client({
    required this.id,
    required this.name,
    required this.phone,
    this.stamps = 0,
    this.hasReward = false,
    this.totalRedemptions = 0,
    required this.registeredAt,
  });

  // Factory para crear desde el JOIN de clientes + tarjeta_lealtad
  factory Client.fromMap(Map<String, dynamic> clientData, [Map<String, dynamic>? cardData]) {
    return Client(
      id: clientData['id'],
      name: clientData['nombre'] ?? 'Sin Nombre',
      phone: clientData['telefono'] ?? '',
      registeredAt: DateTime.parse(clientData['fecha_registro']),
      stamps: cardData?['sellos_aumulados'] ?? 0,
      hasReward: cardData?['recompensa_disponible'] ?? false,
      totalRedemptions: cardData?['total_canjes'] ?? 0,
    );
  }
}
