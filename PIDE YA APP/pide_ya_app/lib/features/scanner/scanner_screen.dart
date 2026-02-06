import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:go_router/go_router.dart';
import 'package:lucide_icons/lucide_icons.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> with SingleTickerProviderStateMixin {
  bool _isProcessing = false;
  late AnimationController _animationController;

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
        duration: const Duration(seconds: 2), vsync: this)
      ..repeat(reverse: true);
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_isProcessing) return;

    final List<Barcode> barcodes = capture.barcodes;
    if (barcodes.isNotEmpty) {
      final code = barcodes.first.rawValue;
      if (code != null) {
        setState(() => _isProcessing = true);
        _showResultModal(code);
      }
    }
  }

  void _showResultModal(String code) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _ResultModal(
        code: code,
        onConfirm: () {
          Navigator.pop(ctx);
          context.pop();
        },
        onScanAgain: () {
           Navigator.pop(ctx);
           if (mounted) setState(() => _isProcessing = false);
        },
      ),
    ).then((_) {
      if (mounted && _isProcessing) {
         // Should ideally be handled by the buttons, but as a fallback
         setState(() => _isProcessing = false);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: Container(
          margin: const EdgeInsets.only(left: 16, top: 8, bottom: 8),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.4),
            shape: BoxShape.circle,
          ),
          child: IconButton(
            icon: const Icon(LucideIcons.arrowLeft, color: Colors.white, size: 20),
            onPressed: () => context.pop(),
          ),
        ),
      ),
      body: Stack(
        children: [
          MobileScanner(onDetect: _onDetect),
          
          // Dark Overlay with Cutout
          CustomPaint(
            painter: ScannerOverlayPainter(
              scanWindow: Rect.fromCenter(
                center: Offset(MediaQuery.of(context).size.width / 2, MediaQuery.of(context).size.height / 2),
                width: 280,
                height: 280,
              ),
              borderRadius: 24,
            ),
            child: Container(),
          ),

          // Scanning Line Animation
          Center(
            child: SizedBox(
              width: 280,
              height: 280,
              child: AnimatedBuilder(
                animation: _animationController,
                builder: (context, child) {
                  return Stack(
                    children: [
                      Positioned(
                        top: _animationController.value * 260, // 280 - 20 height of line
                        left: 0,
                        right: 0,
                        child: Container(
                          height: 2,
                          decoration: BoxDecoration(
                            color: const Color(0xFFFF5722),
                            boxShadow: [
                              BoxShadow(
                                color: const Color(0xFFFF5722).withOpacity(0.5),
                                blurRadius: 10,
                                spreadRadius: 2,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),

          // Header Content
          SafeArea(
            child: Align(
              alignment: Alignment.topCenter,
              child: Padding(
                padding: const EdgeInsets.only(top: 20),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(30),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(30),
                        border: Border.all(color: Colors.white.withOpacity(0.2)),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(LucideIcons.qrCode, color: Colors.white, size: 20),
                          SizedBox(width: 12),
                          Text(
                            'Escanear Cliente',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),

          // Footer Text
          Align(
            alignment: Alignment.bottomCenter,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 80),
              child: Text(
                'Alinea el código QR dentro del marco',
                style: TextStyle(
                  color: Colors.white.withOpacity(0.7),
                  fontSize: 14,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ScannerOverlayPainter extends CustomPainter {
  final Rect scanWindow;
  final double borderRadius;

  ScannerOverlayPainter({required this.scanWindow, required this.borderRadius});

  @override
  void paint(Canvas canvas, Size size) {
    final backgroundPath = Path()
      ..addRect(Rect.fromLTWH(0, 0, size.width, size.height));

    final cutoutPath = Path()
      ..addRRect(
        RRect.fromRectAndRadius(
          scanWindow,
          Radius.circular(borderRadius),
        ),
      );

    final backgroundPaint = Paint()
      ..color = Colors.black.withOpacity(0.6)
      ..style = PaintingStyle.fill
      ..blendMode = BlendMode.dstOut;

    final backgroundPathFinal = Path.combine(
      PathOperation.difference,
      backgroundPath,
      cutoutPath,
    );

    // Dibuja el oscurecimiento alrededor
    canvas.drawPath(backgroundPathFinal, Paint()..color = Colors.black.withOpacity(0.6));
    
    // Dibuja borde sutil
    final borderPaint = Paint()
      ..color = Colors.white.withOpacity(0.3)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;
      
    canvas.drawRRect(
        RRect.fromRectAndRadius(scanWindow, Radius.circular(borderRadius)), 
        borderPaint
    );

    // Dibuja esquinas
    final cornerPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4;
      
    const cornerLength = 20.0;
    
    // Top Left
    canvas.drawLine(
      scanWindow.topLeft, 
      scanWindow.topLeft + const Offset(0, cornerLength), 
      cornerPaint
    );
    canvas.drawLine(
      scanWindow.topLeft, 
      scanWindow.topLeft + const Offset(cornerLength, 0), 
      cornerPaint
    );

     // Top Right
    canvas.drawLine(
      scanWindow.topRight, 
      scanWindow.topRight + const Offset(0, cornerLength), 
      cornerPaint
    );
    canvas.drawLine(
      scanWindow.topRight, 
      scanWindow.topRight - const Offset(cornerLength, 0), 
      cornerPaint
    );

     // Bottom Left
    canvas.drawLine(
      scanWindow.bottomLeft, 
      scanWindow.bottomLeft - const Offset(0, cornerLength), 
      cornerPaint
    );
    canvas.drawLine(
      scanWindow.bottomLeft, 
      scanWindow.bottomLeft + const Offset(cornerLength, 0), 
      cornerPaint
    );
    
    // Bottom Right
    canvas.drawLine(
      scanWindow.bottomRight, 
      scanWindow.bottomRight - const Offset(0, cornerLength), 
      cornerPaint
    );
    canvas.drawLine(
      scanWindow.bottomRight, 
      scanWindow.bottomRight - const Offset(cornerLength, 0), 
      cornerPaint
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

class _ResultModal extends StatelessWidget {
  final String code;
  final VoidCallback onConfirm;
  final VoidCallback onScanAgain;

  const _ResultModal({
    required this.code,
    required this.onConfirm,
    required this.onScanAgain,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
      ),
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey[200],
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 32),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.green.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: const Icon(LucideIcons.check, color: Colors.green, size: 32),
          ),
          const SizedBox(height: 16),
          const Text(
            'Cliente Detectado',
            style: TextStyle(
              fontFamily: 'Outfit',
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1E293B),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: const Color(0xFFE2E8F0)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(LucideIcons.hash, size: 14, color: Color(0xFF64748B)),
                const SizedBox(width: 4),
                Text(
                  code, 
                  style: const TextStyle(
                    fontFamily: 'Courier', 
                    fontSize: 14,
                    color: Color(0xFF334155),
                    fontWeight: FontWeight.w600
                  )
                ),
              ],
            ),
          ),
          const SizedBox(height: 32),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: onScanAgain,
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    side: const BorderSide(color: Color(0xFFE2E8F0)),
                    foregroundColor: const Color(0xFF64748B)
                  ),
                  child: const Text('Cancelar'),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: ElevatedButton(
                  onPressed: onConfirm,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFF1E293B),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 0,
                  ),
                  child: const Text('Confirmar', style: TextStyle(color: Colors.white)),
                ),
              ),
            ],
          )
        ],
      ),
    );
  }
}
