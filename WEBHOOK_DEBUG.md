# Troubleshooting: Validación Webhook WhatsApp

Guía técnica para resolver problemas de validación de la URL del webhook en Meta for Developers.

## Causas Comunes de fallo en Validación

### 1. Configuración de `WHATSAPP_VERIFY_TOKEN`
El token de verificación debe estar presente en los secrets de la función en Supabase.

**Verificación:**
1. Acceder al dashboard de Supabase: `Settings > Edge Functions`.
2. Verificar la existencia de `WHATSAPP_VERIFY_TOKEN`.
3. Si el token se acaba de añadir o modificar, es necesario re-desplegar la función:
   ```bash
   npx supabase functions deploy whatsapp-webhook
   ```

### 2. Formato de la URL
Meta requiere una URL accesible y con la estructura correcta.

**Estructura esperada:**
`https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook`

**Errores comunes:**
- Espacios en blanco al inicio o final.
- Omisión del segmento `/v1/`.
- Protocolo HTTP en lugar de HTTPS.

### 3. Coincidencia exacta del Token
El Verify Token configurado en el panel de Meta debe ser idéntico al secret en Supabase (case-sensitive).

## Prueba de Validación Manual

Se puede simular la petición de validación de Meta desde un navegador para confirmar que la función responde con el `hub.challenge` correcto:

```
https://<PROJECT_REF>.supabase.co/functions/v1/whatsapp-webhook?hub.mode=subscribe&hub.verify_token=<TU_TOKEN>&hub.challenge=test_check
```

**Resultado esperado:**
- La respuesta debe ser únicamente el string: `test_check`.

## Monitoreo de Logs

Para identificar fallos específicos durante el intento de validación desde Meta, revisar los logs de la función:

1. Dashboard de Supabase: `Edge Functions > whatsapp-webhook > Logs`.
2. Filtrar por errores o buscar la petición GET entrante de Meta.
