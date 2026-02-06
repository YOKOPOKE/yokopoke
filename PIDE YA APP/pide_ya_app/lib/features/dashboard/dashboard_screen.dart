import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../data/services/supabase_service.dart';
import '../../data/models/activity_model.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  List<Activity> _recentActivity = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final data = await SupabaseService.getRecentActivity();
    if (mounted) {
      setState(() {
        _recentActivity = data;
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // Truco simple para recargar al volver (navegación pop)
    // Lo ideal sería usar un listener de rutas, pero esto funciona para MVP
    
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC), // Slate 50
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _loadData,
          color: const Color(0xFFFF5722),
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Header
                const _DashboardHeader(),
                const SizedBox(height: 32),

                // KPI Section (Valores estáticos por ahora)
                // TODO: Traer KPIs reales también del servicio
                const Row(
                  children: [
                    Expanded(
                      child: _KpiCard(
                        label: 'Entregas',
                        value: '12',
                        icon: LucideIcons.packageCheck,
                        color: Color(0xFF3B82F6), // Blue 500
                      ),
                    ),
                    SizedBox(width: 16),
                    Expanded(
                      child: _KpiCard(
                        label: 'Canjes',
                        value: '5',
                        icon: LucideIcons.trophy,
                        color: Color(0xFFEAB308), // Yellow 500
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                // Main Action - Scan
                Container(
                  width: double.infinity,
                  height: 140,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF1E293B), Color(0xFF0F172A)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF1E293B).withOpacity(0.3),
                        offset: const Offset(0, 8),
                        blurRadius: 20,
                      ),
                    ],
                  ),
                  child: Material(
                    color: Colors.transparent,
                    child: InkWell(
                      onTap: () => context.push('/scan').then((_) => _loadData()),
                      borderRadius: BorderRadius.circular(24),
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Text(
                                    'Escanear QR',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 20,
                                      fontWeight: FontWeight.bold,
                                      fontFamily: 'Outfit',
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    'Registrar entrega o canje',
                                    style: TextStyle(
                                      color: Colors.white.withOpacity(0.7),
                                      fontSize: 14,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Container(
                              width: 64,
                              height: 64,
                              decoration: BoxDecoration(
                                color: Colors.white.withOpacity(0.1),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(LucideIcons.scanLine, color: Colors.white, size: 32),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
                
                const SizedBox(height: 32),
                
                // Recent Activity Section
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'Actividad Reciente',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1E293B),
                        fontFamily: 'Outfit',
                      ),
                    ),
                    TextButton(
                      onPressed: () => context.push('/clients').then((_) => _loadData()),
                      style: TextButton.styleFrom(
                        foregroundColor: const Color(0xFF64748B),
                      ),
                      child: const Text('Ver todos'),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                
                // List with Real Data
                if (_isLoading)
                  const Center(child: Padding(
                    padding: EdgeInsets.all(32.0),
                    child: CircularProgressIndicator(color: Color(0xFF1E293B)),
                  ))
                else if (_recentActivity.isEmpty)
                   Container(
                     padding: const EdgeInsets.all(24),
                     alignment: Center(
                       child: Column(
                         children: [
                           Icon(LucideIcons.inbox, size: 48, color: Colors.grey[300]),
                           const SizedBox(height: 16),
                           Text("No hay actividad reciente", style: TextStyle(color: Colors.grey[500])),
                         ],
                       ),
                     ),
                   )
                else
                  ListView.separated(
                    physics: const NeverScrollableScrollPhysics(),
                    shrinkWrap: true,
                    itemCount: _recentActivity.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final activity = _recentActivity[index];
                      // Formatear tiempo relativo simple
                      final diff = DateTime.now().difference(activity.date);
                      String timeStr = '';
                      if (diff.inMinutes < 60) {
                        timeStr = 'Hace ${diff.inMinutes} min';
                      } else if (diff.inHours < 24) {
                        timeStr = 'Hace ${diff.inHours} h';
                      } else {
                        timeStr = 'Hace ${diff.inDays} d';
                      }

                      // TODO: Nombre del cliente (necesitaríamos traerlo en la query o actividad)
                      // Por ahora asumimos que description tiene info o es genérico
                      
                      return _ActivityItem(
                        name: "Cliente", // Deberíamos hacer join para sacar el nombre
                        action: activity.description.isNotEmpty ? activity.description : activity.type,
                        time: timeStr,
                        initials: 'CL', // Placeholder
                        icon: activity.icon,
                        isPositive: activity.type.toLowerCase() == 'sello' || activity.type.toLowerCase().contains('entrega'),
                      );
                    },
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _DashboardHeader extends StatelessWidget {
  const _DashboardHeader();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        const CircleAvatar(
          radius: 24,
          backgroundColor: Color(0xFFE2E8F0),
          backgroundImage: NetworkImage('https://i.pravatar.cc/150?img=11'), 
        ),
        const SizedBox(width: 16),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Hola, Admin',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: const Color(0xFF1E293B),
                fontFamily: GoogleFonts.outfit().fontFamily,
              ),
            ),
            const Text(
              'Bienvenido de nuevo',
              style: TextStyle(
                fontSize: 14,
                color: Color(0xFF64748B),
              ),
            ),
          ],
        ),
        const Spacer(),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: const Color(0xFFE2E8F0)),
            shape: BoxShape.circle,
          ),
          child: IconButton(
            icon: const Icon(LucideIcons.bell, size: 20, color: Color(0xFF64748B)),
            onPressed: () {},
          ),
        ),
      ],
    );
  }
}

class _KpiCard extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const _KpiCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF64748B).withOpacity(0.05),
            offset: const Offset(0, 4),
            blurRadius: 16,
          ),
        ],
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(height: 16),
          Text(
            value,
            style: const TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1E293B),
              fontFamily: 'Outfit',
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              color: Color(0xFF94A3B8),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _ActivityItem extends StatelessWidget {
  final String name;
  final String action;
  final String time;
  final String initials;
  final IconData icon;
  final bool isPositive;

  const _ActivityItem({
    required this.name,
    required this.action,
    required this.time,
    required this.initials,
    required this.icon,
    this.isPositive = true,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF1F5F9)),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: const Color(0xFFF1F5F9), 
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Icon(icon, color: const Color(0xFF475569), size: 20),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  name,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    color: Color(0xFF1E293B),
                    fontSize: 15,
                  ),
                ),
                Text(
                  action,
                  style: const TextStyle(
                    color: Color(0xFF64748B),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              if (isPositive)
               Container(
                 padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                 decoration: BoxDecoration(
                   color: Colors.green.withOpacity(0.1),
                   borderRadius: BorderRadius.circular(6),
                 ),
                 child: const Text(
                  '+1 Sello', // Ejemplo
                  style: TextStyle(
                    color: Colors.green,
                    fontWeight: FontWeight.bold,
                    fontSize: 11,
                  ),
                ),
               ),
              const SizedBox(height: 4),
              Text(
                time,
                style: const TextStyle(
                  color: Color(0xFF94A3B8),
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
