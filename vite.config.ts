import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages adresi: https://tayfunhocaozel.github.io/deneme-degerlendirme/
export default defineConfig({
  base: '/deneme-degerlendirme/',
  plugins: [react()],
  // Optik okuyucu Worker'ı OpenCV.js'i dinamik olarak yükler; bunun için ES modül biçimi gerekir.
  worker: { format: 'es' },
})
