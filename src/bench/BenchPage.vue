<script setup lang="ts">
import { computed, onBeforeMount, onBeforeUnmount, onMounted, ref } from 'vue'
import VScroll from '../vscroll/VScroll.vue'
import type { VScrollExpose } from '../vscroll/useVScroll'

const TOTAL = 100_000
const ITEM_SIZE = 50

const items = ref(Array.from({ length: TOTAL }, (_, i) => ({ id: i, label: `Row ${i}` })))
const domCount = ref(0)
const firstPaint = ref<number | null>(null)
const longTasks = ref(0)
const maxLongTask = ref(0)
const fps = ref(0)

const vscrollEl = ref<VScrollExpose | null>(null)

// —— 指标采集 ——
function countDOM() {
  const container = document.querySelector('.vscroll')
  domCount.value = container?.querySelectorAll('.vscroll-item').length ?? 0
}

// 近 60 帧的平均帧间隔 → 帧率
const frameTimes: number[] = []
let rafId = 0
function sampleFrames() {
  let prev = 0
  const step = (now: number) => {
    if (prev) {
      frameTimes.push(now - prev)
      if (frameTimes.length > 60) frameTimes.shift()
      const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length
      fps.value = Math.round(1000 / avg)
    }
    prev = now
    rafId = requestAnimationFrame(step)
  }
  rafId = requestAnimationFrame(step)
}

const longTaskObserver: PerformanceObserver | null =
  'PerformanceObserver' in window
    ? new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          longTasks.value++
          maxLongTask.value = Math.max(maxLongTask.value, Math.round(entry.duration))
        }
      })
    : null

let domObserver: MutationObserver | null = null
// 首次渲染计时从列表挂载前开始（覆盖子组件挂载阶段）
const t0 = performance.now()

onBeforeMount(() => {
  longTaskObserver?.observe({ entryTypes: ['longtask'] })
})

onMounted(async () => {
  requestAnimationFrame(sampleFrames)
  await new Promise((resolve) => requestAnimationFrame(resolve))
  firstPaint.value = Math.round(performance.now() - t0)
  const container = document.querySelector('.vscroll')
  if (container) {
    countDOM()
    domObserver = new MutationObserver(countDOM)
    domObserver.observe(container, { childList: true, subtree: true })
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  longTaskObserver?.disconnect()
  domObserver?.disconnect()
})

const stats = computed(() => [
  { label: '数据量', value: items.value.length.toLocaleString() },
  { label: '渲染 DOM 数', value: domCount.value },
  { label: '首屏渲染', value: firstPaint.value == null ? '—' : `${firstPaint.value}ms` },
  { label: '帧率(近60帧)', value: `${fps.value}fps` },
  { label: '长任务', value: `${longTasks.value} 次 / 最长 ${maxLongTask.value}ms` },
])
</script>

<template>
  <div class="bench">
    <h2>性能基准 · {{ items.length.toLocaleString() }} 行 · itemSize {{ ITEM_SIZE }}px</h2>
    <div class="stats">
      <div v-for="s in stats" :key="s.label" class="stat">
        <span class="stat-label">{{ s.label }}</span>
        <span class="stat-value">{{ s.value }}</span>
      </div>
    </div>
    <div class="actions">
      <button @click="vscrollEl?.scrollToIndex(50_000)">跳到第 50000 条</button>
      <button @click="vscrollEl?.reset()">回到顶部</button>
    </div>
    <VScroll ref="vscrollEl" class="bench-scroll" :items="items" :item-size="ITEM_SIZE" :height="600" :overscan="5">
      <template #item="{ item, index }">
        <div class="bench-row" :style="{ height: `${ITEM_SIZE}px` }">
          <span class="idx">#{{ index }}</span>
          <span class="label">{{ item.label }}</span>
        </div>
      </template>
    </VScroll>
  </div>
</template>

<style scoped>
.bench {
  padding: 16px;
  max-width: 720px;
  margin: 0 auto;
}
.stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.stat {
  border: 1px solid #ddd;
  border-radius: 6px;
  padding: 6px 10px;
  background: #fafafa;
  display: flex;
  gap: 8px;
  align-items: baseline;
}
.stat-label {
  color: #666;
  font-size: 12px;
}
.stat-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.bench-scroll {
  border: 1px solid #e2e2e2;
  border-radius: 8px;
  background: #fff;
}
.bench-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid #f0f0f0;
  box-sizing: border-box;
}
.idx {
  color: #999;
  font-size: 12px;
  width: 56px;
  font-variant-numeric: tabular-nums;
}
</style>