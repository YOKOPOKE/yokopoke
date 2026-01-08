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
  openGraph: {
    title: "YOKO POKE HOUSE | El Mejor Poke de Comitán",
    description: "Crea tu bowl perfecto con ingredientes frescos en Comitán.",
    url: "https://yokopoke.com", // Placeholder
    siteName: "Yoko Poke House",
    images: [
      {
        url: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=90", // Hero Image
        width: 1200,
        height: 630,
        alt: "Yoko Poke House Bowl",
      },
    ],
    locale: "es_MX",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Yoko Poke House",
    description: "El mejor Poke de Comitán",
    images: ["https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=90"],
  },
};

import { CartProvider } from "@/context/CartContext";

import ToastContainer from "@/components/ui/Toast";

import SplashScreen from "@/components/SplashScreen";

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

        <ToastContainer />
        <CartProvider>
          {children}
        </CartProvider>
      </body>
    </html>
  );
}
