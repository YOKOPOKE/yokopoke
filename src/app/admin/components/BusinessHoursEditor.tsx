"use client";

import { useEffect, useState } from 'react';
import { Clock, Loader2, Save, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getBusinessHours } from '@/app/actions/getBusinessHours';
import { updateBusinessHours } from '@/app/actions/updateBusinessHours';

export default function BusinessHoursEditor() {
    const [hours, setHours] = useState({ open: 14, close: 22 });
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [tempHours, setTempHours] = useState({ open: 14, close: 22 });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getBusinessHours().then(data => {
            setHours(data);
            setTempHours(data);
            setLoading(false);
        });
    }, []);

    const handleSave = async () => {
        setSaving(true);
        const result = await updateBusinessHours(Number(tempHours.open), Number(tempHours.close));
        setSaving(false);

        if (result.success) {
            setHours(tempHours);
            setIsEditing(false);
        } else {
            alert(result.error || "Error al actualizar horario.");
        }
    };

    if (loading) return (
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-40 flex items-center justify-center">
            <Loader2 className="animate-spin text-slate-300" size={32} />
        </div>
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 h-40 flex flex-col justify-between relative overflow-hidden hover:shadow-md transition-shadow group"
        >
            <div className="flex justify-between items-start z-10">
                <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center text-violet-500">
                    <Clock size={24} />
                </div>

                {!isEditing ? (
                    <button
                        onClick={() => setIsEditing(true)}
                        className="text-xs font-bold text-slate-400 hover:text-violet-500 bg-slate-50 hover:bg-violet-50 px-3 py-1.5 rounded-lg transition-colors"
                    >
                        Editar
                    </button>
                ) : (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsEditing(false)}
                            className="p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:bg-slate-200"
                        >
                            <X size={16} />
                        </button>
                    </div>
                )}
            </div>

            <div className="z-10">
                <AnimatePresence mode="wait">
                    {!isEditing ? (
                        <motion.div
                            key="view"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                        >
                            <div className="text-3xl font-black text-slate-900 tracking-tight flex items-baseline gap-1">
                                {hours.open}:00 <span className="text-sm text-slate-400 font-bold">-</span> {hours.close}:00
                            </div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-1">Horario Operativo</p>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="edit"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center gap-2"
                        >
                            <input
                                type="number"
                                min="0" max="23"
                                value={tempHours.open}
                                onChange={e => setTempHours({ ...tempHours, open: Math.min(23, Math.max(0, Number(e.target.value))) })}
                                className="w-16 p-2 bg-slate-50 border border-slate-200 rounded-lg text-lg font-bold text-center focus:ring-2 focus:ring-violet-200 outline-none"
                            />
                            <span className="font-bold text-slate-300">-</span>
                            <input
                                type="number"
                                min="0" max="23"
                                value={tempHours.close}
                                onChange={e => setTempHours({ ...tempHours, close: Math.min(23, Math.max(0, Number(e.target.value))) })}
                                className="w-16 p-2 bg-slate-50 border border-slate-200 rounded-lg text-lg font-bold text-center focus:ring-2 focus:ring-violet-200 outline-none"
                            />
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="p-2 bg-violet-500 text-white rounded-lg hover:bg-violet-600 disabled:opacity-50 transition-colors shadow-sm shadow-violet-200"
                            >
                                {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <div className="absolute right-[-20px] bottom-[-20px] opacity-5 group-hover:scale-110 transition-transform duration-500 text-violet-500">
                <Clock size={140} />
            </div>
        </motion.div>
    );
}
