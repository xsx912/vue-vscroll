<script setup lang="ts">
import { computed, nextTick, onBeforeMount, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import VScroll from '../vscroll/VScroll.vue'
import type { VScrollExpose } from '../vscroll/useVScroll'

const TOTAL = 100_000
const ITEM_SIZE = 50
const ESTIMATE = 40

type BenchMode = 'fixed' | 'dynamic'
const mode = ref<BenchMode>('fixed')

const items = ref(Array.from({ length: TOTAL }, (_, i) => ({ id: i, label: `Row ${i}` })))
const domCount = ref(0)
const firstPaint = ref<number | null>(null)
const longTasks = ref(0)
const maxLongTask = ref(0)
const fps = ref(0)

const vscrollEl = ref<VScrollExpose | null>(null)

/** 确定性行数（1–4）：同一索引每次渲染同高，测量稳定；行高由内容决定 */
function linesOf(index: number): number {
  return 1 + (((index * 2654435761) >>> 0) % 4)
}

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
/** 本次运行的起点（页面挂载或切换模式重挂列表） */
let runStart = performance.now()

function resetRun() {
  runStart = performance.now()
  firstPaint.value = null
  longTasks.value = 0
  maxLongTask.value = 0
  domCount.value = 0
  frameTimes.length = 0
  fps.value = 0
}

function bindDomObserver() {
  domObserver?.disconnect()
  const container = document.querySelector('.vscroll')
  if (container) {
    countDOM()
    domObserver = new MutationObserver(countDOM)
    domObserver.observe(container, { childList: true, subtree: true })
  }
}

/** 一轮验收：等列表挂载并渲染两帧后记录首屏，绑定 DOM 计数 */
async function measureRun() {
  await nextTick()
  await new Promise((resolve) => requestAnimationFrame(resolve))
  firstPaint.value = Math.round(performance.now() - runStart)
  bindDomObserver()
}

onBeforeMount(() => {
  longTaskObserver?.observe({ entryTypes: ['longtask'] })
})

onMounted(() => {
  requestAnimationFrame(sampleFrames)
  void measureRun()
})

watch(mode, () => {
  resetRun()
  void measureRun()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(rafId)
  longTaskObserver?.disconnect()
  domObserver?.disconnect()
})

const modeLabel = computed(() =>
  mode.value === 'fixed' ? `固定行高 ${ITEM_SIZE}px` : `动态测量 · 估算 ${ESTIMATE}px`,
)

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
    <h2>性能基准 · {{ items.length.toLocaleString() }} 行 · {{ modeLabel }}</h2>
    <div class="mode-tabs">
      <button :class="{ active: mode === 'fixed' }" @click="mode = 'fixed'">固定行高</button>
      <button :class="{ active: mode === 'dynamic' }" @click="mode = 'dynamic'">
        动态高度（测量）
      </button>
    </div>
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
    <VScroll
      v-if="mode === 'fixed'"
      ref="vscrollEl"
      class="bench-scroll"
      :items="items"
      :item-size="ITEM_SIZE"
      :height="600"
      :overscan="5"
    >
      <template #item="{ item, index }">
        <div class="bench-row" :style="{ height: `${ITEM_SIZE}px` }">
          <span class="idx">#{{ index }}</span>
          <span class="label">{{ item.label }}</span>
        </div>
      </template>
    </VScroll>
    <VScroll
      v-else
      ref="vscrollEl"
      class="bench-scroll"
      :items="items"
      :estimated-item-size="ESTIMATE"
      :height="600"
      :overscan="5"
    >
      <template #item="{ item, index }">
        <div class="bench-row dyn">
          <span class="idx">#{{ index }}</span>
          <div class="dyn-content">
            <p v-for="n in linesOf(index)" :key="n">
              {{ item.label }} · 内容第 {{ n }} 行——行高由内容决定，测量后接管
            </p>
          </div>
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
.mode-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.mode-tabs button {
  padding: 4px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  color: #555;
}
.mode-tabs button.active {
  background: #42b883;
  border-color: #42b883;
  color: #fff;
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
.actions button {
  padding: 4px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
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
.bench-row.dyn {
  display: flex;
  align-items: flex-start;
  padding: 8px 16px;
}
.dyn-content p {
  margin: 0 0 4px;
  font-size: 13px;
  line-height: 20px;
  color: #333;
}
.idx {
  color: #999;
  font-size: 12px;
  width: 56px;
  flex: none;
  font-variant-numeric: tabular-nums;
}
</style>
