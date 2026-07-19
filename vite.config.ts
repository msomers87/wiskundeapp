import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// PWA-opzet: web app manifest + service worker (workbox) die de app-shell
// cachet. De oefenkern (AI-calls via /api/claude) heeft internet nodig.
export default defineConfig({
  plugins: [
    react(),
    // MathLive laadt zijn wiskunde-fonts los van de bundel; kopieer ze mee.
    viteStaticCopy({
      targets: [{ src: 'node_modules/mathlive/dist/fonts/*', dest: 'fonts' }],
    }),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'WiskundeCoach',
        short_name: 'WiskundeCoach',
        description: 'Adaptief wiskunde oefenen op je eigen niveau',
        lang: 'nl',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        theme_color: '#3b5fd9',
        background_color: '#f4f6fb',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-512-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2,json}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
});
