import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

class WhatsAppService {
  // ⚠️ TODO: Replace with your actual API Credentials
  static const String _apiUrl = "https://your-api-provider.com/api/send";
  static const String _apiToken = "YOUR_API_TOKEN";

  /// Sends a points update notification
  Future<void> sendPointsUpdate(String phone, int points) async {
    final message = "¡Hola! 🛵\n\nGracias por tu pedido en *Pide Ya*.\n\n🎁 Tienes *${points}/6 sellos* acumulados.\n¡Sigue así para tu recompensa!";
    await _sendMessage(phone, message);
  }

  /// Sends a reward ready notification
  Future<void> sendRewardReady(String phone) async {
    final message = "¡Felicidades! 🎉\n\nHas completado tu tarjeta de lealtad en *Pide Ya*.\n\n🍔 *¡Tu próximo pedido tiene RECOMPENSA!* 🍔\nMuestra este mensaje al repartidor.";
    await _sendMessage(phone, message);
  }

  /// Internal method to make the HTTP request
  Future<void> _sendMessage(String phone, String message) async {
    try {
      // NOTE: Adjust the body structure depending on your API provider (Twilio, Meta, Waha, etc.)
      final body = {
        "phone": phone,
        "message": message,
        // "token": _apiToken // Some APIs accept token in body
      };

      // Ensure phone number has country code if needed (e.g., 52 for Mexico)
      // final formattedPhone = phone.startsWith('52') ? phone : '52$phone';

      // Mocking the call for now so it doesn't crash
      debugPrint("WhatsApp API Call -> Phone: $phone | Msg: $message");
      
      /* 
      // UNCOMMENT THIS WHEN YOU HAVE THE API READY
      final response = await http.post(
        Uri.parse(_apiUrl),
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer $_apiToken", // Standard Bearer token
        },
        body: jsonEncode(body),
      );

      if (response.statusCode == 200) {
        debugPrint("WhatsApp sent successfully");
      } else {
        debugPrint("WhatsApp API Error: ${response.statusCode} ${response.body}");
      }
      */
    } catch (e) {
      debugPrint("WhatsApp Service Error: $e");
    }
  }
}
