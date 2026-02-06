import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:pide_ya_mobile/features/auth/widgets/qr_dialog.dart';

class CustomerProfilePage extends StatefulWidget {
  final String phoneNumber;

  const CustomerProfilePage({super.key, required this.phoneNumber});

  @override
  State<CustomerProfilePage> createState() => _CustomerProfilePageState();
}

class _CustomerProfilePageState extends State<CustomerProfilePage> {
  final _supabase = Supabase.instance.client;
  bool _loading = true;

  Map<String, dynamic>? _customerData;
  Map<String, dynamic>? _loyaltyCard;
  List<Map<String, dynamic>> _fullHistory = [];

  // Stats
  int _totalRedemptions = 0;
  int _currentStamps = 0;
  int _totalStampsEver = 0;
  String? _lastVisit;

  @override
  void initState() {
    super.initState();
    _loadCustomerData();
  }

  Future<void> _loadCustomerData() async {
    setState(() => _loading = true);

    try {
      // 1. Customer info
      final customer = await _supabase
          .from('clientes')
          .select()
          .eq('telefono', widget.phoneNumber)
          .maybeSingle();

      if (customer == null) {
        if (mounted) {
          _showError("Cliente no encontrado");
          Navigator.pop(context);
        }
        return;
      }

      // 2. Loyalty card
      final card = await _supabase
          .from('tarjeta_lealtad')
          .select()
          .eq('cliente_id', customer['id'])
          .maybeSingle();

      // 3. Full history
      final history = await _supabase
          .from('movimientos')
          .select()
          .eq('cliente_id', customer['id'])
          .order('fecha', ascending: false);

      // Calculate stats
      final redemptions =
          (history as List).where((h) => h['tipo'] == 'REWARD').length;
      final stamps = (history).where((h) => h['tipo'] == 'STAMP').toList();
      final totalStamps = stamps.fold<int>(0, (sum, item) {
        // Extract number from description like "Asignó 3 Sellos"
        final match = RegExp(r'(\d+)').firstMatch(item['descripcion'] ?? '');
        return sum + (match != null ? int.parse(match.group(0)!) : 0);
      });

      setState(() {
        _customerData = customer;
        _loyaltyCard = card;
        _fullHistory = List<Map<String, dynamic>>.from(history);
        _totalRedemptions = redemptions;
        _currentStamps = card?['sellos_aumulados'] ?? 0;
        _totalStampsEver = totalStamps;
        _lastVisit = history.isNotEmpty ? history.first['fecha'] : null;
        _loading = false;
      });
    } catch (e) {
      if (mounted) {
        _showError("Error cargando datos: $e");
        setState(() => _loading = false);
      }
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: Colors.red),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_customerData?['nombre'] ?? 'Cliente'),
        foregroundColor: Colors.black87,
        backgroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadCustomerData,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Header Card
                    Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            _getLevelColor().withOpacity(0.8),
                            _getLevelColor()
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                              color: _getLevelColor().withOpacity(0.3),
                              blurRadius: 15,
                              spreadRadius: 2)
                        ],
                      ),
                      child: Column(
                        children: [
                          CircleAvatar(
                            radius: 50,
                            backgroundColor: Colors.white,
                            child: Text(
                              (_customerData?['nombre'] ?? 'C')[0]
                                  .toUpperCase(),
                              style: TextStyle(
                                  fontSize: 40,
                                  fontWeight: FontWeight.bold,
                                  color: _getLevelColor()),
                            ),
                          ),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                _customerData?['nombre'] ?? 'Cliente',
                                style: const TextStyle(
                                    fontSize: 28,
                                    fontWeight: FontWeight.bold,
                                    color: Colors.white),
                              ),
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                    color: Colors.white24,
                                    borderRadius: BorderRadius.circular(8)),
                                child: Text(
                                  _getLoyaltyLevel(),
                                  style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12),
                                ),
                              )
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            widget.phoneNumber,
                            style: const TextStyle(
                                fontSize: 16,
                                color: Colors.white70,
                                fontFamily: 'monospace'),
                          ),
                          if (_customerData?['direccion'] != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 4),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.location_on,
                                      size: 14, color: Colors.white70),
                                  const SizedBox(width: 4),
                                  Text(
                                    _customerData!['direccion'],
                                    style: const TextStyle(
                                        color: Colors.white70, fontSize: 14),
                                  ),
                                ],
                              ),
                            ),
                          const SizedBox(height: 12),
                          // Botones de acción
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              _buildActionButton(
                                  "QR",
                                  Icons.qr_code,
                                  Colors.white,
                                  Colors.white24, () {
                                showGeneralDialog(
                                  context: context,
                                  barrierDismissible: true,
                                  barrierLabel: '',
                                  pageBuilder: (ctx, a1, a2) => Container(),
                                  transitionBuilder: (ctx, a1, a2, child) {
                                    return Transform.scale(
                                      scale: a1.value,
                                      child: Opacity(
                                        opacity: a1.value,
                                        child: QRDisplayDialog(
                                          qrData: widget.phoneNumber,
                                          entityType: 'CLIENTE',
                                          phone: widget.phoneNumber,
                                        ),
                                      ),
                                    );
                                  },
                                );
                              }),
                            ],
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Stats Grid
                    GridView.count(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: 1.3,
                      children: [
                        _buildStatBox(
                          "Sellos Actuales",
                          "$_currentStamps",
                          Icons.card_giftcard,
                          Colors.purple,
                        ),
                        _buildStatBox(
                          "Canjes Totales",
                          "$_totalRedemptions",
                          Icons.star,
                          Colors.orange,
                        ),
                        _buildStatBox(
                          "Sellos Históricos",
                          "$_totalStampsEver",
                          Icons.history,
                          Colors.blue,
                        ),
                        _buildStatBox(
                          "Lealtad",
                          "${_calculateLoyaltyScore()}%",
                          Icons.favorite,
                          Colors.red,
                        ),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Progress to next reward
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            "Progreso a Envío Gratis",
                            style: TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          const SizedBox(height: 12),
                          Row(
                            children: [
                              Expanded(
                                child: ClipRRect(
                                  borderRadius: BorderRadius.circular(8),
                                  child: LinearProgressIndicator(
                                    value: _currentStamps / 6,
                                    minHeight: 12,
                                    backgroundColor: Colors.grey.shade200,
                                    valueColor: AlwaysStoppedAnimation(
                                      _currentStamps >= 5
                                          ? Colors.orange
                                          : Colors.purple,
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Text(
                                "$_currentStamps/6",
                                style: const TextStyle(
                                    fontWeight: FontWeight.bold, fontSize: 16),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            _currentStamps >= 6
                                ? "¡Tiene recompensa disponible! 🎉"
                                : "Faltan ${6 - _currentStamps} sellos",
                            style: TextStyle(
                              color: _currentStamps >= 6
                                  ? Colors.green
                                  : Colors.grey.shade600,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 24),

                    // History Timeline
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text(
                          "HISTORIAL COMPLETO",
                          style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                              letterSpacing: 1),
                        ),
                        Text(
                          "${_fullHistory.length} movimientos",
                          style: TextStyle(
                              color: Colors.grey.shade600, fontSize: 12),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),

                    _fullHistory.isEmpty
                        ? Container(
                            padding: const EdgeInsets.all(40),
                            child: Column(
                              children: [
                                Icon(Icons.inbox,
                                    size: 60, color: Colors.grey.shade300),
                                const SizedBox(height: 12),
                                Text(
                                  "Sin movimientos aún",
                                  style: TextStyle(color: Colors.grey.shade500),
                                ),
                              ],
                            ),
                          )
                        : ListView.builder(
                            shrinkWrap: true,
                            physics: const NeverScrollableScrollPhysics(),
                            itemCount: _fullHistory.length,
                            itemBuilder: (context, index) {
                              final item = _fullHistory[index];
                              final isReward = item['tipo'] == 'REWARD';
                              final lat = item['latitud'];
                              final lng = item['longitud'];

                              return Container(
                                margin: const EdgeInsets.only(bottom: 12),
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  color: isReward
                                      ? Colors.orange.shade50
                                      : Colors.blue.shade50,
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: isReward
                                        ? Colors.orange.shade200
                                        : Colors.blue.shade200,
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: isReward
                                            ? Colors.orange
                                            : Colors.blue,
                                        shape: BoxShape.circle,
                                      ),
                                      child: Icon(
                                        isReward
                                            ? Icons.card_giftcard
                                            : Icons.add_circle,
                                        color: Colors.white,
                                        size: 24,
                                      ),
                                    ),
                                    const SizedBox(width: 16),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            item['descripcion'] ?? 'Movimiento',
                                            style: const TextStyle(
                                              fontWeight: FontWeight.bold,
                                              fontSize: 15,
                                            ),
                                          ),
                                          const SizedBox(height: 4),
                                          Text(
                                            _formatFullDate(item['fecha']),
                                            style: TextStyle(
                                              color: Colors.grey.shade600,
                                              fontSize: 12,
                                            ),
                                          ),
                                          if (lat != null && lng != null)
                                            Padding(
                                              padding: const EdgeInsets.only(top: 4),
                                              child: Row(
                                                children: [
                                                  Icon(Icons.location_on, size: 12, color: Colors.grey.shade600),
                                                  const SizedBox(width: 4),
                                                  Text(
                                                    "GPS: ${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}",
                                                    style: TextStyle(fontSize: 11, color: Colors.grey.shade600),
                                                  ),
                                                ],
                                              ),
                                            ),
                                        ],
                                      ),
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

  Widget _buildActionButton(String label, IconData icon, Color color,
      Color bgColor, VoidCallback onTap) {
    return TextButton.icon(
      onPressed: onTap,
      icon: Icon(icon, size: 16, color: color),
      label: Text(label, style: TextStyle(color: color)),
      style: TextButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        backgroundColor: bgColor,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  Widget _buildStatBox(String label, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.15), width: 1.5),
        boxShadow: [
          BoxShadow(
              color: color.withOpacity(0.08), blurRadius: 8, offset: const Offset(0, 2))
        ],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 28),
          const SizedBox(height: 6),
          FittedBox(
            fit: BoxFit.scaleDown,
            child: Text(
              value,
              style: TextStyle(
                  fontSize: 24, 
                  fontWeight: FontWeight.w900, 
                  color: color,
                  fontFamily: 'Outfit',
                  height: 1.1,
              ),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            textAlign: TextAlign.center,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(
                fontSize: 10, 
                color: Colors.grey, 
                fontWeight: FontWeight.w600,
                height: 1.2,
            ),
          ),
        ],
      ),
    );
  }

  int _calculateLoyaltyScore() {
    if (_totalStampsEver == 0) return 0;
    // Simple formula: (redemptions * 10) + (current stamps / 6 * 20)
    final score =
        (_totalRedemptions * 15) + ((_currentStamps / 6) * 15).round();
    return score.clamp(0, 100);
  }

  String _getLoyaltyLevel() {
    if (_totalStampsEver > 50) return "🥇 ORO";
    if (_totalStampsEver > 20) return "🥈 PLATA";
    return "🥉 BRONCE";
  }
  
  Color _getLevelColor() {
     if (_totalStampsEver > 50) return const Color(0xFFFFD700);
     if (_totalStampsEver > 20) return const Color(0xFFC0C0C0);
     return const Color(0xFFCD7F32);
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null) return 'N/A';
    final date = DateTime.parse(dateStr);
    return '${date.day}/${date.month}/${date.year}';
  }

  String _formatFullDate(String dateStr) {
    final date = DateTime.parse(dateStr).toLocal();
    final months = [
      'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
      'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ];
    return '${date.day} ${months[date.month - 1]} ${date.year} • ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }
}
