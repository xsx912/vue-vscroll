# SSR 与无障碍

## SSR（服务端渲染）

传 `height` 时组件在服务端即渲染**首窗口 + 占位总高**，SEO 与首屏都有意义的内容；客户端挂载后水合，无 mismatch：

```vue
<!-- Nuxt / SSR：推荐显式传 height -->
<VScroll :items="items" :item-size="50" :height="600" />
<VGrid :rows="rows" :columns="columns" :row-size="48" :height="600" />
```

- 不传 `height`：服务端无法得知视口尺寸，只渲染缓冲行；客户端测量容器后自动补齐窗口（有水合差异成本）
- 动态高度模式：服务端按估算高度渲染首窗口，客户端测量落地后由锚定/两阶段跳转自动修正——与纯客户端行为一致
- RO/IO 等浏览器 API 全部在 `onMounted` 内启用，服务端零触碰

## 键盘滚动

滚动容器默认**不可键盘聚焦**（浏览器行为），键盘用户无法用方向键/空格滚动。两个组件的容器都带 `tabindex="0"`：聚焦后原生方向键、`PageUp/PageDown`、`Home/End` 滚动即刻生效。

- 不想要 tab 停留：透传 `tabindex="-1"` 覆盖
- 焦点框样式：默认保留浏览器焦点环（无障碍友好）；自定义用 `:deep(.vscroll:focus-visible)` / `:deep(.vgrid:focus-visible)`

## 语义角色

**VGrid 自带表格语义**（无需配置）：

- 容器 `role="grid"` + `aria-rowcount`（数据行 + 表头行）
- 行 `role="row"` + `aria-rowindex`（APG 1-based，表头是第 1 行）
- 格 `role="gridcell"`；表头行 `role="row"`——**表头单元格请在插槽内自行标 `role="columnheader"`**：

```vue
<template #header>
  <div v-for="(w, i) in columns" :key="i" role="columnheader" :style="{ width: w + 'px' }">
    {{ titles[i] }}
  </div>
</template>
```

**VScroll 保持角色中立**：列表内容可能是消息流、卡片墙，组件不替你决定。经 attrs 透传即可：

```vue
<VScroll :items="messages" role="list" aria-label="消息列表">
  <template #item="{ item }">
    <div role="listitem">{{ item.text }}</div>
  </template>
</VScroll>
```
