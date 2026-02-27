"use client";

import { useEffect, useState } from 'react';
import { Clock, Loader2, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBusinessHours } from '@/app/actions/getBusinessHours';
import { updateBusinessHours } from '@/app/actions/updateBusinessHours';

function to12h(hour: number): { h: number; period: 'AM' | 'PM' } {
    if (hour === 0) return { h: 12, period: 'AM' };
    if (hour === 12) return { h: 12, period: 'PM' };
    if (hour > 12) return { h: hour - 12, period: 'PM' };
    return { h: hour, period: 'AM' };
}

function to24h(h: number, period: 'AM' | 'PM'): number {
    if (period === 'AM' && h === 12) return 0;
    if (period === 'PM' && h === 12) return 12;
    if (period === 'PM') return h + 12;
    return h;
}

function formatLabel(hour: number): string {
    const { h, period } = to12h(hour);
    return `${h}:00 ${period}`;
}

export default function BusinessHoursEditor() {
    const [hours, setHours] = useState({ open: 14, close: 22 });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    // Editing state in 12h format
    const [openH, setOpenH] = useState(2);
    const [openP, setOpenP] = useState<'AM' | 'PM'>('PM');
    const [closeH, setCloseH] = useState(10);
    const [closeP, setCloseP] = useState<'AM' | 'PM'>('PM');

    useEffect(() => {
        getBusinessHours().then(data => {
            setHours(data);
            const o = to12h(data.open);
            const c = to12h(data.close);
            setOpenH(o.h); setOpenP(o.period);
            setCloseH(c.h); setCloseP(c.period);
            setLoading(false);
        });
    }, []);

    const handleSave = async () => {
        const open24 = to24h(openH, openP);
        const close24 = to24h(closeH, closeP);

        if (open24 >= close24) {
            alert("La hora de apertura debe ser antes del cierre.");
            return;
        }

        setSaving(true);
        const result = await updateBusinessHours(open24, close24);
        setSaving(false);

        if (result.success) {
            setHours({ open: open24, close: close24 });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } else {
            alert(result.error || "Error al actualizar horario.");
        }
    };

    const hasChanges = to24h(openH, openP) !== hours.open || to24h(closeH, closeP) !== hours.close;

    if (loading) return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center justify-center" style={{ minHeight: 200 }}>
            <Loader2 className="animate-spin text-slate-300" size={32} />
        </div>
    );

    const hourNums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 relative overflow-hidden hover:shadow-md transition-shadow"
        >
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-500">
                    <Clock size={20} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-slate-800">Horario Operativo</h3>
                    <p className="text-xs text-slate-400">
                        {formatLabel(hours.open)} — {formatLabel(hours.close)}
                    </p>
                </div>
            </div>

            {/* Time Selectors */}
            <div className="flex items-center gap-3 mb-4">
                {/* OPEN */}
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Abre</label>
                    <div className="flex gap-1.5">
                        <select
                            value={openH}
                            onChange={e => setOpenH(Number(e.target.value))}
                            className="flex-1 px-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-violet-200 focus:border-violet-300 outline-none appearance-none text-center cursor-pointer"
                        >
                            {hourNums.map(h => <option key={h} value={h}>{h}:00</option>)}
                        </select>
                        <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                            <button
                                onClick={() => setOpenP('AM')}
                                className={`px-2.5 py-2 text-xs font-bold transition-colors ${openP === 'AM' ? 'bg-violet-500 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                            >AM</button>
                            <button
                                onClick={() => setOpenP('PM')}
                                className={`px-2.5 py-2 text-xs font-bold transition-colors ${openP === 'PM' ? 'bg-violet-500 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                            >PM</button>
                        </div>
                    </div>
                </div>

                <span className="text-slate-300 font-bold mt-5">—</span>

                {/* CLOSE */}
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 block">Cierra</label>
                    <div className="flex gap-1.5">
                        <select
                            value={closeH}
                            onChange={e => setCloseH(Number(e.target.value))}
                            className="flex-1 px-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-violet-200 focus:border-violet-300 outline-none appearance-none text-center cursor-pointer"
                        >
                            {hourNums.map(h => <option key={h} value={h}>{h}:00</option>)}
                        </select>
                        <div className="flex rounded-xl border border-slate-200 overflow-hidden">
                            <button
                                onClick={() => setCloseP('AM')}
                                className={`px-2.5 py-2 text-xs font-bold transition-colors ${closeP === 'AM' ? 'bg-violet-500 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                            >AM</button>
                            <button
                                onClick={() => setCloseP('PM')}
                                className={`px-2.5 py-2 text-xs font-bold transition-colors ${closeP === 'PM' ? 'bg-violet-500 text-white' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                            >PM</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <AnimatePresence>
                {hasChanges && (
                    <motion.button
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full py-2.5 bg-violet-500 text-white rounded-xl font-bold text-sm hover:bg-violet-600 disabled:opacity-50 transition-colors shadow-sm shadow-violet-200 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <>Guardar Horario</>
                        )}
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Saved confirmation */}
            <AnimatePresence>
                {saved && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex items-center justify-center gap-2 py-2 text-sm font-bold text-emerald-500"
                    >
                        <Check size={16} /> Guardado
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
