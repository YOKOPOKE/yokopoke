"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Plus, Trash2, Edit2, Save, X, ChevronRight, ChevronDown, ChevronLeft, Move, Copy, ArrowLeft, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/context/ToastContext';

export const dynamic = 'force-dynamic';

// --- Types ---
type Product = {
    id: number;
    name: string;
    slug: string;
    category_id: number | null;
};

type ProductStep = {
    id: number;
    product_id: number;
    step_order: number;
    label: string;
    description?: string;
    min_selections: number;
    max_selections: number;
    included_selections: number;
    price_per_extra: number;
    is_required: boolean;
};

type StepOption = {
    id: number;
    step_id: number;
    name: string;
    price_extra: number;
    is_available: boolean;
};

type Ingredient = {
    id: number;
    name: string;
    premium_price: number;
};

export default function BuilderPage() {
    // const supabase = createClient(); // Use global instance
    const { showToast } = useToast();

    const [products, setProducts] = useState<Product[]>([]);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [steps, setSteps] = useState<ProductStep[]>([]);
    const [expandedStep, setExpandedStep] = useState<number | null>(null);
    const [stepOptions, setStepOptions] = useState<Record<number, StepOption[]>>({});
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);

    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Initial Load
    useEffect(() => {
        const loadInitial = async () => {
            const { data: prods } = await supabase.from('products').select('id, name, slug, category_id').order('name');
            if (prods) setProducts(prods);

            const { data: ings } = await supabase.from('ingredients').select('id, name, premium_price').order('name');
            if (ings) setIngredients(ings);

            // Load ALL steps for preview cards
            const { data: allSteps } = await supabase
                .from('product_steps')
                .select('id, product_id, step_order, label, min_selections, max_selections, included_selections, price_per_extra, is_required')
                .order('step_order');
            if (allSteps) setSteps(allSteps);

            setLoading(false);
        };
        loadInitial();
    }, []);

    // Load Steps when Product Selected
    useEffect(() => {
        if (!selectedProduct) {
            setSteps([]);
            setStepOptions({}); // Clear options cache when product changes
            return;
        }

        const loadSteps = async () => {
            console.log('🔍 Loading steps for product:', selectedProduct.name, 'ID:', selectedProduct.id);

            const { data, error } = await supabase
                .from('product_steps')
                .select('id, product_id, step_order, label, min_selections, max_selections, included_selections, price_per_extra, is_required, name')
                .eq('product_id', selectedProduct.id)
                .order('step_order');

            if (error) {
                console.error('❌ Error loading steps:', error);
            } else {
                console.log('✅ Loaded steps:', data?.length || 0, 'steps:', data);
                setSteps(data || []);
            }

            // Clear step options cache when switching products
            setStepOptions({});
        };
        loadSteps();
    }, [selectedProduct]);

    // Load Options when Step Expanded
    useEffect(() => {
        if (!expandedStep) return;
        if (stepOptions[expandedStep]) return;

        const loadOptions = async () => {
            const { data } = await supabase
                .from('step_options')
                .select('*')
                .eq('step_id', expandedStep)
                .order('name');

            if (data) {
                setStepOptions(prev => ({ ...prev, [expandedStep]: data }));
            }
        };
        loadOptions();
    }, [expandedStep]);


    // --- Handlers ---

    const handleCreateStep = async () => {
        if (!selectedProduct) return;
        const newOrder = steps.length + 1;

        const payload = {
            product_id: selectedProduct.id,
            step_order: newOrder,
            name: 'Nuevo Paso', // Required by DB
            label: 'Nuevo Paso',
            min_selections: 1,
            max_selections: 1,
            included_selections: 1,
            price_per_extra: 0,
            is_required: true
        };

        const { data, error } = await supabase.from('product_steps').insert(payload).select().single();

        if (error) {
            console.error("Error creating step:", error);
            showToast(`Error: ${error.message || 'Check console'}`, 'error');
        } else if (data) {
            setSteps([...steps, data]);
            showToast('Paso creado', 'success');
        }
    };

    const handleDeleteStep = async (stepId: number) => {
        if (!confirm("¿Seguro? Esto borrará todas las opciones de este paso.")) return;
        const { error } = await supabase.from('product_steps').delete().eq('id', stepId);
        if (error) showToast('Error al eliminar', 'error');
        else {
            setSteps(steps.filter(s => s.id !== stepId));
            showToast('Paso eliminado', 'success');
        }
    };

    const handleUpdateStep = (stepId: number, field: keyof ProductStep, value: any) => {
        // Update local state ONLY
        const updatedSteps = steps.map(s => s.id === stepId ? { ...s, [field]: value } : s);
        setSteps(updatedSteps);
    };

    const handleSaveStep = async (step: ProductStep) => {
        const payload = {
            label: step.label,
            name: step.label, // Sync name with label
            min_selections: step.min_selections,
            max_selections: step.max_selections,
            included_selections: step.included_selections,
            price_per_extra: step.price_per_extra,
            is_required: step.is_required
        };

        const { error } = await supabase.from('product_steps').update(payload).eq('id', step.id);

        if (error) {
            console.error(error);
            showToast('Error al guardar', 'error');
        } else {
            showToast('Cambios guardados', 'success');
        }
    };


    const handleAddOption = async (stepId: number, name: string = "Nueva Opción", price: number = 0) => {
        const { data, error } = await supabase.from('step_options').insert({
            step_id: stepId,
            name: name,
            price_extra: price,
            is_available: true
        }).select().single();

        if (error) {
            console.error("Error creating option:", error);
            showToast(`Error op: ${error.message}`, 'error');
        } else if (data) {
            setStepOptions(prev => ({
                ...prev,
                [stepId]: [...(prev[stepId] || []), data]
            }));
            showToast('Opción agregada', 'success');
        }
    };

    const handleDeleteOption = async (stepId: number, optId: number) => {
        const { error } = await supabase.from('step_options').delete().eq('id', optId);
        if (!error) {
            setStepOptions(prev => ({
                ...prev,
                [stepId]: prev[stepId].filter(o => o.id !== optId)
            }));
        }
    };

    const handleMoveStep = async (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === steps.length - 1) return;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        const currentStep = steps[index];
        const targetStep = steps[targetIndex];

        // Swap orders
        const newCurrentOrder = targetStep.step_order;
        const newTargetOrder = currentStep.step_order;

        // Optimistic update
        const newSteps = [...steps];
        newSteps[index] = { ...currentStep, step_order: newCurrentOrder };
        newSteps[targetIndex] = { ...targetStep, step_order: newTargetOrder };

        // Sort by order to keep UI consistent
        newSteps.sort((a, b) => a.step_order - b.step_order);
        setSteps(newSteps);

        // DB Update
        await supabase.from('product_steps').update({ step_order: newCurrentOrder }).eq('id', currentStep.id);
        await supabase.from('product_steps').update({ step_order: newTargetOrder }).eq('id', targetStep.id);
    };

    const handleToggleRequired = (step: ProductStep) => {
        const newValue = !step.is_required;
        handleUpdateStep(step.id, 'is_required', newValue);
        // Auto-save toggle for better UX, or let them click save. 
        // Let's mark it as dirty in UI? For now, we update local state and user must click Save to persist? 
        // No, for toggles user expects instant feedback usually, but consistency says use the Save button.
        // However, I'll update the visual toggle immediately via handleUpdateStep.
    };

    const handleImportIngredient = async (stepId: number, ingredient: Ingredient) => {
        await handleAddOption(stepId, ingredient.name, ingredient.premium_price);
    };


    if (loading) return <div className="p-10 flex items-center justify-center h-screen text-slate-400 font-bold">Cargando Builder...</div>;

    return (
        <div className="p-4 md:p-8 min-h-screen bg-slate-50">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h5 className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase mb-1">Configuración</h5>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 leading-none">
                        Reglas <span className="text-indigo-600 hidden md:inline">de Armado</span>
                    </h1>
                </div>
                {selectedProduct && (
                    <button
                        onClick={() => setSelectedProduct(null)}
                        className="lg:hidden flex items-center gap-2 text-sm font-bold text-slate-500 bg-white px-3 py-2 rounded-lg shadow-sm border border-slate-200"
                    >
                        <ArrowLeft size={16} /> Volver
                    </button>
                )}
            </div>

            {/* Conditional Layout: Grid when no selection, Full editor when selected */}
            {!selectedProduct ? (
                // Product Grid - Full Width
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200/60">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-2xl font-black text-slate-800">Productos</h3>
                            <p className="text-sm text-slate-500 mt-1">Selecciona un producto para configurar sus pasos de armado</p>
                        </div>
                        <span className="bg-indigo-100 text-indigo-700 text-lg font-black px-4 py-2 rounded-full">{products.length}</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {products
                            .sort((a, b) => {
                                // Priority: Poke and Sushi Burger first
                                const isPriorityA = a.name.toLowerCase().includes('poke') || a.name.toLowerCase().includes('sushi burger');
                                const isPriorityB = b.name.toLowerCase().includes('poke') || b.name.toLowerCase().includes('sushi burger');
                                if (isPriorityA && !isPriorityB) return -1;
                                if (!isPriorityA && isPriorityB) return 1;
                                return a.name.localeCompare(b.name);
                            })
                            .map(p => {
                                const productSteps = steps.filter(s => s.product_id === p.id).sort((a, b) => a.step_order - b.step_order);
                                const stepCount = productSteps.length;

                                // Debug logging
                                if (p.name.toLowerCase().includes('poke')) {
                                    console.log(`Product: ${p.name} (ID: ${p.id})`);
                                    console.log(`Steps found:`, productSteps);
                                    console.log(`Step count: ${stepCount}`);
                                }

                                return (
                                    <motion.button
                                        key={p.id}
                                        onClick={() => setSelectedProduct(p)}
                                        whileHover={{ scale: 1.04, y: -6 }}
                                        whileTap={{ scale: 0.98 }}
                                        transition={{ type: "spring", stiffness: 400, damping: 25 }}
                                        className="group relative bg-gradient-to-br from-white via-white to-indigo-50/30 p-6 rounded-[2.5rem] transition-all duration-500 border-2 border-indigo-200/40 hover:border-indigo-400/60 hover:shadow-2xl hover:shadow-indigo-200/30 text-left overflow-hidden"
                                    >
                                        {/* Decorative ambient glow */}
                                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/0 via-purple-500/5 to-pink-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

                                        {/* Decorative corner */}
                                        <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-indigo-500/15 to-purple-500/15 rounded-bl-full rounded-tr-[2.5rem] blur-sm" />

                                        {/* Content */}
                                        <div className="relative z-10">
                                            <h4 className="text-lg font-black text-slate-800 mb-3 leading-tight group-hover:text-indigo-600 transition-colors">
                                                {p.name}
                                            </h4>

                                            {/* Step Preview */}
                                            {stepCount > 0 ? (
                                                <div className="mb-4 space-y-1.5">
                                                    {productSteps.slice(0, 3).map((step, idx) => (
                                                        <div key={step.id} className="flex items-center gap-2 text-xs text-slate-600">
                                                            <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-[10px]">
                                                                {idx + 1}
                                                            </span>
                                                            <span className="truncate font-medium">{step.label}</span>
                                                        </div>
                                                    ))}
                                                    {stepCount > 3 && (
                                                        <div className="text-xs text-slate-400 font-medium pl-7">
                                                            +{stepCount - 3} más...
                                                        </div>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="mb-4 text-xs text-slate-400 italic">
                                                    Sin pasos configurados
                                                </div>
                                            )}

                                            <div className="flex items-center justify-between">
                                                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold ${stepCount > 0
                                                    ? 'bg-green-100 text-green-700 border border-green-200'
                                                    : 'bg-slate-100 text-slate-500 border border-slate-200'
                                                    }`}>
                                                    <Move size={16} />
                                                    <span>{stepCount} {stepCount === 1 ? 'paso' : 'pasos'}</span>
                                                </div>

                                                <ChevronRight size={20} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                            </div>
                                        </div>
                                    </motion.button>
                                );
                            })}
                    </div>
                </div>
            ) : (
                // Steps Editor - Full Width
                <div className="flex flex-col">
                    {selectedProduct ? (
                        <div className="flex flex-col h-full">
                            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100 mb-4 sticky top-0 z-10">
                                <div>
                                    <h2 className="text-lg font-black text-slate-800 leading-tight">{selectedProduct.name}</h2>
                                    <span className="text-xs font-bold text-slate-400">{steps.length} pasos configurados</span>
                                </div>
                                <button onClick={handleCreateStep} className="flex items-center gap-2 bg-slate-900 text-white px-3 py-2 rounded-xl font-bold hover:bg-black transition-colors text-xs md:text-sm">
                                    <Plus size={16} /> <span className="hidden md:inline">Agregar Paso</span>
                                </button>
                            </div>

                            <div className="space-y-6 overflow-y-auto pb-32 pr-2">
                                <AnimatePresence mode="popLayout">
                                    {steps.map((step, index) => (
                                        <motion.div
                                            key={step.id}
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            whileHover={{ y: -4, scale: 1.01 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                            className="bg-gradient-to-br from-white via-white to-slate-50/30 rounded-[2.5rem] shadow-lg border-2 border-slate-200/60 hover:shadow-2xl hover:shadow-indigo-200/30 hover:border-indigo-300/50 transition-all duration-500 overflow-hidden group backdrop-blur-sm"
                                        >
                                            {/* Ambient gradient overlay */}
                                            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 bg-gradient-to-br ${expandedStep === step.id ? 'from-indigo-500/10 via-purple-500/5 to-transparent' : 'from-indigo-500/5 via-purple-500/3 to-transparent'} pointer-events-none`} />

                                            {/* --- Premium Step Header --- */}
                                            <div className="p-5 flex flex-col gap-4 relative">
                                                {/* Left decorative bar with gradient */}
                                                <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-500 ${expandedStep === step.id ? 'bg-gradient-to-b from-indigo-500 via-purple-500 to-indigo-500 shadow-lg shadow-indigo-500/50' : 'bg-gradient-to-b from-slate-200 to-slate-300 group-hover:from-indigo-300 group-hover:to-purple-300'}`} />

                                                <div className="flex items-start gap-4">
                                                    {/* Step Number & Reorder */}
                                                    <div className="flex-shrink-0 flex flex-col items-center gap-2">
                                                        <div className="w-12 h-12 flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl font-black text-xl shadow-xl shadow-slate-900/30 z-10 relative group-hover:scale-110 transition-transform duration-300">
                                                            <span className="drop-shadow-sm">{index + 1}</span>
                                                        </div>
                                                        <div className="flex flex-col gap-1">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleMoveStep(index, 'up'); }}
                                                                disabled={index === 0}
                                                                className="p-1 text-slate-300 hover:text-indigo-600 disabled:opacity-0 transition-colors"
                                                            >
                                                                <ChevronLeft size={16} className="rotate-90" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleMoveStep(index, 'down'); }}
                                                                disabled={index === steps.length - 1}
                                                                className="p-1 text-slate-300 hover:text-indigo-600 disabled:opacity-0 transition-colors"
                                                            >
                                                                <ChevronRight size={16} className="rotate-90" />
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Title & Main Info */}
                                                    <div className="flex-1 w-full pt-1">
                                                        <input
                                                            value={step.label}
                                                            onChange={(e) => handleUpdateStep(step.id, 'label', e.target.value)}
                                                            className="w-full text-xl font-black text-slate-800 bg-transparent outline-none placeholder:text-slate-300 mb-3 border-b-2 border-transparent focus:border-indigo-100 transition-colors py-1"
                                                            placeholder="Nombre del paso (ej: Elige tu Proteína)"
                                                        />

                                                        {/* Status Badges / Toggles */}
                                                        <div className="flex items-center gap-4">
                                                            <button
                                                                onClick={() => handleToggleRequired(step)}
                                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide transition-all border ${step.is_required
                                                                    ? 'bg-indigo-50 text-indigo-600 border-indigo-200 pr-4'
                                                                    : 'bg-slate-50 text-slate-400 border-slate-200 pl-4'
                                                                    }`}
                                                            >
                                                                {!step.is_required && <span className="w-2 h-2 rounded-full bg-slate-300" />}
                                                                {step.is_required ? 'Requerido' : 'Opcional'}
                                                                {step.is_required && <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-sm shadow-indigo-300" />}
                                                            </button>

                                                            <div className="h-4 w-px bg-slate-200" />

                                                            <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
                                                                <span className="font-black text-slate-600">{stepOptions[step.id]?.length || 0}</span> opciones
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* Actions Toolbar */}
                                                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-100">
                                                        <button
                                                            onClick={() => setExpandedStep(expandedStep === step.id ? null : step.id)}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                                                        >
                                                            {expandedStep === step.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                                        </button>
                                                        <div className="w-px h-6 bg-slate-200 mx-1" />
                                                        <button
                                                            onClick={() => handleSaveStep(step)}
                                                            className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-white rounded-lg transition-all"
                                                            title="Guardar Cambios"
                                                        >
                                                            <Save size={20} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteStep(step.id)}
                                                            className="p-2 text-red-300 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                                                        >
                                                            <Trash2 size={20} />
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* --- Pro Rules Control Bar --- */}
                                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/80 p-3 rounded-2xl border border-slate-100/50 mt-2">
                                                    {/* Min */}
                                                    <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                                                        <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                                                            <span className="text-xs">MIN</span>
                                                        </div>
                                                        <div>
                                                            <input
                                                                type="number"
                                                                value={step.min_selections ?? 0}
                                                                onChange={(e) => handleUpdateStep(step.id, 'min_selections', parseInt(e.target.value) || 0)}
                                                                className="w-12 text-center font-black text-slate-700 outline-none text-lg border-b border-transparent focus:border-emerald-300"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Max */}
                                                    <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                                                        <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center font-bold">
                                                            <span className="text-xs">MAX</span>
                                                        </div>
                                                        <div>
                                                            <input
                                                                type="number"
                                                                value={step.max_selections ?? 1}
                                                                onChange={(e) => handleUpdateStep(step.id, 'max_selections', parseInt(e.target.value) || 1)}
                                                                className="w-12 text-center font-black text-slate-700 outline-none text-lg border-b border-transparent focus:border-orange-300"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Included */}
                                                    <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                                                        <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                                            <Copy size={16} /> {/* Icon for 'Included' or 'Pack' */}
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">Incluye</span>
                                                            <input
                                                                type="number"
                                                                value={step.included_selections ?? 1}
                                                                onChange={(e) => handleUpdateStep(step.id, 'included_selections', parseInt(e.target.value) || 1)}
                                                                className="w-12 font-black text-slate-700 outline-none text-sm border-b border-transparent focus:border-blue-300"
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Extra Price */}
                                                    <div className="flex items-center gap-3 bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                                                        <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center text-sm font-bold">
                                                            $
                                                        </div>
                                                        <div className="flex flex-col">
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase leading-none">Extra</span>
                                                            <input
                                                                type="number"
                                                                value={step.price_per_extra ?? 0}
                                                                onChange={(e) => handleUpdateStep(step.id, 'price_per_extra', parseFloat(e.target.value) || 0)}
                                                                className="w-16 font-black text-slate-700 outline-none text-sm border-b border-transparent focus:border-purple-300"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* --- Options Section (Collapsible) --- */}
                                            <AnimatePresence>
                                                {expandedStep === step.id && (
                                                    <motion.div
                                                        initial={{ height: 0, opacity: 0 }}
                                                        animate={{ height: "auto", opacity: 1 }}
                                                        exit={{ height: 0, opacity: 0 }}
                                                        className="bg-slate-50 border-t border-slate-100"
                                                    >
                                                        <div className="p-5">
                                                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-4">
                                                                <div>
                                                                    <h4 className="font-black text-slate-700 text-sm uppercase tracking-wide">Opciones del Paso</h4>
                                                                    <p className="text-xs text-slate-400 font-medium mt-1">Define qué puede elegir el cliente aquí.</p>
                                                                </div>

                                                                <div className="flex gap-2 w-full md:w-auto">
                                                                    {/* Import Toggle / Button */}
                                                                    <div className="relative group w-full md:w-auto">
                                                                        <button className="w-full md:w-auto flex items-center justify-center gap-2 text-xs font-bold text-indigo-600 bg-white border-2 border-indigo-100 px-4 py-2.5 rounded-xl hover:bg-indigo-50 hover:border-indigo-200 transition-all shadow-sm">
                                                                            <Copy size={14} /> <span>Importar Ingredientes</span>
                                                                        </button>
                                                                        {/* Dropdown */}
                                                                        <div className="absolute top-full right-0 mt-2 w-64 bg-white shadow-2xl shadow-indigo-100 rounded-2xl border border-slate-100 max-h-60 overflow-y-auto hidden group-hover:block z-50 py-2 transform origin-top-right transition-all">
                                                                            {ingredients.map(ing => (
                                                                                <button
                                                                                    key={ing.id}
                                                                                    onClick={() => handleImportIngredient(step.id, ing)}
                                                                                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 rounded-xl text-xs text-slate-600 font-bold truncate flex justify-between items-center group/ing transition-colors"
                                                                                >
                                                                                    {ing.name}
                                                                                    <span className="w-5 h-5 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-full opacity-0 group-hover/ing:opacity-100 transition-opacity">
                                                                                        <Plus size={12} />
                                                                                    </span>
                                                                                </button>
                                                                            ))}
                                                                        </div>
                                                                    </div>

                                                                    <button
                                                                        onClick={() => handleAddOption(step.id)}
                                                                        className="w-full md:w-auto flex items-center justify-center gap-2 text-xs font-bold text-white bg-slate-900 border-2 border-slate-900 px-4 py-2.5 rounded-xl hover:bg-black hover:border-black transition-all shadow-lg shadow-slate-200"
                                                                    >
                                                                        <Plus size={14} /> <span>Crear Manual</span>
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                                                {stepOptions[step.id]?.map(opt => (
                                                                    <div key={opt.id} className="bg-white p-4 rounded-[1.5rem] border-2 border-slate-200/60 flex items-center gap-3 shadow-md hover:shadow-xl hover:shadow-indigo-200/30 hover:border-indigo-300/60 transition-all duration-300 group relative overflow-hidden hover:scale-[1.02]">
                                                                        {/* Gradient indicator */}
                                                                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-indigo-400 via-purple-500 to-pink-400 shadow-sm" />

                                                                        <div className="pl-2 flex-1 min-w-0">
                                                                            <input
                                                                                className="w-full text-sm font-bold text-slate-800 outline-none bg-transparent truncate mb-1"
                                                                                defaultValue={opt.name}
                                                                                onBlur={async (e) => {
                                                                                    if (e.target.value !== opt.name) {
                                                                                        await supabase.from('step_options').update({ name: e.target.value }).eq('id', opt.id);
                                                                                    }
                                                                                }}
                                                                            />
                                                                            <div className="flex items-center px-2 py-1 bg-slate-50 rounded-lg w-fit">
                                                                                <span className="text-[10px] font-bold text-slate-400 mr-1">EXTRA:</span>
                                                                                <span className="text-xs font-bold text-slate-600">$</span>
                                                                                <input
                                                                                    type="number"
                                                                                    className="w-12 bg-transparent outline-none text-xs font-bold text-slate-600 ml-0.5"
                                                                                    defaultValue={opt.price_extra}
                                                                                    onBlur={async (e) => {
                                                                                        const val = parseFloat(e.target.value);
                                                                                        if (val !== opt.price_extra) {
                                                                                            await supabase.from('step_options').update({ price_extra: val }).eq('id', opt.id);
                                                                                        }
                                                                                    }}
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                        <button
                                                                            onClick={() => handleDeleteOption(step.id, opt.id)}
                                                                            className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100"
                                                                            title="Eliminar Opción"
                                                                        >
                                                                            <Trash2 size={16} />
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>

                                                            {(!stepOptions[step.id] || stepOptions[step.id].length === 0) && (
                                                                <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                                                    <p className="text-sm font-bold text-slate-400 mb-1">Paso vacío</p>
                                                                    <p className="text-xs text-slate-300">Agrega opciones manuales o importa ingredientes.</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>

                                {steps.length === 0 && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        className="text-center py-20"
                                    >
                                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                                            <Edit2 size={32} />
                                        </div>
                                        <h3 className="text-xl font-bold text-slate-700 mb-2">Comienza a configurar</h3>
                                        <p className="text-slate-400 text-sm max-w-xs mx-auto mb-6">Este producto no tiene reglas de armado. Crea el primer paso para empezar.</p>
                                        <button onClick={handleCreateStep} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-black transition-colors shadow-xl shadow-slate-200">
                                            Crear Primer Paso
                                        </button>
                                    </motion.div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-300 border-2 border-dashed border-slate-200 rounded-3xl min-h-[50vh] bg-slate-50/50">
                            <Edit2 size={48} className="mb-4 opacity-50" />
                            <p className="font-bold text-lg text-slate-400 px-6 text-center">Selecciona un producto de la izquierda para comenzar</p>
                            <p className="text-sm mt-2 text-slate-400">Configura tus Pokes, Burgers y más.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
