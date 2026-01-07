/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./script.js",
    ],
    theme: {
        extend: {
            colors: {
                yoko: {
                    dark: '#1a2e1d',      /* Verde Bosque Oscuro (Premium) */
                    primary: '#2F5233',   /* Verde Marca */
                    accent: '#FF6B6B',    /* Salmón Vibrante */
                    light: '#F7F9F5',     /* Blanco Hueso */
                    gold: '#D4AF37',      /* Detalles Dorados */
                }
            },
            fontFamily: {
                'sans': ['Outfit', 'sans-serif'],
                'serif': ['Playfair Display', 'serif'],
            },
            boxShadow: {
                'soft': '0 10px 40px -10px rgba(0,0,0,0.08)',
                'glow': '0 0 20px rgba(47, 82, 51, 0.3)',
            }
        }
    },
    plugins: [],
}
