import { Facebook, Instagram, MapPin, Phone, Mail, Heart } from "lucide-react";

export default function Footer() {
    return (
        <footer className="bg-yoko-dark text-white pt-16 pb-8 relative overflow-hidden" id="footer">
            <div className="absolute inset-0 bg-noise opacity-10"></div>
            <div className="max-w-7xl mx-auto px-4 relative z-10">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
                    {/* Brand */}
                    <div>
                        <h2 className="text-3xl font-serif font-bold mb-4 tracking-wider">YOKO</h2>
                        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                            Ingredientes frescos, sabores auténticos y la libertad de crear tu bowl perfecto en el corazón de Comitán.
                        </p>
                        <div className="flex gap-4">
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-yoko-accent hover:border-yoko-accent transition-all duration-300 hover:scale-110">
                                <Facebook size={18} />
                            </a>
                            <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-yoko-accent hover:border-yoko-accent transition-all duration-300 hover:scale-110">
                                <Instagram size={18} />
                            </a>
                        </div>
                    </div>

                    {/* Links */}
                    <div>
                        <h3 className="font-bold text-lg mb-6 text-yoko-accent uppercase tracking-widest text-xs">Explorar</h3>
                        <ul className="space-y-3 text-sm text-gray-400">
                            <li><a href="#inicio" className="hover:text-white transition-colors duration-200">Inicio</a></li>
                            <li><a href="#menu" className="hover:text-white transition-colors duration-200">Menú</a></li>
                            <li><a href="#arma-tu-bowl" className="hover:text-white transition-colors duration-200">Armar Bowl</a></li>
                            <li><a href="#ubicacion" className="hover:text-white transition-colors duration-200">Ubicación</a></li>
                        </ul>
                    </div>

                    {/* Contact */}
                    <div>
                        <h3 className="font-bold text-lg mb-6 text-yoko-accent uppercase tracking-widest text-xs">Contacto</h3>
                        <ul className="space-y-4 text-sm text-gray-400">
                            <li className="flex items-start gap-3">
                                <MapPin size={16} className="mt-1 text-yoko-accent" />
                                <span>Av. Central Sur Pte. 12, Centro,<br />30000 Comitán de Domínguez, Chis.</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <Phone size={16} className="text-yoko-accent" />
                                <span>+52 963 137 1902</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <Mail size={16} className="text-yoko-accent" />
                                <span>hola@yokopoke.com</span>
                            </li>
                        </ul>
                    </div>

                    {/* Hours */}
                    <div>
                        <h3 className="font-bold text-lg mb-6 text-yoko-accent uppercase tracking-widest text-xs">Horario</h3>
                        <ul className="space-y-2 text-sm text-gray-400">
                            <li className="flex justify-between border-b border-white/10 pb-2">
                                <span>Lunes - Viernes</span>
                                <span className="font-bold text-white">12:00 - 22:00</span>
                            </li>
                            <li className="flex justify-between border-b border-white/10 pb-2">
                                <span>Sábado</span>
                                <span className="font-bold text-white">13:00 - 23:00</span>
                            </li>
                            <li className="flex justify-between pb-2">
                                <span>Domingo</span>
                                <span className="font-bold text-yoko-accent">Cerrado</span>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                    <p className="text-xs text-gray-500">© 2024 Yoko Poke House. Todos los derechos reservados.</p>
                    <p className="text-xs text-gray-600 flex items-center gap-1">
                        Diseñado con <Heart size={12} className="text-red-500 fill-current animate-pulse" /> en Comitán
                    </p>
                </div>
            </div>
        </footer>
    );
}
