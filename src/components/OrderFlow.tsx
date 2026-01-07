"use client";

import { useState, useRef, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ProductSelector from "./ProductSelector";
import Builder from "./Builder";

export default function OrderFlow() {
    const [showBuilder, setShowBuilder] = useState(false);
    const [builderMode, setBuilderMode] = useState<'bowl' | 'burger'>('bowl');
    const builderRef = useRef<HTMLDivElement>(null);

    const handleProductSelect = (product: string) => {
        setBuilderMode(product as 'bowl' | 'burger');
        setShowBuilder(true);
        // Remove scroll logic, let animation handle it
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

        const handleOpenBuilder = (e: any) => {
            console.log('Event Received via Listener:', e.detail);
            const mode = e.detail?.mode || 'bowl';
            setBuilderMode(mode);
            setShowBuilder(true);
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

    console.log('OrderFlow Render:', { showBuilder, builderMode });

    return (
        <div className="min-h-screen bg-white">
            {!showBuilder ? (
                <ProductSelector onSelect={handleProductSelect} />
            ) : (
                <Builder initialProductType={builderMode} onBack={handleBack} />
            )}
        </div>
    );
}
