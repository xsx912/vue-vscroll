import vue from '@vitejs/plugin-vue'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'

// 组件库发布构建：只打包 src/vscroll，产出 ESM/CJS；
// 类型声明由 build:lib 中的 vue-tsc 单独生成（tsconfig.lib.json）
export default defineConfig({
  plugins: [vue()],
  publicDir: false,
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/vscroll/index.ts'),
      name: 'VueVscrollNext',
      formats: ['es', 'cjs'],
      fileName: (format) =>
        format === 'es' ? 'vue-vscroll-next.js' : 'vue-vscroll-next.cjs',
    },
    rollupOptions: {
      external: ['vue'],
    },
    cssCodeSplit: false,
    // vue-tsc 先产出 d.ts 到 dist，vite 不能再清空目录
    emptyOutDir: false,
  },
})