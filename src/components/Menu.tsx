"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Plus, Check, ChevronLeft, ChevronRight, AlertCircle, Clock } from "lucide-react";
import { createClient } from "@/lib/supabase";
import { useCart } from "@/context/CartContext";
import { useToast } from "@/context/ToastContext";
import confetti from "canvas-confetti";


// --- Types ---
type Category = {
    id: number;
    name: string;
    slug: string;
    is_active?: boolean;
};

type Product = {
    id: number;
    name: string;
    description: string;
    base_price: number;
    type: string;
    category_id: number | null;
    slug: string;
    image_url: string;
    is_active: boolean;
    // Relation
    categories?: Category;
};

// Animation Variants
const containerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            type: "spring",
            stiffness: 400, // Apple-style snap
            damping: 30,    // No bounce, just smooth stop
            mass: 1
        }
    }
} as any;

export default function Menu() {
    const [products, setProducts] = useState<Product[]>([]);
    const [dbCategories, setDbCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState<string>("");
    const [webDisabled, setWebDisabled] = useState(false);

    // UI State for "Added" feedback per item
    const [justAdded, setJustAdded] = useState<Record<number, boolean>>({});

    const supabase = createClient();
    const { addToCart } = useCart();
    const { showToast } = useToast();

    useEffect(() => {
        const fetchMenu = async () => {
            setLoading(true);

            // Check global config first
            try {
                const { data: config } = await supabase
                    .from('app_config')
                    .select('value')
                    .eq('key', 'web_products_enabled')
                    .single();

                if (config && (config.value === false || config.value === 'false')) {
                    setWebDisabled(true);
                    setLoading(false);
                    return;
                } else {
                    setWebDisabled(false);
                }
            } catch (e) {
                console.error("Config check fail:", e);
                setWebDisabled(false);
            }

            // 1. Fetch Categories
            const { data: cats } = await supabase
                .from('categories')
                .select('*')
                .eq('is_active', true)
                .order('id');
            if (cats) setDbCategories(cats);

            // 2. Fetch Products with Category relation
            const { data: prods } = await supabase
                .from('products')
                .select('*, categories(*)')
                ;

            if (prods) setProducts(prods as any);

            setLoading(false);
        };

        fetchMenu();

        // Realtime Subscription
        const channel = supabase.channel('menu-updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'products' },
                () => fetchMenu()
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'categories' },
                () => fetchMenu()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // 1. Filter & Group
    const { categoryNames, groupedProducts } = useMemo(() => {
        const relevant = products.filter(p =>
            p.type === 'other' || p.type === 'burger'
        );

        const grouped: Record<string, Product[]> = {};
        const activeCatNames: Set<string> = new Set();

        relevant.forEach(p => {
            const catName = p.categories?.name || 'Varios';
            if (!grouped[catName]) grouped[catName] = [];
            grouped[catName].push(p);
            activeCatNames.add(catName);
        });

        const sortedNames = dbCategories
            .filter(c => activeCatNames.has(c.name))
            .map(c => c.name);

        if (activeCatNames.has('Varios') && !sortedNames.includes('Varios')) {
            sortedNames.push('Varios');
        }

        if (sortedNames.length > 0 && !activeCategory) {
            setActiveCategory(sortedNames[0]);
        }

        return { categoryNames: sortedNames, groupedProducts: grouped };
    }, [products, dbCategories, activeCategory]);

    const handleAdd = (product: Product) => {
        if (!product.is_active) {
            showToast("Platillo agotado temporalmente.");
            return;
        }

        addToCart({
            productType: 'menu',
            name: product.name,
            price: product.base_price,
            quantity: 1,
            image: product.image_url,
            priceBreakdown: {
                base: product.base_price,
                extras: 0
            }
        });

        setJustAdded(prev => ({ ...prev, [product.id]: true }));
        setTimeout(() => {
            setJustAdded(prev => {
                const newState = { ...prev };
                delete newState[product.id];
                return newState;
            });
        }, 2000);

        confetti({
            particleCount: 30,
            spread: 50,
            origin: { y: 0.7 },
            colors: ['#a78bfa', '#34d399'],
            disableForReducedMotion: true
        });
    };

    if (loading) {
        return (
            <section id="menu" className="py-24 bg-gray-50/50 relative z-10 min-h-[50vh] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 rounded-full border-4 border-violet-200 border-t-violet-600 animate-spin"></div>
                    <div className="text-violet-600 font-bold text-lg animate-pulse">Cargando Menú...</div>
                </div>
            </section>
        );
    }

    if (webDisabled) {
        return (
            <section id="menu" className="py-24 bg-slate-50/30 relative z-10 overflow-hidden flex items-center justify-center min-h-[60vh]">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-100/40 via-transparent to-transparent pointer-events-none" />
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-2xl mx-auto px-6 text-center relative z-10"
                >
                    <div className="w-20 h-20 bg-violet-100 rounded-3xl flex items-center justify-center mx-auto mb-8 text-violet-600 shadow-xl shadow-violet-500/10">
                        <Clock size={40} className="animate-pulse" />
                    </div>
                    <h2 className="text-4xl font-serif font-black text-slate-900 mb-6">Estamos Actualizando el Menú</h2>
                    <p className="text-slate-600 text-lg leading-relaxed mb-8">
                        Nuestro catálogo digital se encuentra en mantenimiento temporal para ofrecerte una mejor experiencia.
                        ¡No te preocupes! El resto de la web sigue activa.
                    </p>
                    <div className="inline-flex items-center gap-2 px-6 py-3 bg-violet-50 border border-violet-100 text-violet-700 font-bold rounded-2xl">
                        <AlertCircle size={18} />
                        Vuelve a visitarnos en unos momentos
                    </div>
                </motion.div>
            </section>
        );
    }

    if (categoryNames.length === 0) return null;

    return (
        <section id="menu" className="py-24 bg-slate-50/30 relative z-10 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-100/40 via-transparent to-transparent pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

                <div className="flex flex-col items-center text-center mb-12">
                    <span className="text-xs font-bold tracking-[0.2em] text-violet-500 uppercase mb-3 bg-violet-50 px-4 py-1.5 rounded-full border border-violet-100">
                        Nuestra Carta
                    </span>
                    <h2 className="text-4xl md:text-5xl font-serif font-black text-slate-900 mb-4">
                        Explora el Sabor
                    </h2>
                </div>

                <div className="hidden md:flex justify-center mb-12 overflow-x-auto pb-4 scrollbar-hide">
                    <div className="flex gap-2 p-1.5 bg-white shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-100">
                        {categoryNames.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`
                                    px-6 py-2.5 rounded-xl font-bold text-sm transition-all relative
                                    ${activeCategory === cat
                                        ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/20'
                                        : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'}
                                `}
                            >
                                {cat}
                                {activeCategory === cat && (
                                    <motion.div layoutId="active-cat-bg" className="absolute inset-0 bg-slate-900 rounded-xl -z-10" />
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="md:hidden flex overflow-x-auto gap-3 py-4 mb-8 scrollbar-hide -mx-4 px-4">
                    {categoryNames.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`
                                whitespace-nowrap px-6 py-2.5 rounded-xl font-bold text-xs transition-all border
                                ${activeCategory === cat
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-lg shadow-slate-900/20'
                                    : 'bg-white text-slate-600 border-slate-100'}
                            `}
                        >
                            {cat}
                        </button>
                    ))}
                </div>

                <motion.div
                    key={activeCategory}
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6"
                >
                    <AnimatePresence mode="popLayout">
                        {groupedProducts[activeCategory]?.map((product) => (
                            <motion.div
                                key={product.id}
                                layout
                                variants={itemVariants}
                                exit={{ opacity: 0, scale: 0.9 }}
                                className="group bg-white rounded-3xl p-3 border border-slate-100 hover:border-violet-200 hover:shadow-2xl hover:shadow-violet-500/10 transition-all duration-300 flex flex-col h-full"
                            >
                                <div className="relative aspect-square rounded-2xl overflow-hidden mb-3 bg-slate-50">
                                    {product.image_url ? (
                                        <div className="relative w-full h-full">
                                            <Image
                                                src={product.image_url}
                                                alt={product.name}
                                                fill
                                                sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                                                className="object-cover group-hover:scale-110 transition-transform duration-500 transform-gpu"
                                                priority={false}
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                            <img src="/placeholder.png" alt="No image" className="opacity-50 w-12 h-12" />
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-1 gap-2">
                                        <h3 className="font-serif font-bold text-sm text-slate-900 leading-tight group-hover:text-violet-600 transition-colors line-clamp-2 min-h-[2.5em]">
                                            {product.name}
                                        </h3>
                                        <span className="font-bold text-violet-600 text-sm whitespace-nowrap bg-violet-50 px-2 py-0.5 rounded-full border border-violet-100">
                                            ${product.base_price}
                                        </span>
                                    </div>

                                    <p className="text-[10px] text-slate-500 mb-3 line-clamp-2 leading-relaxed hidden sm:block">
                                        {product.description}
                                    </p>

                                    <div className="mt-auto">
                                        <button
                                            onClick={() => handleAdd(product)}
                                            disabled={justAdded[product.id]}
                                            className={`
                                                w-full py-2 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1 relative overflow-hidden transform-gpu
                                                ${justAdded[product.id]
                                                    ? 'bg-green-100 text-green-700'
                                                    : !product.is_active
                                                        ? 'bg-slate-200 text-slate-400 cursor-pointer'
                                                        : 'bg-slate-50 text-slate-600 hover:bg-slate-900 hover:text-white hover:shadow-lg hover:shadow-slate-900/20 hover:-translate-y-0.5 active:translate-y-0'}
                                            `}
                                        >
                                            {justAdded[product.id] ? (
                                                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex items-center gap-1">
                                                    <Check size={12} /> Agregado
                                                </motion.div>
                                            ) : (
                                                <>
                                                    <Plus size={12} /> Agregar
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>

            </div>
        </section>
    );
}
