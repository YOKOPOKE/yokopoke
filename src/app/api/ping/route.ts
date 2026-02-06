import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json({ status: 'ok', version: '2.1', timestamp: new Date().toISOString() });
}
