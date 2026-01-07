"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, ShoppingBag, RotateCcw } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { createClient } from '@/lib/supabase';

// Types
type Ingredient = {
    id: number;
    name: string;
    premium_price?: number; // legacy name match
    price?: number; // unified alias
    icon?: string;
    type: string;
};

type OrderState = {
    productType: 'bowl' | 'burger';
    size: 'small' | 'medium' | 'large';
    sizeName?: string; // e.g. "Chico", "Mediano"
    base: Ingredient | null;
    proteins: Ingredient[];
    mixins: Ingredient[];
    sauces: Ingredient[];
    toppings: Ingredient[];
    extras: Ingredient[]; // Crunch usually goes here or toppings
    price: number;
};

// Config Rule Type from Supabase
type SizeRule = {
    id: number;
    name: string; // Chico, Mediano, Grande
    image_url?: string; // New field
    base_price: number;
    included_proteins: number;
    price_extra_protein: number;
    included_toppings: number;
    price_extra_topping: number;
    included_crunches: number; // mapped to extras/toppings logic
    price_extra_crunch: number;
    included_sauces: number;
    price_extra_sauce: number;
    included_bases: number;
    price_extra_base: number;
    included_extras: number;
    price_extra_extra: number;
};

export default function Builder({ initialProductType = 'bowl', onBack }: { initialProductType?: 'bowl' | 'burger'; onBack?: () => void }) {
    const supabase = createClient();
    const { addToCart } = useCart();

    // Config State
    const [rules, setRules] = useState<SizeRule[]>([]);
    const [loadingRules, setLoadingRules] = useState(true);
    const [fetchError, setFetchError] = useState<string | null>(null);

    // Current selection
    const [currentStep, setCurrentStep] = useState(0);
    const [direction, setDirection] = useState(0);
    const [menu, setMenu] = useState<Record<string, Ingredient[]>>({});
    const [loadingIngredients, setLoadingIngredients] = useState(true);

    const [order, setOrder] = useState<OrderState>({
        productType: initialProductType,
        size: 'medium', // Default to medium/regular
        sizeName: initialProductType === 'burger' ? 'Sushi Burger' : 'Mediano',
        base: null,
        proteins: [],
        mixins: [],
        sauces: [],
        toppings: [],
        extras: [],
        price: initialProductType === 'burger' ? 180 : 0
    });

    // Initial Data Fetch
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoadingRules(true);
                setLoadingIngredients(true);
                setFetchError(null);

                // 1. Fetch Rules
                const { data: rulesData, error: rulesError } = await supabase.from('sizes').select('*').order('id');

                if (rulesError) throw rulesError;
                if (!rulesData || rulesData.length === 0) throw new Error('No se encontraron reglas de configuración');

                setRules(rulesData as SizeRule[]);

                // Set initial price safely
                const defaultRule = rulesData.find(r => r.name === 'Mediano') || rulesData[0];
                if (defaultRule && initialProductType === 'bowl') {
                    setOrder(prev => ({
                        ...prev,
                        price: defaultRule.base_price,
                        sizeName: defaultRule.name,
                        size: defaultRule.name === 'Chico' ? 'small' : defaultRule.name === 'Grande' ? 'large' : 'medium'
                    }));
                }
                setLoadingRules(false);

                // 2. Fetch Ingredients
                const { data: ingredientsData, error: ingredientsError } = await supabase.from('ingredients').select('*').eq('is_available', true);

                if (ingredientsError) throw ingredientsError;

                if (ingredientsData) {
                    const grouped = ingredientsData.reduce((acc, item) => {
                        let cat = item.type || item.category || 'others';
                        cat = cat.toLowerCase();
                        // Normalize categories (keep sync with logic)
                        if (cat === 'act' || cat === 'extra') cat = 'extras';
                        if (cat === 'topping') cat = 'mixins';
                        if (cat === 'crunch') cat = 'toppings';
                        if (cat === 'protein') cat = 'proteins';
                        if (cat === 'base') cat = 'base';
                        if (cat === 'sauce') cat = 'sauces';

                        if (!acc[cat]) acc[cat] = [];
                        acc[cat].push({ ...item, price: item.premium_price });
                        return acc;
                    }, {} as Record<string, Ingredient[]>);
                    setMenu(grouped);
                }
                setLoadingIngredients(false);

            } catch (err: any) {
                console.error('Builder Data Error:', err);
                setFetchError(err.message || 'Error al conectar con el servidor.');
                setLoadingRules(false);
                setLoadingIngredients(false);
            }
        };

        fetchData();

        // Realtime Subscription for Rules
        const channel = supabase
            .channel('public:sizes')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sizes' }, payload => {
                console.log('Reglas actualizadas en tiempo real!', payload.new);
                setRules(prev => prev.map(r => r.id === payload.new.id ? payload.new as SizeRule : r));
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [initialProductType]);

    // Recalculate Price whenever Order or Rules change
    useEffect(() => {
        // ... (existing bowl logic) ...
        // We will separate logic per product type inside here or refactor

        if (order.productType === 'burger') {
            // Simple Burger Logic
            // Base price from a rule named "Sushi Burger" or fallback
            const burgerRule = rules.find(r => r.name === 'Sushi Burger');
            const basePrice = burgerRule ? burgerRule.base_price : 180; // Fallback price

            // Extra ingredients logic if needed (e.g. extra cheese?)
            // For now, fixed price + extras if any
            let total = basePrice;

            const allIngredients = [...order.proteins, ...order.extras].filter(Boolean) as Ingredient[];
            allIngredients.forEach(i => {
                if (i.price && i.price > 0) total += i.price;
            });

            setOrder(prev => prev.price !== total ? { ...prev, price: total } : prev);
        } else {
            // Existing Bowl Logic (wrapped check)
            if (rules.length === 0) return;
            // Ensure activeRule logic handles undefined properly
            const currentRule = rules.find(r => r.name === order.sizeName) || rules[0];
            if (!currentRule) return;

            let total = currentRule.base_price;
            const extraProteins = Math.max(0, order.proteins.length - currentRule.included_proteins);
            total += extraProteins * currentRule.price_extra_protein;
            const extraMixins = Math.max(0, order.mixins.length - currentRule.included_toppings);
            total += extraMixins * currentRule.price_extra_topping;
            const extraSauces = Math.max(0, order.sauces.length - currentRule.included_sauces);
            total += extraSauces * currentRule.price_extra_sauce;
            const extraCrunches = Math.max(0, order.toppings.length - currentRule.included_crunches);
            total += extraCrunches * currentRule.price_extra_crunch;
            const allIngredients = [order.base, ...order.proteins, ...order.mixins, ...order.sauces, ...order.toppings, ...order.extras].filter(Boolean) as Ingredient[];
            allIngredients.forEach(i => {
                if (i.price && i.price > 0) total += i.price;
            });
            setOrder(prev => prev.price !== total ? { ...prev, price: total } : prev);
        }

    }, [order.base, order.proteins, order.mixins, order.sauces, order.toppings, order.extras, order.sizeName, rules, order.productType]);


    // Actions
    const handleToggle = (stepKey: keyof OrderState, item: Ingredient) => {
        setOrder(prev => {
            // Handle single-selection 'base' specifically
            if (stepKey === 'base') {
                // Toggle off if same, or replace
                if (prev.base?.id === item.id) {
                    return { ...prev, base: null };
                }
                return { ...prev, base: item };
            }

            // Handle multi-selection arrays (or burger flavor disguised as array)
            const currentList = prev[stepKey] as Ingredient[];
            const isSelected = currentList.find(i => i.id === item.id);

            if (isSelected) {
                return { ...prev, [stepKey]: currentList.filter(i => i.id !== item.id) };
            } else {
                if (prev.productType === 'burger' && stepKey === 'proteins') {
                    // Single select for Burger Flavor
                    return { ...prev, proteins: [item] };
                }

                // If multi selection
                if (currentList.length >= 10) return prev; // Safety limit
                return { ...prev, [stepKey]: [...currentList, item] };
            }
        });
    };

    const handleAddToCart = () => {
        addToCart({
            ...order,
            quantity: 1
        });
        resetBuilder();
    };

    const resetBuilder = () => {
        const defaultRule = rules.find(r => r.name === 'Mediano') || rules[0];
        setOrder({
            productType: order.productType, // Keep current mode
            size: 'medium',
            sizeName: 'Mediano',
            base: null,
            proteins: [],
            mixins: [],
            sauces: [],
            toppings: [],
            extras: [],
            price: order.productType === 'burger' ? (rules.find(r => r.name === 'Sushi Burger')?.base_price || 180) : (defaultRule?.base_price || 0)
        });
        setCurrentStep(0);
    };

    const slideVariants = {
        enter: (direction: number) => ({ x: direction > 0 ? 50 : -50, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (direction: number) => ({ x: direction < 0 ? 50 : -50, opacity: 0 })
    };

    const activeRule = rules.find(r => r.name === order.sizeName) || rules[0];

    const BURGER_STEPS = [
        {
            key: 'proteins', // Using proteins to store the flavor
            title: 'Elige tu Sabor',
            subtitle: 'La esencia de tu Sushi Burger',
            type: 'single',
            data: [
                { id: 991, name: 'Spicy', type: 'flavor', icon: '🌶️', price: 0 },
                { id: 992, name: 'Arrachera', type: 'flavor', icon: '🥩', price: 0 }
            ]
        }
    ];

    const BOWL_STEPS = [
        {
            key: 'size',
            title: 'Elige tu Tamaño',
            subtitle: 'La base de tu experiencia',
            type: 'single',
            data: rules.map(r => ({ ...r, price: r.base_price, type: 'size', icon: '🥣' }))
        },
        {
            key: 'base',
            title: 'Elige tu Base',
            subtitle: activeRule ? `${activeRule.included_bases} Incluidas` : '...',
            type: 'multi',
            cat: 'base',
            limit: activeRule?.included_bases || 1,
            extraCost: activeRule?.price_extra_base || 0
        },
        {
            key: 'proteins',
            title: 'Proteínas',
            subtitle: activeRule ? `${activeRule.included_proteins} Incluidas` : '...',
            type: 'multi',
            cat: 'proteins',
            limit: activeRule?.included_proteins || 2,
            extraCost: activeRule?.price_extra_protein || 0
        },
        {
            key: 'mixins',
            title: 'Mixins (Vegetales)',
            subtitle: activeRule ? `${activeRule.included_toppings} Incluidos` : '...',
            type: 'multi',
            cat: 'mixins',
            limit: activeRule?.included_toppings || 4,
            extraCost: activeRule?.price_extra_topping || 0
        },
        {
            key: 'sauces',
            title: 'Salsas',
            subtitle: activeRule ? `${activeRule.included_sauces} Incluidas` : '...',
            type: 'multi',
            cat: 'sauces',
            limit: activeRule?.included_sauces || 2,
            extraCost: activeRule?.price_extra_sauce || 0
        },
        {
            key: 'toppings',
            title: 'Crunch & Toppings',
            subtitle: activeRule ? `${activeRule.included_crunches} Incluidos` : '...',
            type: 'multi',
            cat: 'toppings',
            limit: activeRule?.included_crunches || 2,
            extraCost: activeRule?.price_extra_crunch || 0
        },
        {
            key: 'extras',
            title: 'Extras',
            subtitle: activeRule ? `${activeRule.included_extras} Incluidos` : '...',
            type: 'multi',
            cat: 'extras',
            limit: activeRule?.included_extras || 0,
            extraCost: activeRule?.price_extra_extra || 0
        },
    ];

    const STEPS = order.productType === 'burger' ? BURGER_STEPS : BOWL_STEPS;

    // Safety Check for "White Screen" bug
    const currentScreen = STEPS[currentStep];
    if (!currentScreen) {
        console.error('Builder Error: Invalid Step Index', { currentStep, totalSteps: STEPS.length, productType: order.productType, rulesLoaded: rules.length > 0 });
        // Auto-recover if possible
        if (currentStep > 0) {
            setCurrentStep(0);
            return <div className="p-10 text-center">Recuperando sesión...</div>;
        }
        return (
            <div className="p-20 text-center">
                <h2 className="text-xl font-bold text-red-500 mb-4">Error de Sincronización</h2>
                <button
                    onClick={() => window.location.reload()}
                    className="bg-yoko-dark text-white px-6 py-2 rounded-full font-bold shadow-lg"
                >
                    Recargar Página
                </button>
            </div>
        );
    }

    // Scroll to top on step change
    useEffect(() => {
        const builderTitle = document.getElementById('builder-title');
        if (builderTitle) {
            try {
                builderTitle.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } catch (e) {
                // Ignore scroll errors
            }
        }
    }, [currentStep]);

    const retryFetch = () => window.location.reload();

    if (fetchError) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center p-4">
                <div className="text-red-500 mb-4 text-6xl">⚠️</div>
                <h3 className="text-2xl font-bold text-yoko-dark mb-2">Algo salió mal</h3>
                <p className="text-gray-500 mb-6">{fetchError}</p>
                <button
                    onClick={retryFetch}
                    className="bg-yoko-primary text-white px-8 py-3 rounded-full font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all"
                >
                    Reintentar
                </button>
            </div>
        );
    }

    if (loadingRules || loadingIngredients) return <div className="py-20 text-center animate-pulse text-yoko-primary font-bold">Cargando ingredientes frescos...</div>;

    const containerVariants = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.03
            }
        },
        exit: { opacity: 0 }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0 }
    };

    // ... (rest of logic)

    return (
        <div id="builder" className="max-w-7xl mx-auto my-6 lg:my-10 px-4 lg:px-0">
            {/* Header with Switcher */}
            <div className="flex flex-col items-center mb-8 gap-4">
                <h1 id="builder-title" className="font-serif text-3xl md:text-4xl text-yoko-dark font-bold text-center">
                    {order.productType === 'bowl' ? 'Crea tu Bowl Perfecto' : 'Diseña tu Sushi Burger'}
                </h1>
                <div className="bg-white p-1 rounded-full shadow-sm border border-gray-100 flex gap-1 transform hover:scale-105 transition-transform duration-300">
                    <button
                        onClick={() => {
                            setOrder({
                                productType: 'bowl', size: 'medium', sizeName: 'Mediano', base: null, proteins: [], mixins: [], sauces: [], toppings: [], extras: [],
                                price: rules.find(r => r.name === 'Mediano')?.base_price || 0
                            });
                            setCurrentStep(0);
                        }}
                        className={`px-6 py-2 rounded-full font-bold text-sm md:text-base transition-all ${order.productType === 'bowl' ? 'bg-yoko-dark text-white shadow-md' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                    >
                        🥣 Poke Bowl
                    </button>
                    <button
                        onClick={() => {
                            setOrder({
                                productType: 'burger', size: 'medium', sizeName: 'Sushi Burger', base: null, proteins: [], mixins: [], sauces: [], toppings: [], extras: [],
                                price: rules.find(r => r.name === 'Sushi Burger')?.base_price || 180
                            });
                            setCurrentStep(0);
                        }}
                        className={`px-6 py-2 rounded-full font-bold text-sm md:text-base transition-all flex items-center gap-2 ${order.productType === 'burger' ? 'bg-yoko-dark text-white shadow-md' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
                    >
                        🍔 Sushi Burger <span className="text-[10px] bg-red-500 text-white px-2 py-0.5 rounded-full animate-pulse">HOT</span>
                    </button>
                </div>
            </div>

            <div className="bg-white h-[85vh] md:h-[80vh] min-h-[500px] flex flex-col lg:flex-row shadow-2xl rounded-3xl overflow-hidden border border-gray-100">

                {/* Sidebar (Desktop) */}
                <div className="hidden xl:flex w-80 bg-gray-50 flex-col border-r border-gray-100 p-6 relative z-10">
                    <div className="mb-6 flex justify-between items-center">
                        <h3 className="font-serif font-bold text-xl text-yoko-dark flex items-center gap-2">
                            <ShoppingBag size={20} className="text-yoko-primary" /> Tu Pedido
                        </h3>
                        <button onClick={resetBuilder} className="text-gray-400 hover:text-red-500 transition p-2 hover:bg-red-50 rounded-full" title="Reiniciar">
                            <RotateCcw size={16} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2 pb-20">
                        {/* Dynamic Summary List */}
                        {/* Header Info */}
                        <div className="pb-4 border-b border-gray-100">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Base</span>
                                <span className="text-sm font-bold text-yoko-dark text-right">{order.productType === 'bowl' ? (order.sizeName || activeRule?.name) : 'Sushi Burger'}</span>
                            </div>
                            {order.productType === 'bowl' && (
                                <div className="flex justify-between items-start mt-2">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mt-0.5">Arroz</span>
                                    <span className="text-sm text-gray-600 text-right w-2/3 leading-tight">{order.base ? order.base.name : <span className="text-gray-300 italic">Sin elegir</span>}</span>
                                </div>
                            )}
                        </div>

                        {/* Ingredients List */}
                        {order.productType === 'bowl' ? (
                            [
                                { key: 'proteins', label: 'Proteínas', items: order.proteins },
                                { key: 'mixins', label: 'Mixins', items: order.mixins },
                                { key: 'sauces', label: 'Salsas', items: order.sauces },
                                { key: 'toppings', label: 'Toppings', items: order.toppings },
                                { key: 'extras', label: 'Extras', items: order.extras },
                            ].map(group => group.items.length > 0 && (
                                <div key={group.key} className="space-y-2">
                                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">{group.label}</span>
                                    <div className="space-y-2">
                                        {group.items.map(item => (
                                            <div key={item.id} className="flex justify-between text-sm group">
                                                <span className="text-gray-700 font-medium group-hover:text-yoko-dark transition-colors">{item.name}</span>
                                                {item.price ? <span className="text-xs font-bold text-yoko-accent bg-green-50 px-1.5 py-0.5 rounded-md border border-green-100">+${item.price}</span> : null}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : (
                            // Burger Summary
                            order.proteins.length > 0 && (
                                <div className="space-y-2">
                                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Sabor</span>
                                    <div className="flex justify-between items-center text-sm p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                                        <span className="text-gray-700 font-bold flex items-center gap-2">
                                            <span className="text-xl">{order.proteins[0].icon}</span> {order.proteins[0].name}
                                        </span>
                                    </div>
                                </div>
                            )
                        )}
                    </div>
                    {/* Footer Total */}
                    {/* Footer Total & Actions for Desktop in Sidebar */}
                    <div className="absolute bottom-0 left-0 w-full bg-white border-t border-gray-100 p-6 z-20 shadow-[0_-5px_20px_rgba(0,0,0,0.02)]">
                        <div className="flex flex-col gap-4">
                            <div className="flex justify-between items-end">
                                <span className="text-gray-400 font-bold text-sm uppercase tracking-wider mb-1">Total Confirmado</span>
                                <motion.span
                                    key={order.price}
                                    initial={{ scale: 1.2, color: "#2F5233" }}
                                    animate={{ scale: 1, color: "#2F5233" }}
                                    className="text-3xl font-serif font-bold text-yoko-primary"
                                >
                                    ${order.price}
                                </motion.span>
                            </div>

                            {/* Desktop Actions */}
                            <div className="hidden xl:flex gap-2">
                                <button
                                    disabled={currentStep === 0 && !onBack}
                                    onClick={() => {
                                        if (currentStep === 0 && onBack) {
                                            onBack();
                                        } else {
                                            setCurrentStep(prev => Math.max(0, prev - 1));
                                        }
                                    }}
                                    className={`flex-1 py-3 rounded-xl font-bold border-2 transition-colors ${currentStep === 0 && !onBack ? 'border-gray-100 text-gray-300 cursor-not-allowed' : 'border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700'}`}
                                >
                                    {currentStep === 0 && onBack ? 'Volver al Menú' : 'Atrás'}
                                </button>

                                {currentStep === STEPS.length - 1 ? (
                                    <button
                                        onClick={handleAddToCart}
                                        disabled={order.productType === 'burger' && order.proteins.length === 0}
                                        className="flex-[2] bg-yoko-primary text-white py-3 rounded-xl font-bold hover:bg-opacity-90 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                    >
                                        <ShoppingBag size={18} /> Agregar
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => {
                                            setCurrentStep(prev => Math.min(STEPS.length - 1, prev + 1));
                                        }}
                                        disabled={order.productType === 'burger' && currentStep === 0 && order.proteins.length === 0}
                                        className="flex-[2] bg-yoko-dark text-white py-3 rounded-xl font-bold hover:bg-opacity-90 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Siguiente
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col relative bg-gray-50/30">
                    {/* Step Header */}
                    <div className="p-4 md:p-8 border-b border-gray-100 bg-white sticky top-0 z-20 shadow-sm">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 mb-3 md:mb-4">
                            <div>
                                <h2 className="text-xl md:text-3xl font-serif font-bold text-yoko-dark flex items-center gap-3">
                                    {currentScreen.title}
                                </h2>
                                <p className="text-gray-400 mt-1 font-medium">{currentScreen.subtitle}</p>
                            </div>

                            {/* Selection Limit Indicator */}
                            {(currentScreen as any).limit && (currentScreen as any).type === 'multi' && (
                                <div className={`px-4 py-2 rounded-xl flex flex-col items-center border-2 ${((order[currentScreen.key as keyof OrderState] as Ingredient[]) || []).length >= ((currentScreen as any).limit || 0)
                                    ? 'bg-green-50 border-green-200 text-yoko-primary'
                                    : 'bg-gray-50 border-gray-100 text-gray-400'
                                    }`}>
                                    <span className="text-xs font-bold uppercase tracking-wider">Seleccionado</span>
                                    <span className="text-lg font-black leading-none">
                                        {((order[currentScreen.key as keyof OrderState] as Ingredient[]) || []).length}
                                        <span className="text-sm font-medium text-gray-300">/{(currentScreen as any).limit}</span>
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Progress Bar */}
                        <div className="flex items-center gap-3 mt-4">
                            <span className="text-xs font-bold text-gray-300 font-mono">{(currentStep + 1).toString().padStart(2, '0')}</span>
                            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                <motion.div
                                    className="h-full bg-gradient-to-r from-yoko-primary to-yoko-accent"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                                    transition={{ duration: 0.5, ease: "circOut" }}
                                />
                            </div>
                            <span className="text-xs font-bold text-gray-300 font-mono">{STEPS.length.toString().padStart(2, '0')}</span>
                        </div>
                    </div>

                    {/* Scrollable Content */}
                    <div className="flex-1 p-4 md:p-8 overflow-y-auto custom-scrollbar relative">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={`${order.productType}-${currentStep}`}
                                variants={containerVariants}
                                initial="hidden"
                                animate="show"
                                exit="exit"
                                className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-24 lg:pb-0"
                            >
                                {currentScreen.key === 'size' && order.productType === 'bowl' ? (
                                    currentScreen.data && currentScreen.data.map((sizeOption: any) => (
                                        <motion.div
                                            variants={itemVariants}
                                            key={sizeOption.id}
                                            whileHover={{ y: -5, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
                                            whileTap={{ scale: 0.98 }}
                                            onClick={() => setOrder(prev => ({ ...prev, size: sizeOption.name === 'Chico' ? 'small' : sizeOption.name === 'Grande' ? 'large' : 'medium', sizeName: sizeOption.name, price: sizeOption.price }))}
                                            className={`group p-6 rounded-3xl border-2 cursor-pointer transition-all duration-300 flex flex-col items-center justify-center gap-4 relative overflow-hidden bg-white
                                            ${order.sizeName === sizeOption.name
                                                    ? 'border-yoko-primary shadow-xl ring-4 ring-green-50'
                                                    : 'border-transparent shadow-md hover:border-gray-200'}`}
                                        >
                                            {order.sizeName === sizeOption.name && (
                                                <div className="absolute top-4 right-4 text-yoko-primary bg-green-100 p-1 rounded-full">
                                                    <Check size={16} strokeWidth={4} />
                                                </div>
                                            )}

                                            {sizeOption.image_url ? (
                                                <div className="w-32 h-32 relative transform group-hover:scale-110 transition-transform duration-500">
                                                    <img
                                                        src={sizeOption.image_url}
                                                        alt={sizeOption.name}
                                                        className="w-full h-full object-contain"
                                                        onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement?.classList.add('fallback-icon'); }}
                                                    />
                                                    <div className="hidden fallback-icon:block text-6xl absolute inset-0 flex items-center justify-center">🥣</div>
                                                </div>
                                            ) : (
                                                <span className="text-6xl mb-2 transform group-hover:rotate-12 transition-transform">🥣</span>
                                            )}

                                            <div className="text-center">
                                                <h4 className="font-serif font-bold text-xl text-yoko-dark mb-1">{sizeOption.name}</h4>
                                                <span className="inline-block bg-yoko-dark/5 text-yoko-dark font-bold px-3 py-1 rounded-full text-sm">
                                                    ${sizeOption.price}
                                                </span>
                                            </div>
                                        </motion.div>
                                    ))
                                ) : (
                                    (currentScreen.data || menu[currentScreen.cat!] || []).map((item: any) => {
                                        const currentList = order[currentScreen.key as keyof OrderState];
                                        const isSelected = Array.isArray(currentList) ? currentList.some(i => i.id === item.id) : (currentList as Ingredient)?.id === item.id;
                                        // Specific check for max limit reached to disable unselected items if needed? Not strictly enforcing disabled state, just visual.

                                        return (
                                            <motion.div
                                                variants={itemVariants}
                                                key={item.id}
                                                onClick={() => handleToggle(currentScreen.key as keyof OrderState, item)}
                                                className={`relative p-3 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between h-32 group
                                                ${isSelected
                                                        ? 'bg-yoko-primary text-white border-yoko-primary shadow-lg ring-2 ring-offset-2 ring-yoko-primary/50'
                                                        : 'bg-white border-gray-100 text-gray-500 hover:border-gray-300 hover:shadow-md'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <span className={`text-3xl transform transition-transform duration-300 ${isSelected ? 'scale-110 rotate-3' : 'group-hover:scale-110'}`}>
                                                        {item.icon || '🥬'}
                                                    </span>
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition-colors ${isSelected ? 'bg-white border-white text-yoko-primary' : 'border-gray-200 bg-transparent'}`}>
                                                        {isSelected && <Check size={14} strokeWidth={4} />}
                                                    </div>
                                                </div>

                                                <div>
                                                    <h4 className={`font-bold leading-tight mb-1 line-clamp-2 ${isSelected ? 'text-white' : 'text-yoko-dark'}`}>
                                                        {item.name}
                                                    </h4>
                                                    {item.price ? (
                                                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md inline-block ${isSelected ? 'bg-white/20 text-white' : 'bg-green-50 text-yoko-accent'}`}>
                                                            +${item.price}
                                                        </span>
                                                    ) : (
                                                        <span className={`text-[10px] uppercase tracking-wider font-bold opacity-60 ${isSelected ? 'text-white' : 'text-gray-300'}`}>
                                                            Incluido
                                                        </span>
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    })
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Mobile Footer Controls (Hidden on XL) */}
                    <div className="xl:hidden p-4 border-t border-gray-100 bg-white/95 backdrop-blur-md sticky bottom-0 z-30 flex justify-between items-center shadow-[0_-5px_20px_rgba(0,0,0,0.1)]">
                        <button
                            disabled={currentStep === 0}
                            onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
                            className={`p-3 rounded-full border transition-colors ${currentStep === 0 ? 'border-gray-100 text-gray-300' : 'border-gray-200 text-gray-500'}`}
                        >
                            <ChevronLeft size={24} />
                        </button>

                        <div className="flex flex-col items-center">
                            <span className="text-[10px] uppercase text-gray-400 font-bold tracking-wider">Total</span>
                            <span className="font-serif font-bold text-xl text-yoko-primary">${order.price}</span>
                        </div>

                        {currentStep === STEPS.length - 1 ? (
                            <button
                                onClick={handleAddToCart}
                                disabled={order.productType === 'burger' && order.proteins.length === 0}
                                className="px-6 py-3 bg-yoko-primary text-white rounded-full font-bold shadow-lg flex items-center gap-2 animate-bounce-subtle"
                            >
                                <ShoppingBag size={20} /> Agregar
                            </button>
                        ) : (
                            <button
                                onClick={() => setCurrentStep(prev => Math.min(STEPS.length - 1, prev + 1))}
                                disabled={order.productType === 'burger' && currentStep === 0 && order.proteins.length === 0}
                                className="px-6 py-3 bg-yoko-dark text-white rounded-full font-bold shadow-lg flex items-center gap-2"
                            >
                                Siguiente <ChevronRight size={20} />
                            </button>
                        )}
                    </div>

                </div>
            </div>
        </div>
    );

}
