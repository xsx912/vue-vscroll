# 虚拟表格（VGrid）

10 万行 × 多列的虚拟表格：行方向虚拟化（固定行高），列按声明的宽度渲染，总宽超出容器时自然横向滚动；表头 sticky 钉顶。

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { VGrid } from 'vue-vscroll-next'

const rows = ref(Array.from({ length: 100_000 }, (_, i) => ({
  id: i,
  name: `名称 ${i}`,
  score: (i * 7) % 100,
})))
const columns = [240, 160, 120]
</script>

<template>
  <VGrid :rows="rows" :columns="columns" :row-size="48" :height="600" :overscan="5">
    <template #header="{ columns }">
      <div v-for="(w, i) in columns" :key="i" class="th" :style="{ width: w + 'px' }">
        {{ ['名称', '分数', '操作'][i] }}
      </div>
    </template>
    <template #cell="{ item, column }">
      <span v-if="column === 0">{{ item.name }}</span>
      <span v-else-if="column === 1">{{ item.score }}</span>
      <button v-else>编辑</button>
    </template>
    <template #empty>没有数据</template>
  </VGrid>
</template>
```

## Props

| Prop | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `rows` | `T[]` | — | 行数据（每行一个条目，组件为泛型） |
| `columns` | `number[]` | — | 列宽（px），长度即列数（ADR-0007：v1 不做横向虚拟化） |
| `rowSize` | `number` | — | 行高（px），固定行高模式；运行时切换不生效，密度切换用 `:key` 重建 |
| `height` | `number \| string` | — | 容器固定高度；不传则撑满父容器 |
| `overscan` | `number` | `5` | 视口外上下缓冲行数 |
| `loading` | `boolean` | `false` | 为 true 时渲染底部 `loading` 插槽 |
| `intersectionObserver` | `typeof IntersectionObserver` | 全局 | 注入 IntersectionObserver（测试/降级用） |

## Slots

| 插槽 | 作用域 | 说明 |
| --- | --- | --- |
| `cell` | `{ item: T, row: number, column: number }` | 单元格（必用） |
| `header` | `{ columns: number[] }` | sticky 表头，按列宽排版 |
| `empty` | — | 无数据时显示（表头仍渲染） |
| `loading` | — | `loading` 为 true 时显示 |

## Events / Expose

| 名称 | 说明 |
| --- | --- |
| `loadMore` | 哨兵进入视口触发；空列表时哨兵必在视口内，可作首屏回填（防循环由 `loading` 把控） |
| `scrollToRow(row, align?)` | 跳转到指定行（start/center/end） |
| `reset()` | 回到顶部 |

## 行为说明

- **头部插入**（向上加载历史）：定高下块高精确（n × rowSize），对象引用探测，视图纹丝不动；原始值行数组不可靠探测、跳过（ADR-0006）
- **性能**：行虚拟化走固定行高乘法捷径，与 VScroll 定高模式同级的 10 万行 60fps 表现
