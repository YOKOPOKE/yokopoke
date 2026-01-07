import { defineConfig } from 'vite'

export default defineConfig({
    // config options
    appType: 'mpa', // Disable SPA fallback to allow /admin/index.html
    plugins: [
        {
            name: 'redirect-admin-slash',
            configureServer(server) {
                server.middlewares.use((req, res, next) => {
                    if (req.url === '/admin') {
                        req.url = '/admin/';
                        // Alternatively send 301 redirect
                        // res.writeHead(301, { Location: '/admin/' });
                        // res.end();
                        // But rewriting req.url is often enough for internal serving
                    }
                    next();
                });
            }
        }
    ],
    server: {
        open: true
    },
    build: {
        outDir: 'dist',
        sourcemap: false,
        rollupOptions: {
            input: {
                main: 'index.html',
                admin: 'admin/index.html'
            }
        }
    }
})
