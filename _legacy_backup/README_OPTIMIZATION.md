# Optimización del Proyecto Yoko Poke House

Este proyecto ha sido optimizado para utilizar **Vite** y **Tailwind CSS** de forma profesional.
Esto asegura una carga mucho más rápida, mejor SEO y un código más limpio.

## Comandos Disponibles

1.  **Instalar dependencias** (solo la primera vez):
    ```bash
    npm install
    ```

2.  **Iniciar servidor de desarrollo** (para trabajar):
    ```bash
    npm run dev
    ```
    Esto abrirá una URL local (ej. `http://localhost:5173`) con recarga automática.

3.  **Construir para producción** (para subir a internet):
    ```bash
    npm run build
    ```
    Esto creará una carpeta `dist/` con los archivos optimizados listos para subir a tu hosting.

## Cambios Realizados

-   **Vite**: Se configuró como empaquetador para minificar código y optimizar recursos.
-   **Tailwind CSS**: Se migró de CDN a instalación local. Ahora el CSS generado pesará ~5KB en lugar de ~3MB.
-   **Configuración**: Se migraron los colores y fuentes personalizados a `tailwind.config.js`.
-   **SEO**: Se agregaron meta etiquetas para mejorar la visibilidad en Google.
-   **Correcciones**: Se eliminaron funciones duplicadas en `script.js` que causaban errores en modo estricto.

## Estructura
-   `index.html`: la archivo principal (ahora usa `<script type="module">`).
-   `script.js`: la lógica JavaScript (sin cambios funcionales).
-   `styles.css`: los estilos (ahora con directivas Tailwind).
-   `tailwind.config.js`: la configuración de diseño (colores, fuentes).
