import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          dashboard: ['public/js/modules/dashboard.js'],
          rutas: ['public/js/modules/rutas.js'],
          atms: ['public/js/modules/atms.js']
        }
      }
    }
  }
});
