# Guía de Despliegue: WhatsApp Bot (Supabase)

Pasos técnicos para el despliegue de las Edge Functions y configuración del Webhook oficial.

## 1. Despliegue de Edge Functions

```bash
# Login inicial
npx supabase login

# Despliegue de la función de webhook
npx supabase functions deploy whatsapp-webhook --project-ref <TU_PROJECT_REF>
```

## 2. Variables de Entorno (Secrets)

Configura los siguientes secrets en el dashboard de Supabase (Settings > Edge Functions):

| Variable | Descripción |
|----------|-------------|
| `WHATSAPP_PHONE_ID` | ID de la terminal de WhatsApp en Meta |
| `WHATSAPP_ACCESS_TOKEN` | Token de acceso permanente de Meta |
| `WHATSAPP_VERIFY_TOKEN` | Token caprichoso para validación del webhook |
| `GEMINI_API_KEY` | Key de Google AI Studio |
| `SUPABASE_URL` | Endpoint de tu API de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Key administrativa de Supabase |

## 3. Configuración en Meta Business Suite

1. URL del Webhook: `https://<TU_PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook`
2. Verify Token: El valor configurado en `WHATSAPP_VERIFY_TOKEN`.
3. Suscribirse al campo: `messages`.

## 4. Debugging

Para monitorear errores en tiempo real:

```bash
npx supabase functions logs whatsapp-webhook --project-ref <TU_PROJECT_REF>
```
O directamente en el panel de logs de Supabase Edge Functions.
