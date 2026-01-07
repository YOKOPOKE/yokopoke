import Link from "next/link";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Menu from "@/components/Menu";
import Location from "@/components/Location";
import Footer from "@/components/Footer";
import OrderFlow from "@/components/OrderFlow";
import CartDrawer from "@/components/CartDrawer"; // Import Drawer

export default function Home() {
  return (
    <main className="min-h-screen bg-yoko-light">
      <Navbar />
      <CartDrawer /> {/* Render Drawer */}
      <Hero />
      <Menu />
      <OrderFlow /> {/* Contains ProductSelector and Builder */}
      <Location />
      <Footer />
    </main>
  );
}
