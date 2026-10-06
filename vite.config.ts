import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages adresi: https://tayfunhocaozel.github.io/deneme-degerlendirme/
export default defineConfig({
  base: '/deneme-degerlendirme/',
  plugins: [react()],
})
