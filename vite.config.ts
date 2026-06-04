import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    base: './', // Genera rutas relativas para que funcione en cualquier subcarpeta de Hostinger
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      chunkSizeWarningLimit: 2000, // Eleva el límite para evitar avisos alarmantes
      rollupOptions: {
        output: {
          manualChunks(id) {
            // Separa las librerías grandes para que Hostinger no tenga problemas cargando un archivo gigante
            if (id.includes('node_modules')) {
              if (id.includes('jspdf') || id.includes('jspdf-autotable') || id.includes('html5-qrcode')) {
                return 'pdf-scanner-libs';
              }
              if (id.includes('xlsx')) {
                return 'xlsx-lib';
              }
              if (id.includes('supabase') || id.includes('@supabase')) {
                return 'supabase-lib';
              }
              if (id.includes('react') || id.includes('react-dom') || id.includes('motion')) {
                return 'core-vendor';
              }
            }
          }
        }
      }
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
