import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'vue-vscroll',
  description: '高性能虚拟滚动列表组件（Vue 3 + TypeScript）',
  lang: 'zh-CN',
  base: '/vue-vscroll/',
  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/installation' },
      { text: '示例', link: '/examples/basic' },
      { text: 'GitHub', link: 'https://github.com/xsx912/vue-vscroll' },
    ],
    sidebar: [
      {
        text: '指南',
        items: [
          { text: '安装', link: '/guide/installation' },
          { text: '快速上手', link: '/guide/usage' },
          { text: 'API 参考', link: '/guide/api' },
          { text: '性能基准', link: '/guide/benchmark' },
        ],
      },
      {
        text: '示例',
        items: [
          { text: '基础用法', link: '/examples/basic' },
          { text: '触底加载', link: '/examples/infinite' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/xsx912/vue-vscroll' }],
  },
})