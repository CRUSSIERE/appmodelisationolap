import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // GitHub Pages serves the site under /<repo>/, so the built asset links
  // need that prefix; the dev server stays at the root
  base: command === 'build' ? '/appmodelisationolap/' : '/',
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.PORT) || 5173,
  },
}))
