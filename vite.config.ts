import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'ImageShield',
      fileName: (format) => `image-shield.${format}.js`,
      formats: ['es', 'umd']
    },
    rollupOptions: {
      // 外部依存関係を指定（ライブラリとして使用される際に除外）
      external: [],
      output: {
        globals: {}
      }
    },
    target: 'es2020',
    minify: true
  },
  define: {
    // ブラウザ環境での Node.js 固有の変数を定義
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Node.js固有のモジュールのポリフィルが必要な場合はここで設定
      buffer: 'buffer'
    }
  },
  optimizeDeps: {
    include: ['jimp']
  }
});
