import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
    try {
        let response = NextResponse.next({
            request: {
                headers: request.headers,
            },
        })

        // Only run on admin routes
        if (!request.nextUrl.pathname.startsWith('/admin')) {
            return response;
        }

        // Skip logic on login page
        if (request.nextUrl.pathname === '/admin/login') {
            return response;
        }

        // Use fallback keys if env vars are missing (Fix for Vercel Edge Runtime)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://xsolxbroqqjkoseksmny.supabase.co';
        const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzb2x4YnJvcXFqa29zZWtzbW55Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc2MTQ2MTksImV4cCI6MjA4MzE5MDYxOX0.sGIq7yEoEw5Sw1KKHhRQOEJGX2HjEDcOelO49IVhndk';

        const supabase = createServerClient(
            supabaseUrl,
            supabaseKey,
            {
                cookies: {
                    get(name: string) {
                        return request.cookies.get(name)?.value
                    },
                    set(name: string, value: string, options: CookieOptions) {
                        request.cookies.set({
                            name,
                            value,
                            ...options,
                        })
                        response = NextResponse.next({
                            request: {
                                headers: request.headers,
                            },
                        })
                        response.cookies.set({
                            name,
                            value,
                            ...options,
                        })
                    },
                    remove(name: string, options: CookieOptions) {
                        request.cookies.set({
                            name,
                            value: '',
                            ...options,
                        })
                        response = NextResponse.next({
                            request: {
                                headers: request.headers,
                            },
                        })
                        response.cookies.set({
                            name,
                            value: '',
                            ...options,
                        })
                    },
                },
            }
        )

        /* 
        // DISABLED due to client-side localStorage usage (supabase-js vs ssr)
        const { data: { user }, error: authError } = await supabase.auth.getUser()

        // Debug logging
        if (request.nextUrl.pathname.startsWith('/admin')) {
            console.log(`Middleware Auth Check [${request.nextUrl.pathname}]`);
            console.log('User Found:', !!user);
            if (authError) console.log('Auth Error:', authError.message);
        }

        if (!user && request.nextUrl.pathname.startsWith('/admin')) {
            console.log('Middleware: Redirecting to login due to missing user.');
             const redirectUrl = request.nextUrl.clone()
             redirectUrl.pathname = '/admin/login'
             return NextResponse.redirect(redirectUrl)
        }
        */

        return response
    } catch (e) {
        console.error('Middleware Execution Error:', e);
        // Fallback: If middleware fails, letting the request pass MIGHT be insecure for Admin,
        // so safer to redirect to login.
        const redirectUrl = request.nextUrl.clone()
        redirectUrl.pathname = '/admin/login'
        return NextResponse.redirect(redirectUrl)
    }
}

export const config = {
    matcher: [
        '/admin/:path*',
    ],
}
