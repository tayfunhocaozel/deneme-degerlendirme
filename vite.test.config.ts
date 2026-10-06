// Yalnızca yerel test: yayın derlemesine test sayfalarını da ekler (dist-test/). Asıl yayın vite.config.ts ile yapılır.
// Kullanım: npx vite build -c vite.test.config.ts && cp -r test/goruntu dist-test/test/ && npx vite preview -c vite.test.config.ts
import { defineConfig, mergeConfig } from 'vite'
import ana from './vite.config'

export default mergeConfig(
  ana,
  defineConfig({
    build: {
      outDir: 'dist-test',
      rollupOptions: {
        input: { index: 'index.html', optik: 'test/optik-test.html', kamera: 'test/kamera-test.html' },
      },
    },
  }),
)
