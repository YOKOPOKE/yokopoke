# Yoko Poke - Sistema de Pedidos Inteligente

Plataforma integral para la gestión de pedidos de Yoko Poke, que incluye una aplicación web moderna y un bot de WhatsApp con IA para la toma de pedidos automática.

## Stack Tecnológico

- **Frontend:** Next.js 15+, Tailwind CSS, Framer Motion.
- **Backend/Base de Datos:** Supabase (PostgreSQL, Auth, Edge Functions).
- **IA:** Google Gemini (Generative AI) para procesamiento de lenguaje natural en WhatsApp.
- **Pagos:** Stripe (Simulado/Integrado).

## Estructura del Proyecto

- `/src`: Aplicación web Next.js (Dashboard administrativo y App de cliente).
- `/supabase`: Configuración de base de Datos, migraciones y Edge Functions para el bot de WhatsApp.
- `/public`: Activos estáticos e imágenes.

## Inicio Rápido

### Requisitos previos
- Node.js 20+
- Supabase CLI
- Cuenta de Meta for Developers (para WhatsApp Business API)

### Configuración Local

1. Instalar dependencias:
   ```bash
   npm install
   ```

2. Configurar variables de entorno:
   Copia el archivo `.env.example` (si existe) o crea uno con las claves de Supabase y Gemini.

3. Correr servidor de desarrollo:
   ```bash
   npm run dev
   ```

4. Desplegar funciones de Supabase (opcional):
   ```bash
   npx supabase functions deploy whatsapp-webhook
   ```

---
Mantenedor: Yoko Poke Team.
