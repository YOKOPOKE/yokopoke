"use client";

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase';
import { Plus, Trash2, Fish, Carrot, Utensils, Droplet, Cookie, Star, ArrowRight, ArrowLeft, Save, Edit3, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type SizeRule = {
    id: number;
    name: string;
    description?: string; // Optional description
    image_url?: string; // New field
    base_price: number;
    included_proteins: number;
    price_extra_protein: number;
    included_toppings: number; // Mixins
    price_extra_topping: number;
    included_crunches: number; // Toppings
    price_extra_crunch: number;
    included_sauces: number;
    price_extra_sauce: number;
    included_bases: number;
    price_extra_base: number;
    included_extras: number;
    price_extra_extra: number;
};

// Configuration Sections for Step 2
const CONFIG_SECTIONS = [
    { id: 'bases', title: 'Bases', icon: <Utensils size={20} />, includedKey: 'included_bases', extraKey: 'price_extra_base', color: 'bg-orange-100 text-orange-600' },
    { id: 'proteins', title: 'Proteínas', icon: <Fish size={20} />, includedKey: 'included_proteins', extraKey: 'price_extra_protein', color: 'bg-blue-100 text-blue-600' },
    { id: 'mixins', title: 'Mixins', icon: <Carrot size={20} />, includedKey: 'included_toppings', extraKey: 'price_extra_topping', color: 'bg-green-100 text-green-600' },
    { id: 'sauces', title: 'Salsas', icon: <Droplet size={20} />, includedKey: 'included_sauces', extraKey: 'price_extra_sauce', color: 'bg-red-100 text-red-600' },
    { id: 'crunches', title: 'Crunches', icon: <Cookie size={20} />, includedKey: 'included_crunches', extraKey: 'price_extra_crunch', color: 'bg-yellow-100 text-yellow-600' },
    { id: 'extras', title: 'Extras', icon: <Star size={20} />, includedKey: 'included_extras', extraKey: 'price_extra_extra', color: 'bg-purple-100 text-purple-600' },
] as const;

export default function AdminSettingsPage() {
    const supabase = createClient();
    const [rules, setRules] = useState<SizeRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Editor State
    const [viewMode, setViewMode] = useState<'list' | 'editor'>('list');
    const [editingRule, setEditingRule] = useState<Partial<SizeRule>>({});
    const [currentStep, setCurrentStep] = useState(1); // 1: Info, 2: Rules

    useEffect(() => {
        fetchRules();
    }, []);

    const fetchRules = async () => {
        setLoading(true);
        const { data } = await supabase.from('sizes').select('*').order('id');
        if (data) setRules(data as SizeRule[]);
        setLoading(false);
    };

    const handleCreate = () => {
        setEditingRule({
            name: '',
            base_price: 150,
            included_bases: 1, price_extra_base: 0,
            included_proteins: 2, price_extra_protein: 45,
            included_toppings: 4, price_extra_topping: 15,
            included_sauces: 2, price_extra_sauce: 10,
            included_crunches: 2, price_extra_crunch: 10,
            included_extras: 0, price_extra_extra: 25
        });
        setCurrentStep(1);
        setViewMode('editor');
    };

    const handleEdit = (rule: SizeRule) => {
        setEditingRule({ ...rule });
        setCurrentStep(1);
        setViewMode('editor');
    };

    const handleSave = async () => {
        if (!editingRule.name || !editingRule.base_price) return alert('Por favor completa la información básica.');

        // @ts-ignore
        if (editingRule.id) {
            // @ts-ignore
            await supabase.from('sizes').update(editingRule).eq('id', editingRule.id);
        } else {
            await supabase.from('sizes').insert(editingRule);
        }

        await fetchRules();
        setViewMode('list');
    };

    const handleDelete = async (id: number) => {
        if (!confirm('¿Eliminar esta configuración?')) return;
        await supabase.from('sizes').delete().eq('id', id);
        fetchRules();
    };

    const updateField = (key: keyof SizeRule, value: any) => {
        setEditingRule(prev => ({ ...prev, [key]: value }));
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return;

        const file = e.target.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `bowls/${fileName}`;

        setUploading(true);
        try {
            // Check/Create bucket logic could go here but assuming 'menu' exists for now
            // Or use 'menu-items' if that was established. Let's try 'menu' as it's generic.
            const { error: uploadError } = await supabase.storage
                .from('menu')
                .upload(filePath, file);

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('menu').getPublicUrl(filePath);

            updateField('image_url', data.publicUrl);
        } catch (error: any) {
            alert('Error subiendo imagen. Asegúrate que el bucket "menu" exista en Supabase. ' + error.message);
        } finally {
            setUploading(false);
        }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Cargando...</div>;

    return (
        <div className="pb-20 min-h-screen bg-white">
            <AnimatePresence mode="wait">
                {viewMode === 'list' ? (
                    <motion.div
                        key="list"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-8"
                    >
                        <div className="flex justify-between items-center border-b border-gray-100 pb-6">
                            <div>
                                <h1 className="text-3xl font-serif font-bold text-yoko-dark">Reglas de Bowls</h1>
                                <p className="text-gray-500 mt-1">Gestiona los tamaños y costos disponibles.</p>
                            </div>
                            <button
                                onClick={handleCreate}
                                className="bg-yoko-dark text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition-all shadow-lg active:scale-95"
                            >
                                <Plus size={20} /> Nuevo Tamaño
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {rules.map(rule => (
                                <motion.div
                                    layoutId={`card-${rule.id}`}
                                    key={rule.id}
                                    onClick={() => handleEdit(rule)}
                                    className="group bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-xl hover:border-yoko-primary/30 transition-all cursor-pointer relative overflow-hidden"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 rounded-2xl bg-gray-50 overflow-hidden flex items-center justify-center font-bold text-xl text-yoko-dark group-hover:bg-yoko-primary group-hover:text-white transition-colors relative">
                                            {rule.image_url ? (
                                                <img src={rule.image_url} alt={rule.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <span>{rule.name.charAt(0)}</span>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-end">
                                            <span className="text-2xl font-bold text-yoko-dark">${rule.base_price}</span>
                                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Precio Base</span>
                                        </div>
                                    </div>

                                    <h3 className="text-xl font-bold text-yoko-dark mb-4">{rule.name}</h3>

                                    <div className="space-y-2">
                                        <div className="flex justify-between text-sm text-gray-500 py-1 border-b border-gray-50">
                                            <span>Proteínas Incluidas</span>
                                            <span className="font-bold text-yoko-dark">{rule.included_proteins}</span>
                                        </div>
                                        <div className="flex justify-between text-sm text-gray-500 py-1 border-b border-gray-50">
                                            <span>Mixins Incluidos</span>
                                            <span className="font-bold text-yoko-dark">{rule.included_toppings}</span>
                                        </div>
                                    </div>

                                    <div className="mt-6 flex items-center justify-between text-yoko-primary font-bold text-sm opacity-0 group-hover:opacity-100 transition-opacity translate-y-2 group-hover:translate-y-0">
                                        <span>Editar Configuración</span>
                                        <ArrowRight size={16} />
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="editor"
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 50 }}
                        className="max-w-4xl mx-auto"
                    >
                        {/* Editor Header */}
                        <div className="flex items-center justify-between mb-8 sticky top-0 bg-white/90 backdrop-blur z-20 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setViewMode('list')}
                                    className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-yoko-dark transition"
                                >
                                    <ArrowLeft size={24} />
                                </button>
                                <div>
                                    <h2 className="text-2xl font-bold text-yoko-dark">
                                        {// @ts-ignore
                                            editingRule.id ? `Editar ${editingRule.name}` : 'Nuevo Tamaño'}
                                    </h2>
                                    <div className="flex items-center gap-2 text-sm text-gray-500">
                                        <span className={currentStep === 1 ? 'text-yoko-primary font-bold' : ''}>Paso 1: Información</span>
                                        <ChevronRight size={14} />
                                        <span className={currentStep === 2 ? 'text-yoko-primary font-bold' : ''}>Paso 2: Reglas</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                {currentStep === 1 ? (
                                    <button
                                        onClick={() => setCurrentStep(2)}
                                        className="bg-yoko-dark text-white px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-black transition shadow-lg"
                                    >
                                        Siguiente <ArrowRight size={18} />
                                    </button>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => setCurrentStep(1)}
                                            className="px-6 py-2.5 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition"
                                        >
                                            Atrás
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            className="bg-yoko-primary text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-yoko-secondary transition shadow-lg shadow-yoko-primary/30"
                                        >
                                            <Save size={18} /> Guardar Todo
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Steps Content */}
                        <div className="min-h-[400px]">
                            <AnimatePresence mode="wait">
                                {currentStep === 1 ? (
                                    <motion.div
                                        key="step1"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -10 }}
                                        className="bg-white border border-gray-100 rounded-3xl p-8 shadow-sm space-y-8"
                                    >
                                        <div>
                                            <label className="block text-sm font-bold text-gray-500 uppercase mb-3">Nombre del Bowl</label>
                                            <input
                                                type="text"
                                                value={editingRule.name || ''}
                                                onChange={e => updateField('name', e.target.value)}
                                                className="w-full text-4xl font-bold text-yoko-dark placeholder-gray-200 border-none p-0 focus:ring-0"
                                                placeholder="Ej. Pokewon"
                                                autoFocus
                                            />
                                            <p className="text-gray-400 text-sm mt-2">Este nombre será visible para los clientes.</p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-8 pt-8 border-t border-gray-50">
                                            <div>
                                                <label className="block text-sm font-bold text-yoko-primary uppercase mb-3">Precio Base</label>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-3xl font-bold text-gray-300">$</span>
                                                    <input
                                                        type="number"
                                                        value={editingRule.base_price || ''}
                                                        onChange={e => updateField('base_price', parseFloat(e.target.value))}
                                                        className="w-full text-4xl font-black text-yoko-dark border-none p-0 focus:ring-0"
                                                        placeholder="0.00"
                                                    />
                                                </div>
                                            </div>

                                            {/* Image Upload Area */}
                                            <div className="relative group">
                                                <label className="block text-sm font-bold text-gray-400 uppercase mb-3">Imagen del Bowl</label>
                                                <div className="bg-gray-50 rounded-2xl h-40 flex flex-col justify-center items-center text-center border-2 border-dashed border-gray-200 overflow-hidden relative cursor-pointer hover:border-yoko-primary transition-colors">
                                                    {editingRule.image_url ? (
                                                        <>
                                                            <img src={editingRule.image_url} alt="Preview" className="w-full h-full object-cover" />
                                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <span className="text-white font-bold text-sm">Cambiar Imagen</span>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 mb-2 group-hover:bg-yoko-primary/10 group-hover:text-yoko-primary transition">
                                                                <Star size={20} />
                                                            </div>
                                                            <p className="text-xs text-gray-400 font-bold">{uploading ? 'Subiendo...' : 'Clic para subir imagen'}</p>
                                                        </>
                                                    )}
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={handleImageUpload}
                                                        disabled={uploading}
                                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                ) : (
                                    <motion.div
                                        key="step2"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-6"
                                    >
                                        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex gap-3 text-blue-800 text-sm">
                                            <Utensils size={20} className="shrink-0" />
                                            <p>Configura cuántas porciones incluye el precio base y cuánto cuesta cada porción extra.</p>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {CONFIG_SECTIONS.map((section) => (
                                                <div key={section.id} className="bg-white border border-gray-100 rounded-3xl p-6 hover:shadow-md transition-shadow">
                                                    <div className="flex items-center gap-3 mb-6">
                                                        <div className={`w-10 h-10 rounded-xl ${section.color} flex items-center justify-center`}>
                                                            {section.icon}
                                                        </div>
                                                        <h3 className="font-bold text-lg text-yoko-dark">{section.title}</h3>
                                                    </div>

                                                    <div className="space-y-4">
                                                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                                                            <span className="text-sm font-bold text-gray-500">Incluidos</span>
                                                            <div className="flex items-center gap-3 bg-white px-2 py-1 rounded-lg border border-gray-200">
                                                                <button
                                                                    // @ts-ignore
                                                                    onClick={() => updateField(section.includedKey, Math.max(0, (editingRule[section.includedKey as keyof SizeRule] as number || 0) - 1))}
                                                                    className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-yoko-primary"
                                                                >-</button>
                                                                <span className="w-6 text-center font-bold text-yoko-dark">{editingRule[section.includedKey as keyof SizeRule]}</span>
                                                                <button
                                                                    // @ts-ignore
                                                                    onClick={() => updateField(section.includedKey, (editingRule[section.includedKey as keyof SizeRule] as number || 0) + 1)}
                                                                    className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-yoko-primary"
                                                                >+</button>
                                                            </div>
                                                        </div>

                                                        <div className="flex justify-between items-center bg-gray-50 p-3 rounded-xl">
                                                            <span className="text-sm font-bold text-gray-500">Costo Extra</span>
                                                            <div className="flex items-center gap-1 bg-white px-3 py-1.5 rounded-lg border border-gray-200 w-24">
                                                                <span className="text-xs font-bold text-gray-400">$</span>
                                                                <input
                                                                    type="number"
                                                                    value={editingRule[section.extraKey as keyof SizeRule]}
                                                                    // @ts-ignore
                                                                    onChange={e => updateField(section.extraKey, parseFloat(e.target.value))}
                                                                    className="w-full font-bold text-yoko-dark text-right border-none p-0 focus:ring-0 text-sm"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Danger Zone (Edit Mode Only) */}
                        {
                            // @ts-ignore
                            editingRule.id && (
                                <div className="mt-12 border-t border-gray-100 pt-8 opacity-50 hover:opacity-100 transition-opacity">
                                    <button
                                        // @ts-ignore
                                        onClick={() => handleDelete(editingRule.id)}
                                        className="flex items-center gap-2 text-red-400 hover:text-red-600 font-bold text-sm"
                                    >
                                        <Trash2 size={16} /> Eliminar este tamaño permanentemente
                                    </button>
                                </div>
                            )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
