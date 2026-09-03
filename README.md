# vue-vscroll

高性能虚拟滚动列表组件（Vue 3 + TypeScript）。在只渲染可视区 + 缓冲行的前提下，用 padding 占位撑起滚动条假高度，10 万条数据也能保持 DOM 节点数恒定、60fps 滚动。

- **零运行时依赖**：核心算法与组件只依赖 Vue 本身
- **定高起步，动态高度预留**：`itemSize` 支持 `number | (index) => number`
- **完整插槽集**：`item` / `header` / `footer` / `empty` / `loading`
- **触底加载**：IntersectionObserver 哨兵，滚动到底自动 `loadMore`
- **程序化定位**：`scrollToIndex`（start/center/end 对齐）、`reset()`
- **数据变更锚定**：列表增删时保持可视位置不跳动

## 快速开始

```vue
<script setup lang="ts">
import { ref } from 'vue'
import VScroll from './vscroll/VScroll.vue'

const items = ref(Array.from({ length: 100_000 }, (_, i) => ({ id: i, label: `Row ${i}` })))

function loadMore() {
  // 触底时追加数据
  items.value.push(...more())
}
</script>

<template>
  <VScroll :items="items" :item-size="50" :height="600" :overscan="5" @load-more="loadMore">
    <template #item="{ item, index }">
      <div class="row">#{{ index }} · {{ item.label }}</div>
    </template>
  </VScroll>
</template>
```

不传 `height` 时组件撑满父容器（父容器需有确定高度）。需要更底层控制时，可单独使用 `useVScroll` 组合函数。

## API

### Props

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `items` | `T[]` | — | 列表数据（组件为泛型，插槽自动推导类型） |
| `itemSize` | `number \| (index: number) => number` | — | 滚动方向上的单行尺寸（px）；函数形式为 v2 动态高度预留 |
| `height` | `number \| string` | — | 容器固定高度；不传则撑满父容器 |
| `overscan` | `number` | `5` | 视口外上下各预渲染的行数 |
| `loading` | `boolean` | `false` | 为 true 时渲染底部 `loading` 插槽 |
| `intersectionObserver` | `typeof IntersectionObserver` | 全局 | 注入 IntersectionObserver（测试/降级用） |

### Slots

| 插槽 | 作用域 | 说明 |
| --- | --- | --- |
| `item` | `{ item: T, index: number }` | 列表行（必用） |
| `header` / `footer` | — | 列表首尾区域 |
| `empty` | — | 空数据时显示 |
| `loading` | — | `loading` 为 true 时显示 |

### Events

| 事件 | 说明 |
| --- | --- |
| `loadMore` | 滚动到底部（哨兵进入视口）时触发 |

### Expose（ref 调用）

| 方法 | 说明 |
| --- | --- |
| `scrollToIndex(index, align?)` | 跳转到指定索引，`align`：`'start' \| 'center' \| 'end'` |
| `reset()` | 回到顶部 |

## 性能基准

实测环境：Chromium，10 万条定高（50px）数据，视口 600px。

| 指标 | 验收线 | 实测 |
| --- | --- | --- |
| 渲染 DOM 节点数 | 恒定（可视 + overscan） | ✅ 顶部 17、滚动中 22 |
| 滚动帧率 | 60fps | ✅ 60–61fps |
| 首屏渲染 | < 100ms | ✅ 1–7ms |
| 主线程长任务 | < 16ms | ✅ 0 次 |

运行 `npm run dev` 后访问 [#bench](http://localhost:5173/#bench) 可在线复测。

## 开发

```bash
npm install
npm run dev        # 示例页（demo）+ 基准页（#bench）
npm test           # Vitest：核心算法 + 组件行为（31 个用例）
npm run typecheck  # vue-tsc 全项目类型检查
npm run build      # 生产构建（vue-tsc + Vite）
```

## 设计说明

- **窗口计算**（`src/vscroll/core/window.ts`）：`findStartIndex` 二分查找 + `computeWindow` 计算渲染窗口与上下占位，纯函数、零依赖、单测覆盖
- **状态机**（`src/vscroll/useVScroll.ts`）：不触碰 DOM，由 `scrollTop → 窗口` 单向推导；数据变化时以第一个可见项为锚修正滚动偏移
- **触底哨兵**：过滤 IntersectionObserver 首次非相交回调（避免挂载即触发 `loadMore`）
- 组件目录已按「可拆包」标准组织，将来可直接迁移为独立 npm 包

## 路线图（v2）

- [ ] 动态高度（ResizeObserver 实测 + 测量缓存；`itemSize` 函数接口已就位）
- [ ] 横向滚动 / 网格多列
- [ ] SSR 安全（当前不做特殊处理）
- [ ] 无障碍语义（role/aria 治理）