import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppText } from '@/lib/whatsapp';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
    try {
        // Use service role for server-side operations
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { action, phone, message } = await req.json();

        if (!phone) {
            return NextResponse.json({ error: 'Phone required' }, { status: 400 });
        }

        // Format phone
        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const formattedPhone = cleanPhone.startsWith('521') ? cleanPhone
            : cleanPhone.startsWith('52') ? `521${cleanPhone.slice(2)}`
                : cleanPhone.length === 10 ? `521${cleanPhone}`
                    : cleanPhone;

        switch (action) {
            case 'send_message': {
                if (!message) {
                    return NextResponse.json({ error: 'Message required' }, { status: 400 });
                }

                const result = await sendWhatsAppText(formattedPhone, message);

                // Also save to session history so it appears in CRM
                const { data: sessionData } = await supabase
                    .from('whatsapp_sessions')
                    .select('state')
                    .eq('phone', formattedPhone)
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
                        .eq('phone', formattedPhone);
                }

                return NextResponse.json({ success: result.success });
            }

            case 'pause_bot': {
                const { data: sessionData } = await supabase
                    .from('whatsapp_sessions')
                    .select('state')
                    .eq('phone', formattedPhone)
                    .single();

                if (sessionData?.state) {
                    const state = sessionData.state;
                    state.mode = 'PAUSED';
                    state.pausedUntil = Date.now() + (60 * 60 * 1000); // 1 hour

                    await supabase
                        .from('whatsapp_sessions')
                        .update({ state, updated_at: new Date().toISOString() })
                        .eq('phone', formattedPhone);
                }

                return NextResponse.json({ success: true });
            }

            case 'resume_bot': {
                const { data: sessionData } = await supabase
                    .from('whatsapp_sessions')
                    .select('state')
                    .eq('phone', formattedPhone)
                    .single();

                if (sessionData?.state) {
                    const state = sessionData.state;
                    state.mode = 'NORMAL';
                    delete state.pausedUntil;

                    await supabase
                        .from('whatsapp_sessions')
                        .update({ state, updated_at: new Date().toISOString() })
                        .eq('phone', formattedPhone);
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
