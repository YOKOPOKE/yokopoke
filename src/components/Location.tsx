"use client";

import { MapPin, Clock, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

export default function Location() {
    return (
        <section id="ubicacion" className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
                <motion.div
                    initial={{ opacity: 0, x: -50 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                >
                    <span className="text-yoko-accent font-bold uppercase tracking-widest text-xs lg:text-sm">
                        Visítanos
                    </span>
                    <h2 className="text-3xl lg:text-5xl font-serif font-bold text-yoko-dark mt-2 mb-6">
                        Nuestra Ubicación
                    </h2>
                    <div className="space-y-6 text-lg text-gray-600">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-yoko-primary mt-1 shrink-0">
                                <MapPin size={20} />
                            </div>
                            <p>Colonia Miguel Alemán,<br />Comitán de Domínguez, Chiapas.</p>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-yoko-primary mt-1 shrink-0">
                                <Clock size={20} />
                            </div>
                            <div>
                                <p className="font-bold text-yoko-dark">Horario:</p>
                                <p>Lun - Sab: 1:00 PM - 10:00 PM</p>
                                <p>Dom: 1:00 PM - 9:00 PM</p>
                            </div>
                        </div>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.6 }}
                    viewport={{ once: true }}
                    className="relative h-[400px] rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white group"
                >
                    {/* Using Google Maps Embed for Comitan search */}
                    <iframe
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        src="https://maps.google.com/maps?q=Colonia%20Miguel%20Alem%C3%A1n%2C%20Comit%C3%A1n%20de%20Dom%C3%ADnguez%2C%20Chiapas&t=&z=15&ie=UTF8&iwloc=&output=embed"
                        className="group-hover:grayscale-0 grayscale-[20%] transition-all duration-500"
                    >
                    </iframe>
                    <a
                        href="https://goo.gl/maps/SEARCH_QUERY"
                        target="_blank"
                        className="absolute bottom-4 right-4 bg-white px-4 py-2 rounded-lg shadow-md text-xs font-bold text-yoko-dark hover:bg-gray-100 flex items-center gap-2"
                    >
                        Ver en Google Maps <ExternalLink size={12} />
                    </a>
                </motion.div>
            </div>
        </section>
    );
}
