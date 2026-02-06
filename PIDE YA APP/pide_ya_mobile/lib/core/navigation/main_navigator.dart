import 'package:flutter/material.dart';
import 'package:pide_ya_mobile/features/dashboard/screens/driver_dashboard.dart';
import 'package:pide_ya_mobile/features/auth/screens/registration_page.dart';
import 'package:pide_ya_mobile/features/business/screens/business_dashboard.dart';

class MainNavigator extends StatefulWidget {
  const MainNavigator({super.key});

  @override
  State<MainNavigator> createState() => _MainNavigatorState();
}

class _MainNavigatorState extends State<MainNavigator> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        child: _getBody(),
      ),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          boxShadow: [
            BoxShadow(color: Colors.black12, blurRadius: 10, spreadRadius: 2)
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) => setState(() => _currentIndex = index),
          selectedItemColor: Colors.purple,
          items: const [
            BottomNavigationBarItem(
                icon: Icon(Icons.dashboard), label: 'Dashboard'),
            BottomNavigationBarItem(
                icon: Icon(Icons.person_add), label: 'Registrar'),
            BottomNavigationBarItem(
                icon: Icon(Icons.pie_chart), label: 'Mi Negocio'),
          ],
        ),
      ),
    );
  }

  Widget _getBody() {
    switch (_currentIndex) {
      case 0:
        return const DriverDashboard(key: ValueKey(0));
      case 1:
        return const RegistrationPage(key: ValueKey(1));
      case 2:
        return const BusinessDashboard(key: ValueKey(2));
      default:
        return Container();
    }
  }
}
