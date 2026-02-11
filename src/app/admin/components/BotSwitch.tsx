"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Power, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function BotSwitch() {
    const [maintenance, setMaintenance] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        fetchConfig();
    }, []);

    const fetchConfig = async () => {
        try {
            const { data, error } = await supabase
                .from('app_config')
                .select('value')
                .eq('key', 'maintenance_mode')
                .single();

            if (data) {
                // Handle JSONB value (might be string "true" or boolean true)
                const val = data.value;
                setMaintenance(val === true || val === 'true');
            }
        } catch (e) {
            console.error("Error fetching config:", e);
        } finally {
            setLoading(false);
        }
    };

    const toggleMaintenance = async () => {
        if (maintenance === null) return;
        setUpdating(true);

        const newValue = !maintenance;

        // Optimistic UI
        setMaintenance(newValue);

        try {
            const { error } = await supabase
                .from('app_config')
                .upsert({
                    key: 'maintenance_mode',
                    value: newValue,
                    updated_at: new Date().toISOString()
                });

            if (error) throw error;

            // --- TRIGGER NOTIFICATIONS ON OPENING ---
            if (newValue === false) { // Using newValue to match existing variable
                // Switching to ONLINE -> Notify Pre-Orders
                console.log("🔔 Triggering Pre-Order Notifications...");
                fetch('https://xsolxbroqqjkoseksmny.supabase.co/functions/v1/whatsapp-webhook?action=notify_preorders&secret=yoko_master_key')
                    .then(res => res.json())
                    .then(data => console.log("✅ Notifications Result:", data))
                    .catch(err => console.error("❌ Notification Error:", err));
            }

            // Optional: Show toast or feedback
        } catch (e) { // Using 'e' to match existing catch variable
            console.error("Error updating config:", e);
            setMaintenance(!newValue); // Revert
            alert("No se pudo actualizar el estado del bot.");
        } finally {
            setUpdating(false); // Using setUpdating to match existing variable
        }
    };

    if (loading) return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-40 flex items-center justify-center">
            <Loader2 className="animate-spin text-slate-300" size={32} />
        </div>
    );

    const isActive = maintenance === false;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`p-6 rounded-3xl shadow-sm border h-40 flex flex-col justify-between relative overflow-hidden transition-colors duration-500
                ${isActive
                    ? 'bg-white border-slate-100 hover:border-emerald-200'
                    : 'bg-amber-50 border-amber-200'}
            `}
        >
            <div className="flex justify-between items-start z-10">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors duration-500 ${isActive ? 'bg-emerald-50 text-emerald-500' : 'bg-amber-100 text-amber-600'}`}>
                    {isActive ? <Power size={24} /> : <AlertTriangle size={24} />}
                </div>

                {/* Switch UI */}
                <button
                    onClick={toggleMaintenance}
                    disabled={updating}
                    className={`rounded-full p-1 w-14 transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 ${isActive ? 'bg-slate-200' : 'bg-amber-500'}`}
                >
                    <div className={`w-6 h-6 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${isActive ? 'translate-x-0' : 'translate-x-7'}`} />
                </button>
            </div>

            <div className="z-10">
                <div className="flex items-center gap-2">
                    <span className={`text-4xl font-black tracking-tight transition-colors duration-500 ${isActive ? 'text-slate-900' : 'text-amber-700'}`}>
                        {isActive ? 'ONLINE' : 'PAUSADO'}
                    </span>
                    {updating && <Loader2 size={16} className="animate-spin text-slate-400" />}
                </div>
                <p className={`text-xs font-bold uppercase tracking-wide mt-1 flex items-center gap-1 transition-colors duration-500 ${isActive ? 'text-slate-400' : 'text-amber-600/70'}`}>
                    {isActive ? (
                        <><CheckCircle2 size={12} className="text-emerald-500" /> Bot Operando Normal</>
                    ) : (
                        "🔧 Modo Mantenimiento Activo"
                    )}
                </p>
            </div>

            {/* Background Decoration */}
            <div className={`absolute right-[-20px] bottom-[-20px] opacity-5 transition-transform duration-500 group-hover:scale-110 ${isActive ? 'rotate-0' : 'rotate-12'}`}>
                <Power size={140} />
            </div>
        </motion.div>
    );
}
