import 'dart:io';
import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:screenshot/screenshot.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';

class QRDisplayDialog extends StatefulWidget {
  final String qrData;
  final String entityType;
  final String phone;

  const QRDisplayDialog({
    super.key,
    required this.qrData,
    required this.entityType,
    required this.phone,
  });

  @override
  State<QRDisplayDialog> createState() => _QRDisplayDialogState();
}

class _QRDisplayDialogState extends State<QRDisplayDialog>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  final ScreenshotController _screenshotController = ScreenshotController();

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 400));
    _scaleAnimation =
        CurvedAnimation(parent: _controller, curve: Curves.elasticOut);
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _shareQRImage() async {
    try {
      final directory = await getApplicationDocumentsDirectory();
      final fileName = 'qr_${widget.phone}.png';
      final path = '${directory.path}/$fileName';

      // Capture the widget
      final image = await _screenshotController.capture();

      if (image != null) {
        final file = File(path);
        await file.writeAsBytes(image);

        final message = widget.entityType == 'CLIENTE'
            ? "¡Bienvenido a Pide Ya! 🎉\n\nEste es tu código QR personal. Guárdalo y muéstralo al repartidor para acumular puntos.\n\n📱 *Regístrate o revisa tu saldo aquí:* https://t.me/PideYaBot?start=${widget.phone}"
            : "¡Bienvenido a Pide Ya! 🏪\n\nCódigo QR de tu restaurante.";

        await Share.shareXFiles([XFile(path)], text: message);
      }
    } catch (e) {
      debugPrint("Error sharing: $e");
    }
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: _scaleAnimation,
      child: Dialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Theme.of(context).primaryColor.withOpacity(0.1),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  widget.entityType == 'CLIENTE'
                      ? Icons.check_circle
                      : Icons.restaurant,
                  size: 50,
                  color: Theme.of(context).primaryColor,
                ),
              ),
              const SizedBox(height: 16),
              Text(
                "✅ ${widget.entityType == 'CLIENTE' ? 'Cliente' : 'Restaurante'} Registrado",
                style:
                    const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              Screenshot(
                controller: _screenshotController,
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.grey.shade300, width: 3),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      QrImageView(
                          data: widget.qrData,
                          version: QrVersions.auto,
                          size: 200),
                      const SizedBox(height: 8),
                       Text(
                        widget.phone,
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 2,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              ElevatedButton.icon(
                onPressed: _shareQRImage,
                icon: const Icon(Icons.share),
                label: const Text("Compartir QR (WhatsApp)",
                    style: TextStyle(fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF25D366), // WhatsApp Green
                  foregroundColor: Colors.white,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
              ),
              const SizedBox(height: 12),
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text("Cerrar", style: TextStyle(color: Colors.grey)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
