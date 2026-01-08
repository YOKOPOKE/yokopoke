import { NextRequest, NextResponse } from 'next/server';

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('✅ WhatsApp Webhook Verified!');
            return new NextResponse(challenge, { status: 200 });
        } else {
            return new NextResponse('Forbidden', { status: 403 });
        }
    }

    return new NextResponse('Bad Request', { status: 400 });
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();

        // Check if it's a WhatsApp Status Update
        if (body.object) {
            if (
                body.entry &&
                body.entry[0].changes &&
                body.entry[0].changes[0].value.messages &&
                body.entry[0].changes[0].value.messages[0]
            ) {
                const message = body.entry[0].changes[0].value.messages[0];
                const from = message.from;
                const text = message.text?.body;

                console.log(`📩 New Message from ${from}: ${text}`);

                // Here we could handle auto-replies or save to DB
            }
        }

        return new NextResponse('EVENT_RECEIVED', { status: 200 });
    } catch (error) {
        console.error('❌ Webhook Error:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
