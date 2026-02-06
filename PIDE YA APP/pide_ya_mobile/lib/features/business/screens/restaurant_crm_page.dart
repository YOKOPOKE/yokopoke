import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:pide_ya_mobile/core/widgets/shimmer_card.dart';

class RestaurantCrmPage extends StatefulWidget {
  const RestaurantCrmPage({super.key});

  @override
  State<RestaurantCrmPage> createState() => _RestaurantCrmPageState();
}

class _RestaurantCrmPageState extends State<RestaurantCrmPage> {
  final _supabase = Supabase.instance.client;
  bool _loading = true;
  List<Map<String, dynamic>> _restaurants = [];

  @override
  void initState() {
    super.initState();
    _loadRestaurants();
  }

  Future<void> _loadRestaurants() async {
    // Logic: Fetch 'movimientos' of type 'PICKUP' (or similar) to find unique restaurants
    // For now, since we don't have a dedicated table, we will simulate or fetch from a 'partners' list if it exists.
    // Or we scan 'movimientos' descriptions for "Pickup en X".
    
    // Robustness: If no data, show empty state or mock for demo.
    setState(() => _loading = true);
    await Future.delayed(const Duration(seconds: 1)); // Mock network
    
    if (mounted) {
      setState(() {
        _restaurants = [
          {'name': 'Burgers King', 'pickups': 12, 'status': 'Plata'},
          {'name': 'Pizza Hot', 'pickups': 45, 'status': 'Oro'},
          {'name': 'Tacos El Paisa', 'pickups': 5, 'status': 'Bronce'},
        ];
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Mis Aliados (Restaurantes)")),
      body: _loading
          ? const Padding(padding: EdgeInsets.all(20), child: ShimmerCard(height: 100))
          : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _restaurants.length,
              itemBuilder: (context, index) {
                final r = _restaurants[index];
                return Card(
                  margin: const EdgeInsets.only(bottom: 12),
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: Colors.orange.shade100,
                      child: const Icon(Icons.store, color: Colors.orange),
                    ),
                    title: Text(r['name']),
                    subtitle: Text("${r['pickups']} Recolecciones"),
                    trailing: Chip(
                      label: Text(r['status']),
                      backgroundColor: _getStatusColor(r['status']).withOpacity(0.2),
                      labelStyle: TextStyle(color: _getStatusColor(r['status']), fontWeight: FontWeight.bold),
                    ),
                    onTap: () {
                      // TODO: Open detail to add points manually
                    },
                  ),
                );
              },
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
           // Add New Pickup Manually
           ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Próximamente: Escanear QR de Restaurante")));
        },
        child: const Icon(Icons.add_business),
      ),
    );
  }
  
  Color _getStatusColor(String status) {
    if (status == 'Oro') return Colors.amber;
    if (status == 'Plata') return Colors.grey;
    return Colors.brown;
  }
}
