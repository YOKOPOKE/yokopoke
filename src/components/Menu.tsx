"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Plus, Check, ChevronLeft, ChevronRight } from "lucide-react";
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

    // UI State for "Added" feedback per item
    const [justAdded, setJustAdded] = useState<Record<number, boolean>>({});

    const supabase = createClient();
    const { addToCart } = useCart();
    const { showToast } = useToast();


    useEffect(() => {
        const fetchMenu = async () => {
            setLoading(true);

            // 1. Fetch Categories
            // We verify specific categories order or just alpha
            // Ideally we could have an 'order' column, but alpha or ID is fine for now
            // 1. Fetch Categories
            // Show only active categories
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
                // .eq('is_active', true) // Fetch ALL to show disabled
                ;

            if (prods) setProducts(prods as any);

            setLoading(false);
        };

        fetchMenu();

        // Realtime Subscription for Products and Categories
        const channel = supabase.channel('menu-updates')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'products' },
                () => {
                    console.log('🔄 Product update detected. Refreshing menu...');
                    fetchMenu();
                }
            )
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'categories' },
                () => {
                    console.log('🔄 Category update detected. Refreshing menu...');
                    fetchMenu();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    // 1. Filter & Group
    const { categoryNames, groupedProducts } = useMemo(() => {
        // Exclude Custom Builders (Bowls/Burgers) referenced by SLUG or Special Category
        // We assume 'pokes' and 'burgers' slugs in categories table are the builders
        const relevant = products.filter(p =>
            p.type === 'other' || p.type === 'burger' // Show standard items and burgers in Menu
        );

        const grouped: Record<string, Product[]> = {};
        const activeCatNames: Set<string> = new Set();

        relevant.forEach(p => {
            const catName = p.categories?.name || 'Varios';
            if (!grouped[catName]) grouped[catName] = [];
            grouped[catName].push(p);
            activeCatNames.add(catName);
        });

        // Sort categories based on DB order (filtered by what actually has products)
        // We iterate over dbCategories to preserve their order (e.g. ID or Name)
        const sortedCats: string[] = [];
        dbCategories.forEach(c => {
            if (activeCatNames.has(c.name)) {
                // Prevent duplicates if multiple categories have same name
                if (!sortedCats.includes(c.name)) {
                    sortedCats.push(c.name);
                }
            }
        });

        // Add any found names that weren't in dbCategories (fallback)
        activeCatNames.forEach(name => {
            if (!sortedCats.includes(name)) sortedCats.push(name);
        });

        // Put 'Varios' or fallback at end if needed
        const variesIdx = sortedCats.indexOf('Varios');
        if (variesIdx !== -1) {
            sortedCats.splice(variesIdx, 1);
            sortedCats.push('Varios');
        }

        return { categoryNames: sortedCats, groupedProducts: grouped };
    }, [products, dbCategories]);

    // Set initial active category
    useEffect(() => {
        if ((!activeCategory || !categoryNames.includes(activeCategory)) && categoryNames.length > 0) {
            setActiveCategory(categoryNames[0]);
        }
    }, [categoryNames, activeCategory]);


    const handleAdd = (product: Product) => {
        if (!product.is_active) {
            showToast('🚫 Producto no disponible por el momento.', 'error');
            return;
        }
        const price = Number(product.base_price || 0);

        addToCart({
            name: product.name,
            productType: 'menu',
            price: price, // Use 'price' matching OrderItem type
            quantity: 1,
            details: [], // Explicitly empty for menu items
            image: product.image_url,
            // Add breakdown even for simple items for consistency
            priceBreakdown: {
                base: price,
                extras: 0
            }
        }, true); // Open drawer

        // Visual Feedback
        setJustAdded(prev => ({ ...prev, [product.id]: true }));
        setTimeout(() => setJustAdded(prev => ({ ...prev, [product.id]: false })), 1500);

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

    // If no Menu Items exist
    if (categoryNames.length === 0) return null;

    return (
        <section id="menu" className="py-24 bg-slate-50/30 relative z-10 overflow-hidden">
            {/* Decorative Background */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-100/40 via-transparent to-transparent pointer-events-none" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">

                {/* Header */}
                <div className="flex flex-col items-center text-center mb-12">
                    <span className="text-xs font-bold tracking-[0.2em] text-violet-500 uppercase mb-3 bg-violet-50 px-4 py-1.5 rounded-full border border-violet-100">
                        Nuestra Carta
                    </span>
                    <h2 className="text-4xl md:text-5xl font-serif font-black text-slate-900 mb-4">
                        Explora el Sabor
                    </h2>
                </div>

                {/* Categories Nav (Desktop) */}
                <div className="hidden md:flex justify-center mb-12 overflow-x-auto pb-4 scrollbar-hide">
                    <div className="bg-white/70 backdrop-blur-md p-1.5 rounded-full border border-slate-200/60 shadow-lg shadow-slate-200/50 flex gap-2">
                        {categoryNames.map((cat) => (
                            <button
                                key={cat}
                                onClick={() => setActiveCategory(cat)}
                                className={`
                                    px-6 py-2.5 rounded-full text-sm font-bold transition-all relative whitespace-nowrap
                                    ${activeCategory === cat ? 'text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'}
                                `}
                            >
                                {activeCategory === cat && (
                                    <motion.div
                                        layoutId="activeCategory"
                                        className="absolute inset-0 bg-slate-900 rounded-full shadow-lg"
                                        initial={false}
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}
                                <span className="relative z-10">{cat}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Categories Nav (Mobile Carousel) */}
                <div className="md:hidden w-full px-4 mb-8">
                    <div className="flex items-center justify-between gap-4 bg-white/80 backdrop-blur-xl p-2 rounded-2xl shadow-lg shadow-violet-100/50 border border-white">
                        <button
                            onClick={() => {
                                const idx = categoryNames.indexOf(activeCategory);
                                const prev = idx === 0 ? categoryNames.length - 1 : idx - 1;
                                setActiveCategory(categoryNames[prev]);
                            }}
                            className="p-3 bg-white rounded-xl shadow-sm hover:translate-x-[-2px] active:scale-95 transition-all text-violet-600"
                        >
                            <ChevronLeft size={24} />
                        </button>

                        <div className="flex-1 flex flex-col items-center justify-center overflow-hidden">
                            <span className="text-[10px] font-bold text-violet-400 tracking-[0.2em] uppercase mb-1">
                                Categoría {categoryNames.indexOf(activeCategory) + 1}/{categoryNames.length}
                            </span>
                            <AnimatePresence mode="wait">
                                <motion.span
                                    key={activeCategory}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="font-serif font-bold text-lg text-slate-800 text-center leading-none"
                                >
                                    {activeCategory}
                                </motion.span>
                            </AnimatePresence>
                        </div>

                        <button
                            onClick={() => {
                                const idx = categoryNames.indexOf(activeCategory);
                                const next = idx === categoryNames.length - 1 ? 0 : idx + 1;
                                setActiveCategory(categoryNames[next]);
                            }}
                            className="p-3 bg-white rounded-xl shadow-sm hover:translate-x-[2px] active:scale-95 transition-all text-violet-600"
                        >
                            <ChevronRight size={24} />
                        </button>
                    </div>
                </div>

                {/* Grid */}
                <motion.div
                    key="products-grid"
                    variants={containerVariants}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: "-100px" }}
                    className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-8"
                >
                    <AnimatePresence mode="popLayout">
                        {(groupedProducts[activeCategory] || []).map((product) => (
                            <motion.div
                                layout
                                key={product.id}
                                variants={itemVariants}
                                initial="hidden"
                                animate="show"
                                exit="hidden"
                                className={`
                                    rounded-xl p-2 shadow-sm transition-all duration-300 border border-slate-100 group flex flex-col will-change-transform transform-gpu
                                    ${!product.is_active ? 'opacity-60 grayscale bg-slate-50 cursor-pointer' : 'bg-white hover:shadow-xl'}
                                `}
                            >
                                {/* Card Content */}
                                <div className="relative aspect-square mb-2 overflow-hidden rounded-lg bg-slate-100">
                                    {product.image_url ? (
                                        <div className="relative w-full h-full">
                                            <img
                                                src={product.image_url}
                                                alt={product.name}
                                                loading="lazy"
                                                className="object-cover w-full h-full group-hover:scale-110 transition-transform duration-500 transform-gpu"
                                            />
                                            {/* Gradient overlay */}
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                        </div>
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                                            <img src="/placeholder.png" className="opacity-50" />
                                        </div>
                                    )}
                                    <div className="absolute top-1.5 right-1.5 bg-white/90 backdrop-blur px-1.5 py-0.5 rounded-full text-[10px] font-bold text-slate-900 shadow-sm">
                                        ${product.base_price}
                                    </div>
                                </div>

                                <div className="flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className="font-serif font-bold text-sm text-slate-900 leading-tight group-hover:text-violet-600 transition-colors line-clamp-2 min-h-[2.5em]">
                                            {product.name}
                                        </h3>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mb-2 line-clamp-2 leading-relaxed hidden sm:block">
                                        {product.description}
                                    </p>

                                    <div className="mt-auto">
                                        <button
                                            onClick={() => handleAdd(product)}
                                            disabled={justAdded[product.id]}
                                            className={`
                                                w-full py-1.5 rounded-lg font-bold text-[10px] transition-all flex items-center justify-center gap-1 relative overflow-hidden transform-gpu
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
