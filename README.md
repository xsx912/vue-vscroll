# vue-vscroll

高性能虚拟滚动列表组件（Vue 3 + TypeScript）。在只渲染可视区 + 缓冲行的前提下，用占位撑起滚动条真实总高，10 万条数据保持 DOM 节点数有界、60fps 滚动。

- **零运行时依赖**：核心算法与组件只依赖 Vue 本身
- **三种行高模式**：`itemSize` 传数字 = 固定行高，传函数 = 已知变高，缺省 = 动态高度（ResizeObserver 实测 + 估算渲染 + 测量缓存）
- **身份键测量**：`getItemKey` 提供时整批替换/重排数据测量自动跟随，无需 `reset()`
- **完整插槽集**：`item` / `header` / `footer` / `empty` / `loading`
- **触底加载**：IntersectionObserver 哨兵，滚动到底自动 `loadMore`
- **程序化定位**：`scrollToIndex`（start/center/end 对齐）；动态模式下为两阶段跳转——先落估算位置，测量落地后自动修正
- **钉底**：`stickToBottom`（聊天场景）——贴底时尾部追加仍贴底，测量落地继续贴新底；上滚即退出，滚回恢复
- **头部插入锚定**：向上加载历史——纯头部插入按块高修正，当前视图不动（动态模式配 `getItemKey`，定高免键）
- **数据变更锚定**：列表增删或测量落地时保持可视位置不跳动

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
| `itemSize` | `number \| (index: number) => number` | — | 行高来源，决定模式：数字 = 固定行高，函数 = 已知变高，缺省 = 动态高度（详见[文档·行高模式](https://xsx912.github.io/vue-vscroll/guide/dynamic-heights)） |
| `estimatedItemSize` | `number` | `40` | 动态模式下未测行的估算高度（px）；`itemSize` 存在时被忽略 |
| `height` | `number \| string` | — | 容器固定高度；不传则撑满父容器 |
| `overscan` | `number` | `5` | 视口外上下各预渲染的行数 |
| `loading` | `boolean` | `false` | 为 true 时渲染底部 `loading` 插槽 |
| `intersectionObserver` | `typeof IntersectionObserver` | 全局 | 注入 IntersectionObserver（测试/降级用） |
| `resizeObserver` | `typeof ResizeObserver` | 全局 | 注入 ResizeObserver（动态模式行测量/测试用）；环境缺失时按估算渲染 |
| `getItemKey` | `(item: T, index: number) => string \| number` | — | 身份键：动态模式测量按条目归属，替换/重排数据自动跟随；键需唯一 |
| `stickToBottom` | `boolean` | `false` | 钉底（聊天场景）：已在底部（含底容差）时尾部追加仍贴底，测量落地继续贴新底；上滚退出、滚回恢复；挂载时非空则初始贴底 |

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
| `scrollToIndex(index, align?)` | 跳转到指定索引，`align`：`'start' \| 'center' \| 'end'`；动态模式下两阶段跳转（估算落点 → 测量修正，用户滚离则放弃） |
| `reset()` | 回到顶部并清空全部测量（整批替换数据后调用） |

## 性能基准

实测环境：Chromium，10 万条数据，视口 600px。

| 指标 | 固定行高（50px） | 动态高度（36–108px，测量） |
| --- | --- | --- |
| 渲染 DOM 节点数 | ✅ 17–22，恒定 | ✅ 13–18，有界（上界 = 视口/最矮行 + 2×缓冲） |
| 滚动帧率 | ✅ 60–61fps | ✅ 60fps |
| 首屏渲染 | ✅ 1–7ms | ✅ 13ms |
| 主线程长任务 | ✅ 0 次 | ✅ 0 次 |

动态模式由 `scripts/bench-acceptance.mjs`（puppeteer-core 驱动本机 Chrome，生产构建）自动验收：滚轮连续滚动、两阶段跳转、DOM 采样，任一门楣不过则非零退出。

运行 `npm run dev` 后访问 [#bench](http://localhost:5173/#bench) 可在线复测（固定/动态模式并列）。

## 开发

```bash
npm install
npm run dev        # 示例页（demo）+ 基准页（#bench，固定/动态并列）
npm test           # Vitest：核心算法 + 组件行为（84 个用例）
npm run typecheck  # vue-tsc 全项目类型检查
npm run build      # 生产构建（vue-tsc + Vite）
npm run build:lib  # 库构建（ESM/CJS + d.ts）
```

## 设计说明

- **窗口计算**（`src/vscroll/core/window.ts`）：`findStartIndex` 二分查找 + `computeWindow` 计算渲染窗口与上下占位，纯函数、零依赖、单测覆盖
- **测量核心**（`src/vscroll/core/measure.ts`）：索引键测量缓存 + 偏移重建 + 总高，纯函数层
- **状态机**（`src/vscroll/useVScroll.ts`）：不触碰 DOM，由 `scrollTop → 窗口` 单向推导；数据变化/测量落地时锚定修正滚动偏移；两阶段跳转（估算落点 + 有界修正）
- **触底哨兵**：过滤 IntersectionObserver 首次非相交回调（避免挂载即触发 `loadMore`）
- **行测量**：ResizeObserver 持续观察已渲染行，按帧合并提交；无 RO 环境优雅降级

## 路线图

- [ ] 横向滚动 / 网格多列
- [ ] SSR 安全（当前仅保证不崩，完整支持待做）
- [ ] 无障碍语义（role/aria 治理）