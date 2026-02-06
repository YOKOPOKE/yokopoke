import 'dart:math';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:pide_ya_mobile/core/widgets/loading_overlay.dart';
import 'package:pide_ya_mobile/features/auth/widgets/qr_dialog.dart';

class RegistrationPage extends StatefulWidget {
  const RegistrationPage({super.key});

  @override
  State<RegistrationPage> createState() => _RegistrationPageState();
}

class _RegistrationPageState extends State<RegistrationPage>
    with SingleTickerProviderStateMixin {
  final _supabase = Supabase.instance.client;
  late TabController _tabController;

  final _clientPhoneController = TextEditingController();
  final _clientNameController = TextEditingController();
  final _clientAddressController = TextEditingController();
  final _restNameController = TextEditingController();
  final _restPhoneController = TextEditingController();
  final _restAddressController = TextEditingController();

  bool _loading = false;
  String? _generatedQR;
  String? _entityType;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _clientPhoneController.dispose();
    _clientNameController.dispose();
    _clientAddressController.dispose();
    _restNameController.dispose();
    _restPhoneController.dispose();
    _restAddressController.dispose();
    super.dispose();
  }

  String _generateRestaurantQR() {
    final random = Random();
    final code = List.generate(6, (_) => random.nextInt(10)).join();
    return 'REST-$code';
  }

  Future<void> _registerClient() async {
    final phone = _clientPhoneController.text.trim();
    final name = _clientNameController.text.trim();
    final address = _clientAddressController.text.trim();

    if (phone.length < 10) {
      _showError("Teléfono inválido");
      return;
    }

    setState(() => _loading = true);

    try {
      await Future.delayed(const Duration(milliseconds: 500)); // Simular carga

      final existing = await _supabase
          .from('clientes')
          .select()
          .eq('telefono', phone)
          .maybeSingle();

      if (existing != null) {
        _showError("Este cliente ya está registrado");
        setState(() => _loading = false);
        return;
      }

      await _supabase.from('clientes').insert({
        'telefono': phone,
        'nombre': name.isEmpty ? 'Cliente' : name,
        'direccion': address,
      });

      setState(() {
        _generatedQR = phone;
        _entityType = 'CLIENTE';
        _loading = false;
      });

      _showDialog();
      _clientPhoneController.clear();
      _clientNameController.clear();
      _clientAddressController.clear();
    } catch (e) {
      _showError("Error: $e");
      setState(() => _loading = false);
    }
  }

  Future<void> _registerRestaurant() async {
    final name = _restNameController.text.trim();
    final phone = _restPhoneController.text.trim();
    final address = _restAddressController.text.trim();

    if (name.isEmpty || phone.length < 10) {
      _showError("Completa todos los campos");
      return;
    }

    setState(() => _loading = true);

    try {
      await Future.delayed(const Duration(milliseconds: 500));

      final qrCode = _generateRestaurantQR();

      await _supabase.from('restaurantes').insert({
        'nombre': name,
        'telefono': phone,
        'direccion': address,
        'qr_code': qrCode, // Restaurants DO have a unique QR code usually
      });

      setState(() {
        _generatedQR = qrCode;
        _entityType = 'RESTAURANTE';
        _loading = false;
      });

      _showDialog();
      _restNameController.clear();
      _restPhoneController.clear();
      _restAddressController.clear();
    } catch (e) {
      _showError("Error: $e");
      setState(() => _loading = false);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Row(
        children: [
          const Icon(Icons.error_outline, color: Colors.white),
          const SizedBox(width: 12),
          Expanded(child: Text(msg)),
        ],
      ),
      backgroundColor: Colors.red.shade700,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
    ));
  }

  void _showDialog() {
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: '',
      transitionDuration: const Duration(milliseconds: 300),
      pageBuilder: (context, anim1, anim2) => const SizedBox(),
      transitionBuilder: (context, anim1, anim2, child) {
        return Transform.scale(
          scale: anim1.value,
          child: Opacity(
            opacity: anim1.value,
            child: QRDisplayDialog(
              qrData: _generatedQR!,
              entityType: _entityType!,
              phone: _entityType == 'CLIENTE'
                  ? _generatedQR!
                  : _restPhoneController.text,
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return LoadingOverlay(
      isLoading: _loading,
      child: Scaffold(
        appBar: AppBar(
          title: const Text("Registrar"),
          bottom: TabBar(
            controller: _tabController,
            labelColor: Theme.of(context).primaryColor,
            unselectedLabelColor: Colors.grey,
            indicatorColor: Theme.of(context).primaryColor,
            indicatorWeight: 3,
            tabs: const [
              Tab(icon: Icon(Icons.person), text: "Cliente"),
              Tab(icon: Icon(Icons.restaurant), text: "Restaurante"),
            ],
          ),
        ),
        body: TabBarView(
          controller: _tabController,
          children: [_buildClientForm(), _buildRestaurantForm()],
        ),
      ),
    );
  }

  Widget _buildClientForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 20),
          Center(
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Theme.of(context).primaryColor.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.person_add,
                  size: 48, color: Theme.of(context).primaryColor),
            ),
          ),
          const SizedBox(height: 32),
          const Text(
            "Registrar Nuevo Cliente",
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          const Text(
            "Ingresa los datos para generar el QR",
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.grey),
          ),
          const SizedBox(height: 32),
          TextField(
            controller: _clientPhoneController,
            keyboardType: TextInputType.phone,
            maxLength: 10,
            decoration: const InputDecoration(
              labelText: "Teléfono Móvil",
              prefixIcon: Icon(Icons.phone_android),
              hintText: "10 dígitos",
            ),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _clientNameController,
            decoration: const InputDecoration(
              labelText: "Nombre (Opcional)",
              prefixIcon: Icon(Icons.badge_outlined),
            ),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _clientAddressController,
            decoration: const InputDecoration(
              labelText: "Dirección (Opcional)",
              prefixIcon: Icon(Icons.location_on_outlined),
              hintText: "Colonia, Calle...",
            ),
          ),
          const SizedBox(height: 32),
          ElevatedButton.icon(
            onPressed: _loading ? null : _registerClient,
            icon: const Icon(Icons.qr_code),
            label: const Text("Registrar Cliente"),
          ),
        ],
      ),
    );
  }

  Widget _buildRestaurantForm() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const SizedBox(height: 20),
          Center(
            child: Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: Colors.orange.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.restaurant_menu,
                  size: 48, color: Colors.orange),
            ),
          ),
          const SizedBox(height: 32),
          const Text("Registrar Restaurante",
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          const SizedBox(height: 32),
          TextField(
            controller: _restNameController,
            decoration: const InputDecoration(
              labelText: "Nombre del Restaurante",
              prefixIcon: Icon(Icons.store),
            ),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _restPhoneController,
            keyboardType: TextInputType.phone,
            maxLength: 10,
            decoration: const InputDecoration(
              labelText: "Teléfono de Contacto",
              prefixIcon: Icon(Icons.phone),
            ),
          ),
          const SizedBox(height: 20),
          TextField(
            controller: _restAddressController,
            decoration: const InputDecoration(
              labelText: "Dirección",
              prefixIcon: Icon(Icons.location_on),
            ),
          ),
          const SizedBox(height: 32),
          ElevatedButton.icon(
            onPressed: _loading ? null : _registerRestaurant,
            icon: const Icon(Icons.qr_code),
            label: const Text("Registrar Restaurante"),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.orange,
            ),
          ),
        ],
      ),
    );
  }
}
