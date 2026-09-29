# 行高模式

`itemSize` 这一个 prop 决定了行高的来源，共三种模式。选对模式，虚拟窗口、占位、滚动条总高全都自动正确。

## 怎么选

| 场景 | 模式 | 传法 |
| --- | --- | --- |
| 所有行一样高（表格、聊天气泡定高） | **固定行高** | `:item-size="50"` |
| 每行高度不同，但能同步算出（业务数据里就带高度） | **已知变高** | `:item-size="(i) => heights[i]"` |
| 行高事先未知，由渲染后的内容决定（图文混排、内容展开） | **动态高度** | 不传 `itemSize`，可选 `estimated-item-size` |

一条递进规则：**能定高就定高，其次已知变高，实在未知才用动态测量**。模式越靠后，运行时要做的工作越多（但都保持了 10 万行 60fps——见[性能基准](/guide/benchmark)）。

## 固定行高

```vue
<VScroll :items="items" :item-size="50" :height="600">
  <template #item="{ item }">
    <div class="row">{{ item.label }}</div>
  </template>
</VScroll>
```

窗口计算走乘法捷径，是最快路径。

## 已知变高

每行高度不同但可以同步给出——不用测量，偏移数组直接算准：

```vue
<VScroll :items="items" :item-size="rowHeight" :height="600">
  <template #item="{ item }">
    <div class="card">{{ item.label }}</div>
  </template>
</VScroll>
```

```ts
// 高度由业务数据推导（如卡片层级、文本长度分档）
const rowHeight = (index: number) => Math.max(40, 40 + items.value[index].score * 2)
```

[在线示例 →](/examples/variable-heights)

## 动态高度（测量）

行高由渲染后的内容决定：先按**估算高度**渲染出正确的窗口与总高，行进入 DOM 后由 ResizeObserver 测出真实高度并取代估算值，偏移、滚动条自动跟进。

```vue
<VScroll :items="items" :estimated-item-size="40" :height="600">
  <template #item="{ item }">
    <!-- 不写死高度，内容自然撑开 -->
    <div class="message">{{ item.text }}</div>
  </template>
</VScroll>
```

[在线示例 →](/examples/dynamic-measure)

动态模式的关键行为：

- **估算高度**（`estimated-item-size`，默认 40px）：未测量行的临时高度。估算越接近真实平均，首次滚动越顺
- **测量按帧合并**：一帧内多次测量只提交一次，偏移至多重建一次
- **锚定**：上方行测量落地导致偏移变化时，按差值修正滚动位置——用户正在看的行纹丝不动；图片加载、内容展开导致的行高变化也自动跟进
- **两阶段跳转**：`scrollToIndex` 跳到未测区域时先滚到估算位置，目标行测量落地后自动修正落点（至多修正 2 次，且只对真正改变落点的测量计数）；用户手动滚离目标则放弃修正，不把人拉回来
- **测量按索引归属**：整批替换数据（如换筛选条件）时测量保留；此时调用 `reset()` 清空测量、回到顶部，让新数据按自己的真实高度重新测量

::: tip 降级
环境没有 ResizeObserver（如老旧内核）时自动跳过测量，按估算高度渲染，不崩溃。
:::

## 同时传 `itemSize` 与 `estimatedItemSize`？

`itemSize` 优先，`estimatedItemSize` 被忽略，开发模式下输出一次告警。估算高度只在动态模式下有意义。
