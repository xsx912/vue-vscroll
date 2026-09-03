# 快速上手

## 最小示例

```vue
<script setup lang="ts">
import { ref } from 'vue'
import VScroll from '../vscroll/VScroll.vue'

const items = ref(Array.from({ length: 100_000 }, (_, i) => ({ id: i, label: `Row ${i}` })))
</script>

<template>
  <VScroll :items="items" :item-size="50" :height="600" :overscan="5">
    <template #item="{ item, index }">
      <div class="row">#{{ index }} · {{ item.label }}</div>
    </template>
  </VScroll>
</template>
```

## 容器高度

`height` 为可选 prop：

- **传入**：使用固定高度，滚动发生在组件自身容器内
- **不传**：撑满父容器（父容器需有确定高度）

## 触底加载

监听 `loadMore` 事件，滚动到底部（哨兵进入视口）时触发：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import VScroll from './vscroll/VScroll.vue'

const items = ref(/* 初始数据 */)
const loading = ref(false)

function loadMore() {
  if (loading.value) return
  loading.value = true
  fetchMore().then((next) => {
    items.value.push(...next)
    loading.value = false
  })
}
</script>

<template>
  <VScroll :items="items" :item-size="64" :loading="loading" @load-more="loadMore">
    <template #item="{ item }">{{ item.label }}</template>
    <template #loading>加载中…</template>
    <template #empty>没有数据</template>
  </VScroll>
</template>
```

## 程序化滚动

通过 ref 调用 `scrollToIndex` 与 `reset`：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import VScroll from './vscroll/VScroll.vue'

const vscroll = ref<InstanceType<typeof VScroll> | null>(null)

function jump() {
  vscroll.value?.scrollToIndex(5000, 'center')
}
</script>

<template>
  <button @click="jump">跳到第 5000 条（居中）</button>
  <VScroll ref="vscroll" :items="items" :item-size="50" :height="400" />
</template>
```

`scrollToIndex(index, align?)` 支持 `'start' | 'center' | 'end'` 三种对齐方式，越界自动钳制。