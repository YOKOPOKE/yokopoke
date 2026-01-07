"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Ingredient = {
    id: number;
    name: string;
    price?: number;
    icon?: string;
    type: string;
};

export type OrderItem = {
    id: string; // Unique ID for cart item
    productType: 'bowl' | 'burger';
    size?: string;
    base?: Ingredient | null;
    proteins: Ingredient[];
    mixins: Ingredient[];
    sauces: Ingredient[];
    toppings: Ingredient[];
    extras: Ingredient[];
    price: number;
    quantity: number;
};

type CartContextType = {
    items: OrderItem[];
    addToCart: (item: Omit<OrderItem, 'id'>) => void;
    removeFromCart: (id: string) => void;
    clearCart: () => void;
    isCartOpen: boolean;
    toggleCart: () => void;
    cartTotal: number;
    cartCount: number;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [items, setItems] = useState<OrderItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        const saved = localStorage.getItem('yoko-cart');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setItems(parsed);
                } else if (parsed && parsed.cart && Array.isArray(parsed.cart)) {
                    setItems(parsed.cart);
                }
            } catch (e) {
                console.error("Failed to load cart", e);
            }
        }
    }, []);

    useEffect(() => {
        if (isClient) {
            localStorage.setItem('yoko-cart', JSON.stringify(items));
        }
    }, [items, isClient]);

    const addToCart = (newItem: Omit<OrderItem, 'id'>) => {
        const item: OrderItem = {
            ...newItem,
            id: Math.random().toString(36).substr(2, 9),
        };
        setItems(prev => [...prev, item]);
        setIsCartOpen(true);
    };

    const removeFromCart = (id: string) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const clearCart = () => {
        setItems([]);
    };

    const toggleCart = () => {
        setIsCartOpen(prev => !prev);
    };

    const cartTotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);

    return (
        <CartContext.Provider value={{
            items,
            addToCart,
            removeFromCart,
            clearCart,
            isCartOpen,
            toggleCart,
            cartTotal,
            cartCount
        }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (context === undefined) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
}
