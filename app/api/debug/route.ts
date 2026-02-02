import { NextResponse } from 'next/server';

export async function GET() {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
        return NextResponse.json({ status: 'Missing', detail: 'GEMINI_API_KEY is not set' });
    }
    return NextResponse.json({
        status: 'Present',
        length: key.length,
        prefix: key.substring(0, 4) + '...',
        message: 'If the prefix above does not match your AI Studio key, update it in Vercel.'
    });
}
