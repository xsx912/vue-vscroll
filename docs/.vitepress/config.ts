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
          { text: '行高模式', link: '/guide/dynamic-heights' },
          { text: 'API 参考', link: '/guide/api' },
          { text: '性能基准', link: '/guide/benchmark' },
        ],
      },
      {
        text: '示例',
        items: [
          { text: '基础用法', link: '/examples/basic' },
          { text: '触底加载', link: '/examples/infinite' },
          { text: '已知变高', link: '/examples/variable-heights' },
          { text: '动态高度（测量）', link: '/examples/dynamic-measure' },
          { text: '钉底（聊天场景）', link: '/examples/chat' },
        ],
      },
    ],
    socialLinks: [{ icon: 'github', link: 'https://github.com/xsx912/vue-vscroll' }],
  },
})