import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
    },
    build: {
      // PageSpeed fix (15 Oct): the app shipped as ONE 1.5MB chunk — the whole
      // cause of render-blocking JS / TBT 270ms / Speed Index 4.3s. Split into
      // parallel-cacheable chunks: react core, firebase SDK (loaded async by
      // main.tsx anyway), lucide icons, everything else on demand.
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('node_modules')) {
              if (/[\\/]firebase[\\/]|@firebase[\\/]/.test(id)) return 'firebase';
              if (id.includes('lucide-react')) return 'icons';
              if (/[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
            }
          },
        },
      },
    },
  };
});
