"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ProductSelector from "./ProductSelector";
import Builder from "./Builder";

export default function OrderFlow() {
    const [showBuilder, setShowBuilder] = useState(false);
    const [builderMode, setBuilderMode] = useState<string>('bowl');
    const builderRef = useRef<HTMLDivElement>(null);

    const [builderVersion, setBuilderVersion] = useState(0);

    const handleProductSelect = (product: string) => {
        setBuilderMode(product);
        setShowBuilder(true);
        setBuilderVersion(v => v + 1); // Force new instance
    };

    const handleBack = () => {
        setShowBuilder(false);
    };

    useEffect(() => {
        // Restore state from session storage on mount
        const savedState = sessionStorage.getItem('yoko_builder_state');
        if (savedState) {
            const { showBuilder: savedShow, builderMode: savedMode } = JSON.parse(savedState);
            if (savedShow) {
                setShowBuilder(true);
                setBuilderMode(savedMode);
            }
        }

        // Bridge: Capture WA Params
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            const phone = params.get('phone');
            const source = params.get('source');
            if (phone) {
                console.log('📱 WhatsApp Bridge Active for:', phone);
                sessionStorage.setItem('yoko_wa_phone', phone);
            }
            if (source) sessionStorage.setItem('yoko_wa_source', source);
        }

        const handleOpenBuilder = (e: any) => {
            console.log('Event Received via Listener:', e.detail);
            const mode = e.detail?.mode || 'bowl';
            setBuilderMode(mode);
            setShowBuilder(true);
            setBuilderVersion(v => v + 1); // Force reset
        };

        window.addEventListener('open-builder', handleOpenBuilder);
        return () => window.removeEventListener('open-builder', handleOpenBuilder);
    }, []);

    // Persist state
    useEffect(() => {
        if (showBuilder) {
            sessionStorage.setItem('yoko_builder_state', JSON.stringify({ showBuilder, builderMode }));
        } else {
            sessionStorage.removeItem('yoko_builder_state');
        }
    }, [showBuilder, builderMode]);

    // Scroll to section when opening builder
    useEffect(() => {
        if (showBuilder) {
            const element = document.getElementById('order-flow');
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
                // Reset scroll of the builder container if needed
                window.scrollTo({ top: element.offsetTop, behavior: 'smooth' });
            }
        }
    }, [showBuilder, builderVersion]);

    console.log('OrderFlow Render:', { showBuilder, builderMode });

    // Map builderMode to slug (Direct pass-through for dynamic slugs)
    const getProductSlug = (mode: string): string => {
        // Legacy handling if needed, but primarily trust the passed slug
        if (mode === 'bowl') return 'poke-mediano'; // Fallback for legacy events
        if (mode === 'burger') return 'sushi-burger'; // Fallback for legacy events
        return mode;
    };

    return (
        <div id="order-flow" className="min-h-screen bg-white relative overflow-hidden">
            <AnimatePresence mode="wait">
                {!showBuilder ? (
                    <motion.div
                        key="selector"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        transition={{ duration: 0.3 }}
                        className="w-full"
                    >
                        <ProductSelector onSelect={handleProductSelect} />
                    </motion.div>
                ) : (
                    <motion.div
                        key="builder"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ duration: 0.3 }}
                        className="w-full"
                    >
                        <Builder
                            key={`${builderMode}-${builderVersion}`}
                            initialProductSlug={getProductSlug(builderMode)}
                            onBack={handleBack}
                        />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
