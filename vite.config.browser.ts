import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/browser.ts'),
      name: 'ImageShieldBrowser',
      fileName: (format) => `image-shield-browser.${format}.js`,
      formats: ['es', 'umd']
    },
    rollupOptions: {
      // 外部依存関係を指定（ライブラリとして使用される際に除外）
      external: [
        'node:fs',
        'node:path',
        'fs',
        'path'
      ],
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
      buffer: 'buffer',
      // Node.js file operations を browser stub で置き換え
      './utils/file': resolve(__dirname, 'src/utils/file-browser-stub.ts')
    }
  },
  optimizeDeps: {
    include: ['jimp']
  }
});
