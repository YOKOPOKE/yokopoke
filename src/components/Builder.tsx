
"use client";

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, ShoppingBag, AlertCircle, X } from 'lucide-react';
import Image from 'next/image';
import { useCart } from '@/context/CartContext';
import { createClient } from '@/lib/supabase';
import { BuilderSkeleton } from './ui/BuilderSkeleton';

// Animation Variants
const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

// --- Types ---
type ProductOption = {
    id: number;
    name: string;
    price_extra: number;
    image_url?: string;
    is_available: boolean;
};

type ProductStep = {
    id: number;
    name: string;
    label: string;
    order: number;
    min_selections: number;
    max_selections: number | null;
    included_selections: number;
    price_per_extra: number;
    options: ProductOption[];
};
// ...



type Product = {
    id: number;
    name: string;
    slug: string;
    type?: string;
    base_price: number;
    description?: string;
    image_url?: string;
    steps: ProductStep[];
};

type SelectionState = {
    [stepId: number]: ProductOption[];
};

export default function Builder({ initialProductSlug = 'poke-mediano', onBack }: { initialProductSlug?: string; onBack?: () => void }) {
    const supabase = createClient();
    const { addToCart } = useCart();

    // Data State
    const [product, setProduct] = useState<Product | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Builder State
    const [currentStepIndex, setCurrentStepIndex] = useState(0);
    const [selections, setSelections] = useState<SelectionState>({});
    const [direction, setDirection] = useState(0);

    // Mobile Summary State
    const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Scroll to top on step change
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, [currentStepIndex]);

    // Fetch Logic
    useEffect(() => {
        const fetchProductTree = async () => {
            setLoading(true);
            try {
                // 1. Fetch Product
                const { data: prodData, error: prodError } = await supabase
                    .from('products')
                    .select('*')
                    .eq('slug', initialProductSlug)
                    .single();

                if (prodError || !prodData) throw new Error('Producto no encontrado');

                // 2. Fetch Steps
                const { data: stepsData, error: stepsError } = await supabase
                    .from('product_steps')
                    .select('*')
                    .eq('product_id', prodData.id)
                    .order('order', { ascending: true });

                if (stepsError) throw stepsError;

                // 3. Fetch Options
                const stepIds = stepsData.map(s => s.id);
                let optionsData: any[] = [];

                if (stepIds.length > 0) {
                    const { data, error } = await supabase
                        .from('step_options')
                        .select('*')
                        .in('step_id', stepIds)
                        .eq('is_available', true)
                        .order('name', { ascending: true });
                    if (error) throw error;
                    optionsData = data;
                }

                // 4. Assemble Tree (with strict type casting)
                const stepsWithOptions = stepsData.map(step => ({
                    ...step,
                    id: Number(step.id),
                    order: Number(step.order),
                    min_selections: Number(step.min_selections),
                    max_selections: step.max_selections === '' || step.max_selections === null ? null : Number(step.max_selections),
                    included_selections: Number(step.included_selections ?? 0),
                    price_per_extra: Number(step.price_per_extra ?? 0),
                    options: optionsData
                        .filter(opt => Number(opt.step_id) === Number(step.id))
                        .map(opt => ({
                            ...opt,
                            price_extra: Number(opt.price_extra ?? 0)
                        }))
                }));

                // Add artificial delay for smooth skeleton transition
                await new Promise(resolve => setTimeout(resolve, 1000));

                setProduct({
                    ...prodData,
                    base_price: Number(prodData.base_price ?? 0),
                    steps: stepsWithOptions
                });
                setLoading(false);

            } catch (err: any) {
                console.error(err);
                setError(err.message || 'Error desconocido');
                setLoading(false);
            }
        };

        if (initialProductSlug) {
            fetchProductTree();
        }
    }, [initialProductSlug, supabase]);

    // Helpers
    const handleToggleOption = (opt: ProductOption) => {
        if (!product) return;
        const step = product.steps[currentStepIndex];
        const current = selections[step.id] || [];
        const isSelected = current.some(s => s.id === opt.id);

        let newSelection;
        if (isSelected) {
            newSelection = current.filter(s => s.id !== opt.id);
        } else {
            // Check limits
            // Logic: 
            // 1. If max_selections is 1, always Swap (Radio behavior).
            // 2. If max_selections > 1 (or null/infinite), Add (Checkbox behavior) unless Hard Limit reached.

            if (step.max_selections === 1) {
                newSelection = [opt];
            } else {
                // Multi-select allowed. Check if Hard Limit reached.
                if (step.max_selections !== null && current.length >= step.max_selections) {
                    return; // Hard Limit Max Reached. Cannot add more.
                    // Optional: Toast "Maximo X alcanzado"
                }
                newSelection = [...current, opt];
            }
        }
        setSelections({ ...selections, [step.id]: newSelection });
    };

    const canProceed = (step: ProductStep) => {
        const current = selections[step.id] || [];
        return current.length >= step.min_selections;
    };

    const handleNext = () => {
        if (!product) return;
        if (currentStepIndex < product.steps.length - 1) {
            setDirection(1);
            setCurrentStepIndex(prev => prev + 1);
        }
    };

    const handlePrev = () => {
        if (currentStepIndex > 0) {
            setDirection(-1);
            setCurrentStepIndex(prev => prev - 1);
        }
    };

    const calculateTotal = () => {
        if (!product) return 0;
        let total = product.base_price;

        product.steps.forEach(step => {
            const stepSels = selections[step.id] || [];
            // Ensure included is a number (handle null/string)
            const included = Number(step.included_selections ?? 0);

            stepSels.forEach((sel, idx) => {
                // Logic: The first 'included' selections are fully free (waive option price + step extra price).
                const isFree = idx < included;

                if (!isFree) {
                    // It's an extra. Charge Step Price + Option Premium
                    total += (step.price_per_extra || 0);
                    if (sel.price_extra) total += sel.price_extra;
                }
            });
        });

        return total;
    };

    const handleAddToCart = () => {
        if (!product) return;

        // Flatten details for display with price breakdown
        const details: { label: string; value: string }[] = [];

        product.steps.forEach(step => {
            const sels = selections[step.id] || [];
            if (sels.length > 0) {
                const included = Number(step.included_selections ?? 0);

                const formattedValues = sels.map((sel, idx) => {
                    const isFree = idx < included;
                    let extraCost = 0;

                    if (!isFree) {
                        extraCost += (Number(step.price_per_extra) || 0);
                        if (sel.price_extra) extraCost += Number(sel.price_extra);
                    }

                    return extraCost > 0
                        ? `${sel.name} (+$${extraCost})`
                        : sel.name;
                });

                details.push({
                    label: step.label,
                    value: formattedValues.join(', ')
                });
            }
        });

        // Calculate breakdown
        const total = calculateTotal();
        const base = Number(product.base_price);
        const extras = total - base;

        addToCart({
            name: product.name,
            productType: product.type === 'burger' ? 'burger' : 'bowl',
            price: total,
            quantity: 1,
            // @ts-ignore
            details: details,
            image: product.image_url,
            priceBreakdown: {
                base: base,
                extras: extras
            }
        }, true); // Open drawer

        if (onBack) onBack();
    };


    // --- RENDER ---

    if (loading) return <BuilderSkeleton />;
    if (error || !product) return <div className="min-h-screen flex items-center justify-center text-red-500 font-bold">Error: {error}</div>;

    const currentStep = product.steps[currentStepIndex];
    if (!currentStep) return <div>Fin del camino.</div>;

    return (
        <div className="fixed inset-0 bg-white z-50 flex flex-col lg:flex-row">

            {/* LEFT: CONTENT */}
            <div className="flex-1 flex flex-col h-full bg-slate-50/50 relative">
                {/* Header */}
                <header className="px-4 md:px-8 py-4 md:py-6 flex justify-between items-center bg-white border-b border-slate-100 z-20">
                    <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-900 font-bold transition-colors group">
                        <div className="p-2 rounded-full bg-slate-100 group-hover:bg-slate-200 transition-colors">
                            <ChevronLeft size={20} />
                        </div>
                        <span className="hidden sm:inline">Cancelar</span>
                    </button>

                    <div className="flex flex-col items-center">
                        <span className="text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Armando tu</span>
                        <h2 className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-tight">{product.name}</h2>
                    </div>

                    <div className="w-24 flex justify-end">
                        {/* Mobile Summary Toggle */}
                        <button
                            onClick={() => setIsMobileSummaryOpen(true)}
                            className="lg:hidden flex flex-col items-end"
                        >
                            <span className="text-xs font-bold text-slate-400 uppercase">Total</span>
                            <span className="font-mono font-bold text-lg text-violet-600">${calculateTotal()}</span>
                        </button>
                        <span className="hidden lg:block font-mono font-bold text-lg text-violet-600">${calculateTotal()}</span>
                    </div>
                </header>

                {/* Step Area */}
                <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-12 pb-32">
                    <AnimatePresence mode="wait" custom={direction}>
                        <motion.div
                            key={currentStep.id}
                            custom={direction}
                            initial={{ x: direction > 0 ? 50 : -50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            exit={{ x: direction > 0 ? -50 : 50, opacity: 0 }}
                            transition={{ duration: 0.3, ease: "circOut" }}
                            className="max-w-4xl mx-auto"
                        >
                            <div className="text-center mb-8 md:mb-12">
                                <span className="text-xs font-bold text-violet-500 tracking-widest uppercase mb-2 block">Paso {currentStepIndex + 1} de {product.steps.length}</span>
                                <h3 className="text-3xl md:text-5xl font-black text-slate-900 mb-4 leading-tight">{currentStep.label}</h3>
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-slate-200 shadow-sm text-sm font-bold text-slate-600">
                                    <AlertCircle size={16} className="text-violet-500" />
                                    Elige {currentStep.max_selections ? `hasta ${currentStep.max_selections}` : 'tus favoritos'}
                                </div>
                            </div>

                            <motion.div
                                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
                                variants={containerVariants}
                                initial="hidden"
                                animate="show"
                                key={currentStep.id} // Re-trigger on step change
                            >
                                {currentStep.options.length === 0 && (
                                    <div className="col-span-full text-center text-slate-400 py-10">
                                        No hay opciones disponibles para este paso.
                                    </div>
                                )}
                                {currentStep.options.map((opt) => {
                                    const currentSels = selections[currentStep.id] || [];
                                    const isSelected = currentSels.some(s => s.id === opt.id);

                                    // Dynamic Pricing Logic for Display
                                    const includedCount = currentStep.included_selections || 0;
                                    const alreadySelectedCount = currentSels.length;

                                    // Calculate actual cost if I were to add this item
                                    let displayPrice = 0;

                                    if (!isSelected) {
                                        // Will this be the (N+1)th item?
                                        const predictionIndex = alreadySelectedCount; // 0-based, so if 0 selected, prediction is 0 (1st item)
                                        const isFree = predictionIndex < includedCount;

                                        if (!isFree) {
                                            // It will cost Extra
                                            displayPrice += (currentStep.price_per_extra || 0);
                                            if (opt.price_extra) displayPrice += opt.price_extra;
                                        }
                                    } else {
                                        // If already selected, show what it IS costing? 
                                        const myIndex = currentSels.findIndex(s => s.id === opt.id);
                                        const isFree = myIndex !== -1 && myIndex < includedCount;

                                        if (!isFree) {
                                            displayPrice += (currentStep.price_per_extra || 0);
                                            if (opt.price_extra) displayPrice += opt.price_extra;
                                        }
                                    }

                                    return (
                                        <motion.div
                                            key={opt.id}
                                            variants={itemVariants}
                                            onClick={() => handleToggleOption(opt)}
                                            className={`
                                                cursor-pointer rounded-2xl p-4 border transition-all duration-200 group relative overflow-hidden transform-gpu
                                                ${isSelected
                                                    ? 'border-violet-500 bg-violet-50/50 shadow-md ring-2 ring-violet-500/20'
                                                    : 'border-slate-200 bg-white hover:border-violet-300 hover:shadow-lg hover:-translate-y-1'
                                                }
                                            `}
                                        >
                                            <div className="flex justify-between w-full">
                                                <div className={`
                                                            w-6 h-6 rounded-full flex items-center justify-center border transition-colors
                                                            ${isSelected ? 'bg-violet-500 border-violet-500 text-white' : 'border-slate-300 bg-slate-50'}
                                                        `}>
                                                    {isSelected && <Check size={14} strokeWidth={3} />}
                                                </div>
                                                {displayPrice > 0 && (
                                                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${isSelected ? 'bg-white/20' : 'bg-slate-100 text-slate-500'}`}>
                                                        +${displayPrice}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="relative z-10 w-full">
                                                <div className="font-bold text-base leading-tight">{opt.name}</div>
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </motion.div>
                        </motion.div>
                    </AnimatePresence>
                </div>

                {/* Bottom Controls */}
                <div className="absolute bottom-0 left-0 w-full bg-white border-t border-slate-200 p-4 md:p-6 flex justify-between items-center z-20 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)]">
                    <button
                        onClick={handlePrev}
                        disabled={currentStepIndex === 0}
                        className={`
                            w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center font-bold transition-all
                            ${currentStepIndex === 0 ? 'bg-slate-100 text-slate-300' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}
                        `}
                    >
                        <ChevronLeft size={24} />
                    </button>

                    <div className="flex gap-1 md:gap-2">
                        {product.steps.map((_, idx) => (
                            <div key={idx} className={`h-2 rounded-full transition-all ${idx === currentStepIndex ? 'bg-violet-600 w-6' : 'bg-slate-200 w-2'}`} />
                        ))}
                    </div>

                    {currentStepIndex < product.steps.length - 1 ? (
                        <button
                            onClick={handleNext}
                            disabled={!canProceed(currentStep)}
                            className={`
                                h-12 md:h-14 px-6 md:px-8 rounded-full font-bold flex items-center gap-2 transition-all
                                ${canProceed(currentStep)
                                    ? 'bg-slate-900 text-white hover:bg-black shadow-lg shadow-slate-900/20'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }
                            `}
                        >
                            <span>Siguiente</span>
                            <ChevronRight size={20} />
                        </button>
                    ) : (
                        <button
                            onClick={handleAddToCart}
                            disabled={!canProceed(currentStep)}
                            className={`
                                h-12 md:h-14 px-6 md:px-8 rounded-full font-bold flex items-center gap-2 transition-all
                                ${canProceed(currentStep)
                                    ? 'bg-violet-600 text-white hover:bg-violet-700 shadow-lg shadow-violet-600/30'
                                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                                }
                            `}
                        >
                            <ShoppingBag size={20} />
                            <span className="hidden sm:inline">Agregar al Pedido</span>
                            <span className="sm:hidden">Agregar</span>
                        </button>
                    )}
                </div>
            </div>

            {/* RIGHT: SIDEBAR SUMMARY (Desktop) */}
            <div className="hidden lg:flex w-[400px] bg-white border-l border-slate-100 flex-col shadow-2xl z-30">
                <SummaryContent product={product} selections={selections} currentStepIndex={currentStepIndex} total={calculateTotal()} />
            </div>

            {/* MOBILE SUMMARY OVERLAY */}
            <AnimatePresence>
                {isMobileSummaryOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-sm lg:hidden"
                        onClick={() => setIsMobileSummaryOpen(false)}
                    >
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="absolute bottom-0 left-0 w-full h-[80vh] bg-white rounded-t-[2rem] shadow-2xl flex flex-col"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="flex justify-between items-center p-6 border-b border-slate-100">
                                <h3 className="font-black text-2xl text-slate-900">Resumen</h3>
                                <button onClick={() => setIsMobileSummaryOpen(false)} className="p-2 bg-slate-100 rounded-full">
                                    <X size={20} />
                                </button>
                            </div>
                            <SummaryContent product={product} selections={selections} currentStepIndex={currentStepIndex} total={calculateTotal()} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
}

// Extracted Summary Component for reuse
function SummaryContent({ product, selections, currentStepIndex, total }: { product: Product, selections: SelectionState, currentStepIndex: number, total: number }) {
    return (
        <>
            <div className="p-8 bg-slate-50 border-b border-slate-100">
                <h3 className="font-black text-2xl text-slate-800 mb-1">Tu Creación</h3>
                <p className="text-slate-400 text-sm">Ingredientes seleccionados</p>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
                {product.steps.map((step, idx) => {
                    const stepSels = selections[step.id] || [];
                    const isActive = idx === currentStepIndex;
                    // Always show past steps. Show current. Don't show future empty.
                    if (stepSels.length === 0 && !isActive && idx > currentStepIndex) return null;

                    return (
                        <div key={step.id} className={`relative pl-8 border-l-2 ${isActive ? 'border-violet-500' : 'border-slate-200'} pb-2 last:border-0 last:pb-0`}>
                            <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 bg-white transition-colors ${isActive ? 'border-violet-500 scale-125' : 'border-slate-300'}`} />

                            <h4 className={`text-xs font-bold uppercase tracking-widest mb-3 ${isActive ? 'text-violet-600' : 'text-slate-400'}`}>
                                {step.label}
                            </h4>

                            {stepSels.length > 0 ? (
                                <div className="space-y-2">
                                    {stepSels.map(sel => (
                                        <div key={sel.id} className="flex justify-between items-center text-sm font-bold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <span>{sel.name}</span>
                                            {sel.price_extra > 0 && (
                                                <span className="text-violet-600 bg-violet-50 px-2 py-0.5 rounded text-xs">+${sel.price_extra}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-slate-300 italic">Sin selección aún...</p>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100">
                <div className="flex justify-between items-end mb-2">
                    <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Total</span>
                    <span className="text-4xl font-black text-slate-900 tracking-tight">${total}</span>
                </div>
            </div>
        </>
    );
}
