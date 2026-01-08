"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import { motion } from 'framer-motion';
import { createBrowserClient } from '@supabase/ssr';

export default function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();

    // Use createBrowserClient to ensure cookies are set for Middleware
    const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) {
                console.error('Login Error:', error);
                setError(error.message === 'Invalid login credentials' ? 'Credenciales incorrectas' : 'Error al iniciar sesión');
                setLoading(false);
            } else {
                console.log('Login Success:', data);
                // Force a hard navigation to ensure clean state if router.push is acting up
                window.location.href = '/admin';
            }
        } catch (err) {
            console.error('Unexpected Login Error:', err);
            setError('Ocurrió un error inesperado');
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen grid place-items-center bg-yoko-dark relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] pointer-events-none"></div>

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm relative z-10"
            >
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-yoko-light rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-dashed border-yoko-primary">
                        <Lock className="text-yoko-primary w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-serif font-bold text-yoko-dark">Admin Access</h1>
                    <p className="text-gray-400 text-sm">Ingrese credenciales</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Email"
                            className="w-full p-4 rounded-xl border border-gray-200 outline-none focus:border-yoko-primary transition-all bg-gray-50"
                            required
                        />
                    </div>
                    <div>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Contraseña"
                            className="w-full p-4 rounded-xl border border-gray-200 outline-none focus:border-yoko-primary transition-all bg-gray-50"
                            required
                        />
                    </div>

                    {error && <p className="text-red-500 text-sm text-center font-bold">{error}</p>}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-yoko-primary hover:bg-yoko-secondary text-white font-bold py-4 rounded-xl shadow-lg hover:shadow-green-900/20 transition-all transform active:scale-95 disabled:opacity-50"
                    >
                        {loading ? 'Verificando...' : 'Entrar'}
                    </button>
                    <p className="text-center text-xs text-gray-300 mt-4">Solo personal autorizado</p>
                </form>
            </motion.div>
        </div>
    );
}
