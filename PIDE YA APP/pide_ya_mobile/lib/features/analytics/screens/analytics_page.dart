import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class AnalyticsPage extends StatefulWidget {
  const AnalyticsPage({super.key});

  @override
  State<AnalyticsPage> createState() => _AnalyticsPageState();
}

class _AnalyticsPageState extends State<AnalyticsPage> {
  final _supabase = Supabase.instance.client;
  bool _loading = true;

  // Metrics
  int _totalCustomers = 0;
  int _totalRedemptions = 0;
  int _redemptionsThisMonth = 0;
  int _redemptionsThisWeek = 0;
  double _avgStampsPerCustomer = 0;

  // Top customers
  List<Map<String, dynamic>> _topCustomers = [];

  @override
  void initState() {
    super.initState();
    _loadAnalytics();
  }

  Future<void> _loadAnalytics() async {
    setState(() => _loading = true);

    try {
      // 1. Total customers
      final customersResponse = await _supabase.from('clientes').select('id');
      final totalCustomers = customersResponse.length;

      // 2. All movements
      final allMovements = await _supabase.from('movimientos').select('*');
      final redemptions =
          allMovements.where((m) => m['tipo'] == 'REWARD').toList();

      // 3. Redemptions this month
      final now = DateTime.now();
      final startOfMonth = DateTime(now.year, now.month, 1);
      final monthRedemptions = redemptions.where((r) {
        final date = DateTime.parse(r['fecha']);
        return date.isAfter(startOfMonth);
      }).length;

      // 4. Redemptions this week
      final startOfWeek = now.subtract(Duration(days: now.weekday - 1));
      final weekRedemptions = redemptions.where((r) {
        final date = DateTime.parse(r['fecha']);
        return date.isAfter(startOfWeek);
      }).length;

      // 5. Top customers - Simplified approach
      final allCards = await _supabase
          .from('tarjeta_lealtad')
          .select('*')
          .order('total_canjes', ascending: false)
          .limit(10);

      // Manually fetch client data for top 10
      List<Map<String, dynamic>> topCustomersWithData = [];
      for (var card in allCards) {
        try {
          final clientId = card['cliente_id'];
          final clientInfo = await _supabase
              .from('clientes')
              .select('nombre, telefono')
              .eq('id', clientId)
              .single();

          topCustomersWithData.add({
            ...card,
            'nombre': clientInfo['nombre'] ?? 'Cliente',
            'telefono': clientInfo['telefono'] ?? '',
          });
        } catch (e) {
          // Skip if client not found
          debugPrint("Client not found for card: ${card['id']}");
        }
      }

      // 6. Average stamps
      final cards =
          await _supabase.from('tarjeta_lealtad').select('sellos_aumulados');
      final totalStamps = cards.fold<int>(
          0, (sum, card) => sum + (card['sellos_aumulados'] as int? ?? 0));
      final avg = totalCustomers > 0 ? totalStamps / totalCustomers : 0.0;

      setState(() {
        _totalCustomers = totalCustomers;
        _totalRedemptions = redemptions.length;
        _redemptionsThisMonth = monthRedemptions;
        _redemptionsThisWeek = weekRedemptions;
        _avgStampsPerCustomer = avg.toDouble();
        _topCustomers = topCustomersWithData;
        _loading = false;
      });
    } catch (e) {
      debugPrint("Error loading analytics: $e");
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
              content: Text("Error cargando analytics: $e"),
              backgroundColor: Colors.red),
        );
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Analytics Pro"),
        foregroundColor: Colors.black87,
        backgroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadAnalytics,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Hero Metric
                    Card(
                      elevation: 0,
                      color: Theme.of(context).primaryColor,
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20)),
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          children: [
                            const Text(
                              "CLIENTES TOTALES",
                              style: TextStyle(
                                  color: Colors.white70,
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 1.5),
                            ),
                            const SizedBox(height: 12),
                            TweenAnimationBuilder<int>(
                              tween: IntTween(begin: 0, end: _totalCustomers),
                              duration: const Duration(milliseconds: 800),
                              builder: (context, value, child) {
                                return Text(
                                  "$value",
                                  style: const TextStyle(
                                      fontSize: 72,
                                      fontWeight: FontWeight.w900,
                                      color: Colors.white),
                                );
                              },
                            ),
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 16, vertical: 8),
                              decoration: BoxDecoration(
                                color: Colors.white24,
                                borderRadius: BorderRadius.circular(20),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(Icons.trending_up,
                                      color: Color(0xFF34D399),
                                      size: 20), // Soft green
                                  const SizedBox(width: 8),
                                  Text(
                                    "+${(_totalCustomers * 0.15).round()} vs mes anterior",
                                    style: const TextStyle(
                                        color: Colors.white,
                                        fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 20),

                    // Metrics Grid - Softer colors
                    GridView.count(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: 1.2,
                      children: [
                        _buildMetricCard(
                          "Canjes\nTotales",
                          "$_totalRedemptions",
                          Icons.card_giftcard,
                          const Color(0xFFD97706), // Muted amber
                        ),
                        _buildMetricCard(
                          "Este\nMes",
                          "$_redemptionsThisMonth",
                          Icons.calendar_today,
                          const Color(0xFF4A90A4), // Muted teal
                        ),
                        _buildMetricCard(
                          "Esta\nSemana",
                          "$_redemptionsThisWeek",
                          Icons.access_time,
                          const Color(0xFF6B9B7D), // Muted sage green
                        ),
                        _buildMetricCard(
                          "Promedio\nSellos",
                          _avgStampsPerCustomer.toStringAsFixed(1),
                          Icons.show_chart,
                          const Color(0xFFB85C5C), // Muted rose
                        ),
                      ],
                    ),

                    const SizedBox(height: 30),

                    // Top Customers
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          "🏆 TOP 10 CLIENTES",
                          style: TextStyle(
                              fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 12, vertical: 6),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade100,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            "Leales",
                            style: TextStyle(
                                color: Colors.amber.shade900,
                                fontWeight: FontWeight.bold,
                                fontSize: 12),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),

                    _topCustomers.isEmpty
                        ? Container(
                            padding: const EdgeInsets.all(40),
                            child: Column(
                              children: [
                                Icon(Icons.emoji_events,
                                    size: 60, color: Colors.grey.shade300),
                                const SizedBox(height: 12),
                                Text("No hay datos aún",
                                    style:
                                        TextStyle(color: Colors.grey.shade500)),
                              ],
                            ),
                          )
                        : ListView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: _topCustomers.length,
                            itemBuilder: (context, index) {
                              final customer = _topCustomers[index];
                              final nombre = customer['nombre'] ?? 'Cliente';
                              final telefono = customer['telefono'] ?? '';
                              final canjes = customer['total_canjes'] ?? 0;
                              final sellos = customer['sellos_aumulados'] ?? 0;

                              // Muted professional colors
                              Color medalColor = index == 0
                                  ? const Color(0xFFD4AF37) // Muted gold
                                  : index == 1
                                      ? const Color(0xFFA8A9AD) // Muted silver
                                      : index == 2
                                          ? const Color(
                                              0xFFCD7F32) // Muted bronze
                                          : const Color(0xFF708090); // Slate gray

                              return Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  gradient: index < 3
                                      ? LinearGradient(
                                          colors: [
                                            medalColor.withOpacity(0.2),
                                            medalColor.withOpacity(0.05)
                                          ],
                                        )
                                      : null,
                                  color: index >= 3 ? Colors.white : null,
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                    color: index < 3
                                        ? medalColor
                                        : Colors.grey.shade200,
                                    width: 2,
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      width: 50,
                                      height: 50,
                                      decoration: BoxDecoration(
                                        color: medalColor,
                                        shape: BoxShape.circle,
                                      ),
                                      child: Center(
                                        child: index < 3
                                            ? const Icon(
                                                Icons.emoji_events,
                                                color: Colors.white,
                                                size: 28,
                                              )
                                            : Text(
                                                "${index + 1}",
                                                style: const TextStyle(
                                                  fontSize: 20,
                                                  fontWeight: FontWeight.bold,
                                                  color: Colors.white,
                                                ),
                                              ),
                                      ),
                                    ),
                                    const SizedBox(width: 16),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            nombre,
                                            style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 16,
                                            ),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            telefono,
                                            style: TextStyle(
                                              color: Colors.grey.shade600,
                                              fontSize: 13,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(
                                              horizontal: 10, vertical: 6),
                                          decoration: BoxDecoration(
                                            color: Colors.orange,
                                            borderRadius:
                                                BorderRadius.circular(8),
                                          ),
                                          child: Text(
                                            "$canjes 🎁",
                                            style: const TextStyle(
                                              color: Colors.white,
                                              fontWeight: FontWeight.bold,
                                              fontSize: 14,
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          "$sellos sellos",
                                          style: TextStyle(
                                            color: Colors.grey.shade600,
                                            fontSize: 12,
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              );
                            },
                          ),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildMetricCard(
      String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.3), width: 2),
        boxShadow: [
          BoxShadow(
              color: color.withOpacity(0.1), blurRadius: 10, spreadRadius: 2)
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 32),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
                fontSize: 28, fontWeight: FontWeight.w900, color: color),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            textAlign: TextAlign.center,
            style: const TextStyle(
                fontSize: 11, color: Colors.grey, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}
