import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const WHATSAPP_API_URL = 'https://graph.facebook.com/v21.0';

export async function POST(req: NextRequest) {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const waToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const waPhoneId = process.env.WHATSAPP_PHONE_ID;

        const { action, phone, message } = await req.json();

        if (!phone) {
            return NextResponse.json({ error: 'Phone required' }, { status: 400 });
        }

        // Use the phone exactly as stored in the session (don't re-format)
        const sessionPhone = phone.replace(/[^0-9]/g, '');

        switch (action) {
            case 'send_message': {
                if (!message) {
                    return NextResponse.json({ error: 'Message required' }, { status: 400 });
                }

                if (!waToken || !waPhoneId) {
                    return NextResponse.json({ error: 'WhatsApp credentials not configured on server', configured: false }, { status: 500 });
                }

                // Send WhatsApp message directly
                const waResponse = await fetch(`${WHATSAPP_API_URL}/${waPhoneId}/messages`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${waToken}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        messaging_product: 'whatsapp',
                        to: sessionPhone,
                        type: 'text',
                        text: { body: message, preview_url: false }
                    }),
                });

                const waData = await waResponse.json();

                if (!waResponse.ok) {
                    console.error('WhatsApp API Error:', waData);
                    return NextResponse.json({
                        error: waData?.error?.message || 'WhatsApp API error',
                        details: waData
                    }, { status: 400 });
                }

                // Save to session history
                const { data: sessionData } = await supabase
                    .from('whatsapp_sessions')
                    .select('state')
                    .eq('phone', sessionPhone)
                    .single();

                if (sessionData?.state) {
                    const state = sessionData.state;
                    if (!state.conversationHistory) state.conversationHistory = [];
                    state.conversationHistory.push({
                        role: 'bot',
                        text: `[CRM] ${message}`,
                        timestamp: Date.now()
                    });

                    await supabase
                        .from('whatsapp_sessions')
                        .update({ state, updated_at: new Date().toISOString() })
                        .eq('phone', sessionPhone);
                }

                return NextResponse.json({ success: true, messageId: waData?.messages?.[0]?.id });
            }

            case 'pause_bot': {
                const { data: sessionData } = await supabase
                    .from('whatsapp_sessions')
                    .select('state')
                    .eq('phone', sessionPhone)
                    .single();

                if (sessionData?.state) {
                    const state = sessionData.state;
                    state.mode = 'PAUSED';
                    state.pausedUntil = Date.now() + (60 * 60 * 1000);

                    await supabase
                        .from('whatsapp_sessions')
                        .update({ state, updated_at: new Date().toISOString() })
                        .eq('phone', sessionPhone);
                }

                return NextResponse.json({ success: true });
            }

            case 'resume_bot': {
                const { data: sessionData } = await supabase
                    .from('whatsapp_sessions')
                    .select('state')
                    .eq('phone', sessionPhone)
                    .single();

                if (sessionData?.state) {
                    const state = sessionData.state;
                    state.mode = 'NORMAL';
                    delete state.pausedUntil;

                    await supabase
                        .from('whatsapp_sessions')
                        .update({ state, updated_at: new Date().toISOString() })
                        .eq('phone', sessionPhone);
                }

                return NextResponse.json({ success: true });
            }

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }
    } catch (error: any) {
        console.error('CRM API Error:', error);
        return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
    }
}
