import '../models/client_model.dart';
import '../models/activity_model.dart';

class MockDataService {
  static final List<Client> _clients = [
    Client(id: '1', name: 'Juan Pérez', phone: '+52 55 1234 5678', points: 150, totalOrders: 12, lastActive: DateTime.now().subtract(const Duration(minutes: 5))),
    Client(id: '2', name: 'María González', phone: '+52 55 8765 4321', points: 340, totalOrders: 25, lastActive: DateTime.now().subtract(const Duration(hours: 2))),
    Client(id: '3', name: 'Carlos López', phone: '+52 55 5555 5555', points: 50, totalOrders: 4, lastActive: DateTime.now().subtract(const Duration(days: 1))),
    Client(id: '4', name: 'Ana Martínez', phone: '+52 55 9999 8888', points: 890, totalOrders: 45, lastActive: DateTime.now().subtract(const Duration(days: 2))),
    Client(id: '5', name: 'Pedro Sánchez', phone: '+52 55 1111 2222', points: 10, totalOrders: 1, lastActive: DateTime.now().subtract(const Duration(days: 5))),
    Client(id: '6', name: 'Laura Torres', phone: '+52 55 3333 4444', points: 200, totalOrders: 18, lastActive: DateTime.now().subtract(const Duration(days: 0, hours: 4))),
  ];

  static final List<Activity> _activities = [
    Activity(id: 'a1', clientId: '1', clientName: 'Juan Pérez', type: ActivityType.delivery, description: 'Entrega completada', timestamp: DateTime.now().subtract(const Duration(minutes: 5)), pointsChange: 10),
    Activity(id: 'a2', clientId: '2', clientName: 'María González', type: ActivityType.redemption, description: 'Canje de cupón', timestamp: DateTime.now().subtract(const Duration(hours: 2)), pointsChange: -100),
    Activity(id: 'a3', clientId: '6', clientName: 'Laura Torres', type: ActivityType.delivery, description: 'Entrega completada', timestamp: DateTime.now().subtract(const Duration(hours: 4)), pointsChange: 15),
    Activity(id: 'a4', clientId: '4', clientName: 'Ana Martínez', type: ActivityType.manualPoints, description: 'Ajuste manual (+50pts)', timestamp: DateTime.now().subtract(const Duration(days: 1)), pointsChange: 50),
    Activity(id: 'a5', clientId: '1', clientName: 'Juan Pérez', type: ActivityType.delivery, description: 'Entrega completada', timestamp: DateTime.now().subtract(const Duration(days: 1, hours: 2)), pointsChange: 10),
  ];

  static List<Activity> getRecentActivity() {
    _activities.sort((a, b) => b.timestamp.compareTo(a.timestamp));
    return _activities.take(5).toList();
  }

  static List<Client> searchClients(String query) {
    if (query.isEmpty) return _clients;
    final lowerQuery = query.toLowerCase();
    return _clients.where((c) => 
      c.name.toLowerCase().contains(lowerQuery) || 
      c.phone.contains(query)
    ).toList();
  }

  static Client? getClientById(String id) {
    try {
      return _clients.firstWhere((c) => c.id == id);
    } catch (_) {
      return null;
    }
  }

  // Simular agregar puntos
  static void addPoints(String clientId, int points) {
    final index = _clients.indexWhere((c) => c.id == clientId);
    if (index != -1) {
      final client = _clients[index];
      _clients[index] = Client(
        id: client.id,
        name: client.name,
        phone: client.phone,
        points: client.points + points,
        totalOrders: client.totalOrders, // No aumenta órdenes, solo puntos manuales
        lastActive: DateTime.now(),
        avatarUrl: client.avatarUrl
      );
      
      _activities.insert(0, Activity(
        id: DateTime.now().toString(),
        clientId: client.id,
        clientName: client.name,
        type: ActivityType.manualPoints,
        description: 'Puntos agregados manual',
        timestamp: DateTime.now(),
        pointsChange: points
      ));
    }
  }
}
