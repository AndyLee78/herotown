import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // GitHub Pages serves the game under /herotown/ (Docs/tasks.md task 12); local builds stay at the root.
  base: process.env.PAGES_BASE ?? '/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      devOptions: { enabled: false },
      includeAssets: ['favicon.svg', 'fonts/Jua-Regular.woff2', 'icons/*.png'],
      manifest: {
        name: '영웅의 마을',
        short_name: '영웅의 마을',
        description: 'Hero Town',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#fff8ec',
        background_color: '#cfe6f2',
        lang: 'ko',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        importScripts: ['notification-worker.js'],
        globPatterns: ['**/*.{js,css,html,svg,woff2,png,webmanifest}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [{ name: 'three', test: /node_modules[\\/]three[\\/]/ }],
        },
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
})
