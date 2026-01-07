"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Plus } from "lucide-react";
import Image from "next/image";
import { createClient } from "@/lib/supabase";
import { useCart } from "@/context/CartContext";

// Types
type MenuItem = {
    id: number;
    name: string;
    description: string;
    price: number;
    image_url: string;
    category: string;
    type?: string;
    is_available: boolean;
    stock?: number;
};

const CATEGORIES = [
    { id: 'Signature Bowls', label: 'Pokes de la Casa' },
    { id: 'Burgers', label: 'Sushi Burgers' },
    { id: 'Sides', label: 'Share & Smile' },
    { id: 'Drinks', label: 'Drinks' },
    { id: 'Desserts', label: 'Postres' }
];

export default function Menu() {
    const [items, setItems] = useState<MenuItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('Signature Bowls');
    const supabase = createClient();
    const { addToCart, toggleCart } = useCart();

    useEffect(() => {
        // Initial Fetch
        const fetchMenu = async () => {
            const { data } = await supabase
                .from('menu_items')
                .select('*')
                .eq('is_available', true)
                .order('id');
            if (data) {
                console.log('Menu Data Fetched:', data);
                setItems(data as MenuItem[]);
            }
            setLoading(false);
        };

        fetchMenu();

        // Real-time Subscription
        const channel = supabase
            .channel('menu_updates')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'menu_items'
                },
                (payload) => {
                    console.log('Realtime Menu Update:', payload);
                    fetchMenu();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const cat = (item.category || item.type || '').toLowerCase();

            if (activeCategory === 'Signature Bowls' && cat.includes('bowl')) return true;
            if (activeCategory === 'Burgers' && cat.includes('burger')) return true;
            if (activeCategory === 'Sides' && (cat.includes('side') || cat.includes('entrada') || cat.includes('share'))) return true;
            if (activeCategory === 'Drinks' && (cat.includes('drink') || cat.includes('bebida'))) return true;
            if (activeCategory === 'Desserts' && (cat.includes('dessert') || cat.includes('postre'))) return true;

            return false;
        });
    }, [items, activeCategory]);

    const handleQuickAdd = (item: MenuItem) => {
        // Sushi Burger Integration: Redirect to Builder
        if (activeCategory === 'Burgers' || (item.category && item.category.toLowerCase().includes('burger')) || item.name.toLowerCase().includes('burger')) {
            window.dispatchEvent(new CustomEvent('open-builder', { detail: { mode: 'burger' } }));
            return;
        }

        addToCart({
            productType: item.category && item.category.toLowerCase().includes('burger') ? 'burger' : 'bowl',
            size: 'regular',
            price: item.price,
            quantity: 1,
            base: null,
            proteins: [],
            mixins: [],
            sauces: [],
            toppings: [],
            extras: []
        });
        toggleCart();
    };

    if (loading) return (
        <section id="menu" className="py-24 bg-white relative z-10 min-h-[50vh] flex items-center justify-center">
            <div className="text-yoko-primary animate-pulse font-bold text-xl">Cargando Menú...</div>
        </section>
    );

    return (
        <section id="menu" className="py-24 bg-white relative z-10">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
                    <div>
                        <h2 className="text-4xl md:text-5xl font-serif font-bold text-yoko-dark mb-2">
                            Nuestro Menú
                        </h2>
                        <p className="text-gray-500 text-lg">Explora nuestros platillos más frescos.</p>
                    </div>

                    {/* Category Filter Pills - Mobile Optimized with Snap */}
                    <div className="w-full md:w-auto overflow-hidden">
                        <div className="flex overflow-x-auto pb-6 md:pb-0 gap-3 no-scrollbar items-center snap-x snap-mandatory px-1 md:px-0 -mx-4 md:mx-0 px-4 md:px-0">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={`snap-center shrink-0 px-6 py-2.5 rounded-full font-bold whitespace-nowrap transition-all duration-300 text-sm md:text-base border ${activeCategory === cat.id
                                        ? 'bg-yoko-accent text-white border-yoko-accent shadow-lg shadow-red-200/50 scale-105'
                                        : 'bg-white text-gray-400 border-gray-100 hover:border-red-200 hover:text-yoko-accent hover:bg-red-50 hover:scale-105 active:scale-95'
                                        }`}
                                >
                                    {cat.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Grid */}
                <motion.div
                    className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
                >
                    <AnimatePresence mode='wait'>
                        {filteredItems.map((item) => (
                            <motion.div
                                layout
                                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                                whileHover={{
                                    y: -8,
                                    transition: { type: "spring", stiffness: 400, damping: 25 }
                                }}
                                transition={{ duration: 0.3 }}
                                key={item.id}
                                className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm hover:shadow-2xl hover:shadow-yoko-primary/10 transition-shadow duration-300 group flex flex-col h-full relative"
                            >
                                {/* Image Area */}
                                <div className="relative h-56 w-full mb-4 bg-gray-50 rounded-2xl overflow-hidden shadow-inner">
                                    {/* Popular Badge */}
                                    {item.id < 3 && (
                                        <span className="absolute top-3 left-3 bg-white/95 backdrop-blur-md text-yoko-primary text-[10px] font-bold px-3 py-1 rounded-full shadow-lg z-10 border border-gray-100 flex items-center gap-1">
                                            <Star size={10} className="fill-current" /> POPULAR
                                        </span>
                                    )}

                                    <Image
                                        key={item.image_url} // Force re-mount on URL change
                                        src={item.image_url || "/images/bowl-placeholder.png"}
                                        alt={item.name}
                                        fill
                                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                                        className="object-cover group-hover:scale-105 transition-transform duration-500 will-change-transform"
                                    />

                                    {/* Quick Add Overlay (Desktop Only) */}
                                    <div className="hidden md:flex absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 items-center justify-center backdrop-blur-[2px]">
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation(); // Prevent card click
                                                handleQuickAdd(item);
                                            }}
                                            className="bg-white text-yoko-accent font-bold px-6 py-3 rounded-full transform translate-y-4 group-hover:translate-y-0 transition-all duration-300 shadow-xl hover:bg-yoko-accent hover:text-white hover:scale-105 hover:shadow-2xl hover:shadow-red-200/50 active:scale-95 flex items-center gap-2"
                                        >
                                            <Plus size={18} />
                                            {item.category && item.category.toLowerCase().includes('burger') ? 'Diseñar' : 'Agregar'}
                                        </button>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="flex-1 flex flex-col">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-bold text-yoko-dark text-lg leading-tight group-hover:text-yoko-primary transition-colors">
                                            {item.name}
                                        </h3>
                                        <span className="text-xl font-black text-yoko-accent bg-red-50 px-3 py-1 rounded-full group-hover:bg-yoko-accent group-hover:text-white transition-colors shadow-sm">
                                            ${item.price}
                                        </span>
                                    </div>

                                    <p className="text-gray-400 text-xs mb-4 line-clamp-2 flex-1 leading-relaxed font-medium">
                                        {item.description}
                                    </p>

                                    {/* Footer Actions */}
                                    <div className="flex items-center justify-between pt-4 border-t border-gray-50 mt-auto">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
                                            <span className={`w-2 h-2 rounded-full ${item.stock && item.stock > 0 ? 'bg-green-400' : 'bg-green-400'}`}></span>
                                            Disponible
                                        </span>

                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleQuickAdd(item);
                                            }}
                                            className="bg-red-50 text-yoko-accent rounded-full p-2.5 hover:bg-yoko-accent hover:text-white transition-all shadow-sm hover:shadow-lg hover:scale-110 active:scale-90 duration-300"
                                        >
                                            <Plus size={18} />
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>

                {filteredItems.length === 0 && (
                    <div className="text-center py-20 text-gray-400 flex flex-col items-center">
                        <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-2xl">🥣</div>
                        <p>No hay productos en esta categoría por el momento.</p>
                    </div>
                )}

            </div>
        </section>
    );
}
