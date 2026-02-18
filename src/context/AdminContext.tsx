"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useToast } from "@/context/ToastContext";

type Order = {
    id: number;
    created_at: string;
    customer_name: string;
    total: number;
    status: 'pending' | 'preparing' | 'completed' | 'cancelled' | 'awaiting_payment';
    payment_status?: string;
    payment_method?: string;
    delivery_method: 'delivery' | 'pickup';
    items: any[];
    address?: string;
    phone?: string;
    pickup_time?: string;
    full_address?: string;
    address_references?: string;
    location?: {
        latitude?: number;
        longitude?: number;
        address?: string;
        name?: string;
        lat?: number;
        lng?: number;
    };
};

interface AdminContextType {
    incomingOrder: Order | null;
    setIncomingOrder: (order: Order | null) => void;
    stopAudio: () => void;
    testAudio: () => void;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: React.ReactNode }) {
    const [incomingOrder, setIncomingOrder] = useState<Order | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const supabase = createClient();
    const { showToast } = useToast();

    // 1. Initialize Audio & Permissions
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.loop = true;
                audio.preload = 'auto';
                audioRef.current = audio;

                // Request Notification Permission
                if ("Notification" in window && Notification.permission !== "granted") {
                    Notification.requestPermission().catch(err => console.log('Notification permission error:', err));
                }
            } catch (err) {
                console.error('Audio initialization failed:', err);
            }
        }

        // Cleanup on unmount
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current = null;
            }
        };
    }, []);

    // 2. Handle Incoming Order Effects (Audio + System Notification)
    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (incomingOrder) {
            // Play Sound with error handling
            try {
                audio.play().catch((err) => {
                    console.log('Audio autoplay blocked:', err);
                    // Attempt to reload audio if it was garbage collected
                    if (err.name === 'NotSupportedError' || err.name === 'AbortError') {
                        const newAudio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                        newAudio.loop = true;
                        audioRef.current = newAudio;
                        newAudio.play().catch(e => console.log('Retry failed:', e));
                    }
                });
            } catch (err) {
                console.error('Audio play error:', err);
            }

            // System Notification with error handling
            try {
                if ("Notification" in window && Notification.permission === "granted") {
                    new Notification("🌮 NUEVO PEDIDO YOKO", {
                        body: `Pedido de ${incomingOrder.customer_name || 'Cliente'} - $${incomingOrder.total || 0}`,
                        icon: "/icon.png"
                    });
                }
            } catch (err) {
                console.error('Notification error:', err);
            }
        } else {
            // Stop Sound with error handling
            try {
                if (audio) {
                    audio.pause();
                    audio.currentTime = 0;
                }
            } catch (err) {
                console.error('Audio stop error:', err);
            }
        }
    }, [incomingOrder]);

    const stopAudio = () => {
        try {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.currentTime = 0;
            }
        } catch (err) {
            console.error('Stop audio error:', err);
        }
    };

    const testAudio = () => {
        try {
            if (audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(e => showToast("Autoplay bloqueado, interactúa primero", 'error'));
                setTimeout(() => {
                    try {
                        if (audioRef.current && !incomingOrder) audioRef.current.pause();
                    } catch (err) {
                        console.error('Timeout audio error:', err);
                    }
                }, 2000);
            }
        } catch (err) {
            console.error('Test audio error:', err);
            showToast("Error al probar audio", 'error');
        }
    };

    // 3. Global Subscription
    useEffect(() => {
        const channel = supabase
            .channel('admin-global-orders')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
                const newOrder = payload.new as Order;
                if (newOrder.status === 'awaiting_payment') return;

                setIncomingOrder(newOrder);
                showToast(`🎉 Pedido Global: ${newOrder.customer_name}`, 'success');
            })
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
                const updated = payload.new as Order;
                // Detect late payment confirmation (Stripe webhook)
                if (updated.status === 'pending' && payload.old.status === 'awaiting_payment') {
                    setIncomingOrder(updated);
                    showToast(`💸 Pago confirmado: ${updated.customer_name}`, 'success');
                }
                // Auto-dismiss if handled elsewhere by status change (e.g. approved)
                if (updated.status !== 'pending' && incomingOrder?.id === updated.id) {
                    setIncomingOrder(null);
                }
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [incomingOrder]);

    return (
        <AdminContext.Provider value={{ incomingOrder, setIncomingOrder, stopAudio, testAudio }}>
            {children}
        </AdminContext.Provider>
    );
}

export const useAdmin = () => {
    const context = useContext(AdminContext);
    if (!context) throw new Error("useAdmin must be used within AdminProvider");
    return context;
};
