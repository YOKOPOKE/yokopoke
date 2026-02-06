import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:share_plus/share_plus.dart';

class PersonalQRCard extends StatelessWidget {
  const PersonalQRCard({super.key});

  @override
  Widget build(BuildContext context) {
    // TODO: Replace with real Driver ID/Link
    const String myData = "https://pideya.com/driver/123"; 

    return Container(
      padding: const EdgeInsets.all(32),
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 60,
            height: 6,
            decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(3)),
            margin: const EdgeInsets.only(bottom: 24),
          ),
          
          const Text("Mi Tarjeta Digital", style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
          const Text("Escanea para agregarme a WhatsApp", style: TextStyle(color: Colors.grey)),
          
          const SizedBox(height: 32),
          
          QrImageView(
            data: myData,
            version: QrVersions.auto,
            size: 200.0,
            backgroundColor: Colors.white,
          ),
          
          const SizedBox(height: 32),
          
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () {
                Share.share('¡Hola! Soy tu repartidor de Pide Ya. Agenda mis servicios aquí: $myData');
              },
              icon: const Icon(Icons.share),
              label: const Text("Compartir Enlace"),
              style: ElevatedButton.styleFrom(
                padding: const EdgeInsets.all(16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          )
        ],
      ),
    );
  }
}
