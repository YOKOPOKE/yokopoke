import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import 'package:pide_ya_mobile/core/providers/theme_provider.dart';
import 'package:provider/provider.dart';
import 'package:pide_ya_mobile/features/business/widgets/personal_qr_card.dart';
import 'package:pide_ya_mobile/features/business/screens/restaurant_crm_page.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:pide_ya_mobile/core/services/loyalty_service.dart';

class BusinessDashboard extends StatefulWidget {
  const BusinessDashboard({super.key});

  @override
  State<BusinessDashboard> createState() => _BusinessDashboardState();
}

class _BusinessDashboardState extends State<BusinessDashboard> {
  int _touchedIndex = -1;

  late final LoyaltyService _loyaltyService;
  
  // Real Data
  List<double> _weeklyIncome = List.filled(7, 0.0);
  final double _weeklyGoal = 5000; 
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loyaltyService = LoyaltyService(Supabase.instance.client);
    _loadFinancials();
  }

  Future<void> _loadFinancials() async {
    setState(() => _loading = true);
    final income = await _loyaltyService.getWeeklyIncome();
    if (mounted) {
      setState(() {
        _weeklyIncome = income;
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = context.read<ThemeProvider>().isDarkMode;
    final totalIncome = _weeklyIncome.reduce((a, b) => a + b);

    return Scaffold(
      appBar: AppBar(
        title: const Text("Mi Negocio"),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
             onPressed: _loadFinancials,
             tooltip: "Actualizar",
          ),
          IconButton(
            icon: const Icon(Icons.share),
            onPressed: () {
               showModalBottomSheet(context: context, builder: (_) => const PersonalQRCard());
            },
            tooltip: "Mi Tarjeta Digital",
          )
        ],
      ),
      body: _loading ? const Center(child: CircularProgressIndicator()) : SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // 1. Balance Card
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: isDark 
                      ? [Colors.blueGrey.shade900, Colors.black]
                      : [theme.primaryColor, theme.primaryColor.withBlue(100)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 10, offset: Offset(0, 4))],
              ),
              child: Column(
                children: [
                   Text("INGRESOS ESTA SEMANA", style: TextStyle(color: Colors.white.withOpacity(0.7), fontSize: 12, letterSpacing: 1.2, fontWeight: FontWeight.bold)),
                   const SizedBox(height: 8),
                   Text("\$${totalIncome.toStringAsFixed(0)}", style: const TextStyle(color: Colors.white, fontSize: 48, fontWeight: FontWeight.w900)),
                   const SizedBox(height: 12),
                   LinearProgressIndicator(
                     value: (totalIncome / _weeklyGoal).clamp(0.0, 1.0),
                     backgroundColor: Colors.white24,
                     valueColor: const AlwaysStoppedAnimation(Colors.greenAccent),
                     minHeight: 6,
                     borderRadius: BorderRadius.circular(3),
                   ),
                   const SizedBox(height: 8),
                   Text("Meta Semanal: \$${_weeklyGoal.toStringAsFixed(0)} (${(totalIncome/_weeklyGoal*100).toStringAsFixed(1)}%)", style: TextStyle(color: Colors.white.withOpacity(0.8), fontSize: 11)),
                ],
              ),
            ),
            
            const SizedBox(height: 32),
            
            // 2. Chart Section
            const Text("Actividad Financiera", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 16),
            AspectRatio(
              aspectRatio: 1.5,
              child: BarChart(
                BarChartData(
                  barTouchData: BarTouchData(
                    touchTooltipData: BarTouchTooltipData(
                      getTooltipColor: (_) => Colors.blueGrey,
                      tooltipHorizontalAlignment: FLHorizontalAlignment.center,
                      tooltipMargin: -10,
                      getTooltipItem: (group, groupIndex, rod, rodIndex) {
                        String weekDay;
                        switch (group.x) {
                          case 0: weekDay = 'Lun'; break;
                          case 1: weekDay = 'Mar'; break;
                          case 2: weekDay = 'Mie'; break;
                          case 3: weekDay = 'Jue'; break;
                          case 4: weekDay = 'Vie'; break;
                          case 5: weekDay = 'Sab'; break;
                          case 6: weekDay = 'Dom'; break;
                          default: throw Error();
                        }
                        return BarTooltipItem(
                          '\$weekDay\n',
                          const TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                            fontSize: 18,
                          ),
                          children: <TextSpan>[
                            TextSpan(
                              text: (rod.toY).toStringAsFixed(0),
                              style: const TextStyle(
                                color: Colors.yellow,
                                fontSize: 16,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                    touchCallback: (FlTouchEvent event, barTouchResponse) {
                      setState(() {
                        if (!event.isInterestedForInteractions ||
                            barTouchResponse == null ||
                            barTouchResponse.spot == null) {
                          _touchedIndex = -1;
                          return;
                        }
                        _touchedIndex = barTouchResponse.spot!.touchedBarGroupIndex;
                      });
                    },
                  ),
                  titlesData: FlTitlesData(
                    show: true,
                    rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                    bottomTitles: AxisTitles(
                      sideTitles: SideTitles(
                        showTitles: true,
                        getTitlesWidget: (double value, TitleMeta meta) {
                           const style = TextStyle(fontWeight: FontWeight.bold, fontSize: 12);
                           String text;
                           switch (value.toInt()) {
                             case 0: text = 'L'; break;
                             case 1: text = 'M'; break;
                             case 2: text = 'M'; break;
                             case 3: text = 'J'; break;
                             case 4: text = 'V'; break;
                             case 5: text = 'S'; break;
                             case 6: text = 'D'; break;
                             default: text = ''; break;
                           }
                           return Text(text, style: style);
                        },
                      ),
                    ),
                    leftTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
                  ),
                  borderData: FlBorderData(show: false),
                  barGroups: _weeklyIncome.asMap().entries.map((e) {
                     return _makeGroupData(e.key, e.value, isTouched: e.key == _touchedIndex);
                  }).toList(),
                  gridData: const FlGridData(show: false),
                ),
              ),
            ),
            
            const SizedBox(height: 32),
            
            // 3. Quick CRM Stats
            Row(
              children: [
                Expanded(child: _buildStatCard("Clientes Leales", "12", Icons.people, Colors.purple)),
                const SizedBox(width: 16),
                Expanded(
                  child: GestureDetector(
                    onTap: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (context) => const RestaurantCrmPage()),
                      );
                    },
                    child: _buildStatCard("Restaurantes", "5", Icons.store_mall_directory, Colors.orange),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
      floatingActionButton: null,
    );
  }
  
  BarChartGroupData _makeGroupData(int x, double y, {bool isTouched = false}) {
    return BarChartGroupData(
      x: x,
      barRods: [
        BarChartRodData(
          toY: isTouched ? y + 50 : y,
          color: isTouched ? Colors.greenAccent : Theme.of(context).primaryColor,
          width: 22,
          backDrawRodData: BackgroundBarChartRodData(show: true, toY: _weeklyGoal/7 * 1.5, color: Colors.grey.shade100), // Dynamic Max
          borderRadius: BorderRadius.circular(6),
        ),
      ],
      showingTooltipIndicators: isTouched ? [0] : [],
    );
  }
  
  Widget _buildStatCard(String title, String value, IconData icon, Color color) {
     return Container(
       padding: const EdgeInsets.all(16),
       decoration: BoxDecoration(
         color: Colors.white,
         borderRadius: BorderRadius.circular(16),
         boxShadow: [BoxShadow(color: color.withOpacity(0.1), blurRadius: 10, spreadRadius: 2)],
         border: Border.all(color: color.withOpacity(0.2)),
       ),
       child: Column(
         crossAxisAlignment: CrossAxisAlignment.start,
         children: [
           Icon(icon, color: color),
           const SizedBox(height: 8),
           Text(value, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: color)),
           Text(title, style: const TextStyle(color: Colors.grey, fontSize: 12)),
         ],
       ),
     );
  }
}
