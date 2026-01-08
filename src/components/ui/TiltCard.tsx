"use client";

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import Link from 'next/link';

interface TiltCardProps {
    children: React.ReactNode;
    className?: string;
    href?: string;
    onClick?: () => void;
}

export function TiltCard({ children, className = "", href, onClick }: TiltCardProps) {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
    const mouseY = useSpring(y, { stiffness: 500, damping: 100 });

    function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
        const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
        const xPct = (event.clientX - left) / width - 0.5;
        const yPct = (event.clientY - top) / height - 0.5;
        x.set(xPct);
        y.set(yPct);
    }

    function handleMouseLeave() {
        x.set(0);
        y.set(0);
    }

    const rotateX = useTransform(mouseY, [-0.5, 0.5], [10, -10]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], [-10, 10]);

    const content = (
        <motion.div
            style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={`relative h-full transition-all duration-200 ease-out will-change-transform ${className}`}
        >
            <div style={{ transform: "translateZ(50px)" }} className="absolute inset-4 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-white/10 blur-2xl rounded-full pointer-events-none" />
            {children}
        </motion.div>
    );

    if (href) {
        return (
            <Link href={href} className="group perspective-1000 block h-full">
                {content}
            </Link>
        );
    }
    return (
        <div
            onClick={onClick}
            className={`group perspective-1000 h-full ${onClick ? 'cursor-pointer' : ''}`}
        >
            {content}
        </div>
    );
}
