import type { Metadata } from "next";
import { Outfit, Playfair_Display } from "next/font/google"; // Correct import for styles
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "YOKO POKE HOUSE | El Mejor Poke de Comitán",
  description: "YOKO POKE HOUSE - El mejor Poke Bowl de Comitán. Ingredientes frescos, combinaciones únicas y servicio a domicilio.",
};

import { CartProvider } from "@/context/CartContext";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="scroll-smooth">
      <body className={`${outfit.variable} ${playfair.variable} antialiased bg-yoko-light text-yoko-dark selection:bg-yoko-primary selection:text-white`}>
        {/* Ambient Backgrounds */}
        <div className="bg-noise"></div>
        <div className="blob-cont">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
        </div>

        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
