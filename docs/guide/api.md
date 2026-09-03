# API 参考

## VScroll 组件

组件为泛型组件 `<VScroll<T>>`，`items` 的类型会传递到 `#item` 插槽作用域。

### Props

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `items` | `T[]` | — | 列表数据 |
| `itemSize` | `number \| (index: number) => number` | — | 滚动方向上的单行尺寸（px）；函数形式为 v2 动态高度预留 |
| `height` | `number \| string` | — | 容器固定高度；不传则撑满父容器 |
| `overscan` | `number` | `5` | 视口外上下各预渲染的行数 |
| `loading` | `boolean` | `false` | 为 true 时渲染底部 `loading` 插槽 |
| `intersectionObserver` | `typeof IntersectionObserver` | 全局 | 注入 IntersectionObserver（测试/降级用） |

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
| `scrollToIndex(index, align?)` | 跳转到指定索引，`align`：`'start' \| 'center' \| 'end'`，越界自动钳制 |
| `reset()` | 回到顶部 |

## useVScroll 组合函数

无头状态机，不触碰 DOM：

```ts
const { view, startIndex, getOffsetForIndex, sizeAt } = useVScroll({
  count,
  itemSize,
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
| `sizeAt(index)` | 某索引的尺寸 |

数据变化（`count` 改变）时自动锚定第一个可见项并修正 `scrollTop`。