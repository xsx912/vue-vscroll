# API 参考

## VScroll 组件

组件为泛型组件 `<VScroll<T>>`，`items` 的类型会传递到 `#item` 插槽作用域。

### Props

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `items` | `T[]` | — | 列表数据 |
| `itemSize` | `number \| (index: number) => number` | — | 行高来源，决定模式：数字 = **固定行高**（最快路径），函数 = **已知变高**（偏移直接算准），缺省 = **动态高度**（先按估算渲染，测量后接管）。详见[行高模式](/guide/dynamic-heights) |
| `estimatedItemSize` | `number` | `40` | 动态模式下未测行的估算高度（px）；`itemSize` 存在时被忽略（开发模式告警） |
| `height` | `number \| string` | — | 容器固定高度；不传则撑满父容器 |
| `overscan` | `number` | `5` | 视口外上下各预渲染的行数 |
| `loading` | `boolean` | `false` | 为 true 时渲染底部 `loading` 插槽 |
| `intersectionObserver` | `typeof IntersectionObserver` | 全局 | 注入 IntersectionObserver（测试/降级用） |
| `resizeObserver` | `typeof ResizeObserver` | 全局 | 注入 ResizeObserver（动态模式行测量/测试用）；环境缺失时跳过测量、按估算渲染 |
| `getItemKey` | `(item: T, index: number) => string \| number` | — | 身份键（ADR-0005，动态模式）：测量按条目身份归属，整批替换/重排数据时自动跟随、无需 `reset()`；键需在列表内唯一（重复后写覆盖）；不提供则按索引归属。也是头部插入锚定（ADR-0006）在动态模式/原始值数组下的探测前提 |
| `stickToBottom` | `boolean` | `false` | 钉底（ADR-0004，聊天场景）：已在底部（含底容差 4px）时尾部追加仍贴底，测量落地继续贴新底；上滚离开即退出，滚回恢复；挂载时列表非空则初始定位到底部 |

### Slots

| 插槽 | 作用域 | 说明 |
| --- | --- | --- |
| `item` | `{ item: T, index: number }` | 列表行（必用） |
| `header` | — | 列表顶部（随内容滚动） |
| `footer` | — | 列表底部（随内容滚动） |
| `empty` | — | 空数据时显示 |
| `loading` | — | `loading` 为 true 时显示 |

### Events

| 事件 | 说明 |
| --- | --- |
| `loadMore` | 哨兵进入视口（滚动到底部）时触发；空列表时哨兵仍在，可用于首屏回填 |

### Expose（ref 调用）

| 方法 | 说明 |
| --- | --- |
| `scrollToIndex(index, align?)` | 跳转到指定索引，`align`：`'start' \| 'center' \| 'end'`，越界自动钳制。动态模式下为两阶段跳转：先落估算位置，测量落地后自动修正（至多 2 次；用户手动滚离目标则放弃） |
| `reset()` | 回到顶部并**清空全部测量**——整批替换数据后调用，新数据按自己的真实高度重新测量 |

## useVScroll 组合函数

无头状态机，不触碰 DOM：

```ts
const { view, startIndex, getOffsetForIndex, sizeAt } = useVScroll({
  count,
  itemSize,          // 可选：缺省 = 动态高度（需同时传 measurements）
  estimatedItemSize, // 动态模式未测行的估算高度
  measurements,      // 动态模式的测量缓存（索引键 → 真实行高）
  overscan,
  scrollTop,
  viewportSize,
})
```

| 返回值 | 说明 |
| --- | --- |
| `view` | `{ rows: { index, top, size }[], totalSize }` 渲染窗口与总高度 |
| `startIndex` | 当前滚动位置命中的首个索引 |
| `getOffsetForIndex(index, align?)` | 跳转目标偏移量（px）计算 |
| `sizeAt(index)` | 某索引的尺寸（动态模式：已测值 ?: 估算值） |

数据变化（`count` 改变）或测量落地时自动锚定：以变化前第一个可见项为锚修正 `scrollTop`，保持可视位置不跳动。

类型 `Align`（`'start' | 'center' | 'end'`）、`ItemSize`、`VScrollExpose` 等均从包入口导出。