import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

class SmartQRScanner extends StatefulWidget {
  const SmartQRScanner({super.key});

  @override
  State<SmartQRScanner> createState() => _SmartQRScannerState();
}

class _SmartQRScannerState extends State<SmartQRScanner> {
  bool _hasScanned = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text("Escanear QR"),
        backgroundColor: Colors.purple.shade600,
        foregroundColor: Colors.white,
      ),
      body: Stack(
        children: [
          MobileScanner(
            onDetect: (capture) {
              if (_hasScanned) return;
              final List<Barcode> barcodes = capture.barcodes;
              for (final barcode in barcodes) {
                if (barcode.rawValue != null) {
                  setState(() => _hasScanned = true);
                  Navigator.pop(context, barcode.rawValue);
                  break;
                }
              }
            },
          ),
          Center(
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white, width: 3),
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
