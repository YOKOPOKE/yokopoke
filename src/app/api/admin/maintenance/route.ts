
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ADMIN_SECRET = process.env.ADMIN_SECRET;

// Rate limiting: in-memory store (resets on redeploy, sufficient for brute-force protection)
const rateLimitMap = new Map<string, { attempts: number; resetTime: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 1000; // 1 minute

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetTime) {
        rateLimitMap.set(ip, { attempts: 1, resetTime: now + WINDOW_MS });
        return false;
    }

    entry.attempts++;
    return entry.attempts > MAX_ATTEMPTS;
}

export async function POST(request: Request) {
    // Require ADMIN_SECRET to be configured — no fallback
    if (!ADMIN_SECRET) {
        console.error("CRITICAL: ADMIN_SECRET not configured in environment variables.");
        return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
        return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }

    // Rate limiting by IP
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';
    if (isRateLimited(ip)) {
        return NextResponse.json({ error: "Demasiados intentos. Espera un momento." }, { status: 429 });
    }

    const body = await request.json();
    const { secret, action, message } = body;

    // Verify Secret
    if (secret !== ADMIN_SECRET) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Initialize Admin Client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Process Action
    try {
        if (action === 'enable') {
            const { error: err1 } = await supabase
                .from('app_config')
                .upsert({ key: 'maintenance_mode', value: true }, { onConflict: 'key' });

            const { error: err2 } = await supabase
                .from('app_config')
                .upsert({ key: 'maintenance_message', value: message || "Servicio suspendido temporalmente." }, { onConflict: 'key' });

            if (err1 || err2) throw new Error("Error updating config");

            return NextResponse.json({ success: true, status: 'enabled' });
        } else if (action === 'disable') {
            const { error } = await supabase
                .from('app_config')
                .upsert({ key: 'maintenance_mode', value: false }, { onConflict: 'key' });

            if (error) throw error;

            return NextResponse.json({ success: true, status: 'disabled' });
        } else if (action === 'status') {
            const { data } = await supabase
                .from('app_config')
                .select('key, value')
                .in('key', ['maintenance_mode', 'maintenance_message']);

            const mode = data?.find(d => d.key === 'maintenance_mode')?.value;
            const msg = data?.find(d => d.key === 'maintenance_message')?.value;

            return NextResponse.json({
                success: true,
                isActive: mode === true || mode === 'true',
                message: msg
            });
        }

        return NextResponse.json({ error: "Invalid action" }, { status: 400 });

    } catch (e: unknown) {
        console.error("Maintenance API Error:", e);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
