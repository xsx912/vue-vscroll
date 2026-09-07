<script setup lang="ts" generic="T">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type CSSProperties } from 'vue'
import { useVScroll, type ItemSize } from './useVScroll'
import { clearMeasurements, type Measurements } from './core/measure'

const props = withDefaults(
  defineProps<{
    /** 列表数据 */
    items: T[]
    /**
     * 行高来源：数字 = 固定行高，函数 = 已知变高（按索引），
     * 缺省 = 动态高度（先按估算渲染，测量后接管）
     */
    itemSize?: ItemSize
    /** 动态模式下未测行的估算高度（px，默认 40）；itemSize 存在时被忽略 */
    estimatedItemSize?: number
    /** 固定高度；不传则撑满父容器 */
    height?: string | number
    /** 视口外缓冲行数 */
    overscan?: number
    /** 是否显示加载状态（渲染底部 loading 插槽） */
    loading?: boolean
    /**
     * 注入 IntersectionObserver 构造器（测试/降级用），
     * 缺省时使用全局 IntersectionObserver，不存在则禁用触底检测
     */
    intersectionObserver?: typeof IntersectionObserver
    /**
     * 注入 ResizeObserver 构造器（动态模式行测量/测试用），
     * 缺省时使用全局 ResizeObserver，不存在则跳过测量（按估算高度渲染）
     */
    resizeObserver?: typeof ResizeObserver
  }>(),
  { overscan: 5, loading: false },
)

// 模式判定与开发告警（ADR-0001 双 prop 协议：itemSize 优先）
if (import.meta.env.DEV && props.itemSize != null && props.estimatedItemSize != null) {
  console.warn(
    '[vue-vscroll] itemSize 与 estimatedItemSize 同时传入：itemSize 优先，estimatedItemSize 被忽略',
  )
}

const emit = defineEmits<{
  loadMore: []
}>()

defineSlots<{
  item(props: { item: T; index: number }): unknown
  header?(): unknown
  footer?(): unknown
  empty?(): unknown
  loading?(): unknown
}>()

const containerEl = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const containerHeight = ref(0)
let containerObserver: ResizeObserver | null = null

function parseSize(value: string | number): number {
  return typeof value === 'number' ? value : parseFloat(value)
}

const viewportSize = computed(() =>
  props.height != null ? parseSize(props.height) : containerHeight.value,
)

/** 测量缓存（索引键 → 真实行高）；跨 items 变更保留（ADR-0003），reset() 清空 */
const measurements = shallowRef<Measurements>(new Map())

/** 动态模式判定：itemSize 缺省 */
const isDynamic = computed(() => props.itemSize == null)

// ---- 行测量（ADR-0002：ResizeObserver 持续观察已渲染行） ----

/** 已渲染行元素（索引 → 元素） */
const rowEls = new Map<number, HTMLElement>()
/** 每索引一个稳定 ref 回调，避免重渲染时反复 observe/unobserve 抖动 */
const rowRefFns = new Map<number, (el: unknown) => void>()
let rowObserver: ResizeObserver | null = null
/** 本帧内暂存的测量（索引 → 高度），帧末一次性提交 */
let pendingMeasurements: Map<number, number> | null = null
let commitScheduled = false
let commitRafId: number | null = null
/** 组件已卸载：微任务降级路径无法取消，提交时跳过 */
let disposed = false

function bindRowRef(el: unknown, index: number) {
  const node = (el as HTMLElement | null) ?? null
  const prev = rowEls.get(index) ?? null
  if (prev === node) return
  if (node) {
    rowEls.set(index, node)
    rowObserver?.observe(node)
  } else {
    rowEls.delete(index)
    rowRefFns.delete(index)
    if (prev) rowObserver?.unobserve(prev)
  }
  // 同一索引换了节点（罕见）：旧的必须停止观察
  if (prev && node && prev !== node) {
    rowObserver?.unobserve(prev)
  }
}

/** 模板使用的稳定 ref 回调（函数身份按索引复用，避免每帧 patch 重绑） */
function rowRefFor(index: number) {
  let fn = rowRefFns.get(index)
  if (!fn) {
    fn = (el: unknown) => bindRowRef(el, index)
    rowRefFns.set(index, fn)
  }
  return fn
}

function indexOfRow(el: Element): number {
  for (const [index, node] of rowEls) {
    if (node === el) return index
  }
  return -1
}

function onRowsResize(entries: ResizeObserverEntry[]) {
  for (const entry of entries) {
    const index = indexOfRow(entry.target)
    if (index < 0) continue
    const height = Math.round(entry.contentRect.height)
    ;(pendingMeasurements ??= new Map()).set(index, height)
  }
  scheduleCommit()
}

function scheduleCommit() {
  if (commitScheduled) return
  commitScheduled = true
  if (typeof requestAnimationFrame === 'function') {
    commitRafId = requestAnimationFrame(commitMeasurements)
  } else {
    // 无 rAF 的 DOM 环境：退化为微任务，仍保持帧内合并
    queueMicrotask(commitMeasurements)
  }
}

function commitMeasurements() {
  commitScheduled = false
  commitRafId = null
  const sizes = pendingMeasurements
  pendingMeasurements = null
  if (disposed || !sizes || sizes.size === 0) return
  // 一帧至多提交一次：offsets 至多重建一次；单次克隆 + 批量写入
  const next = new Map(measurements.value)
  for (const [index, size] of sizes) {
    next.set(index, size)
  }
  measurements.value = next
}

const { view, getOffsetForIndex } = useVScroll({
  count: computed(() => props.items.length),
  itemSize: props.itemSize,
  estimatedItemSize: props.estimatedItemSize,
  measurements,
  overscan: computed(() => props.overscan),
  scrollTop,
  viewportSize,
})

const sentinelEl = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

function onScroll(event: Event) {
  scrollTop.value = (event.target as HTMLElement).scrollTop
}

/** 修正锚定等逻辑改动的 scrollTop 时，同步回真实滚动容器 */
watch(scrollTop, (value) => {
  if (containerEl.value && containerEl.value.scrollTop !== value) {
    containerEl.value.scrollTop = value
  }
})
const containerStyle = computed<CSSProperties>(() =>
  props.height != null
    ? { height: typeof props.height === 'number' ? `${props.height}px` : props.height }
    : { height: '100%' },
)
const innerStyle = computed<CSSProperties>(() => ({
  height: `${view.value.totalSize}px`,
  position: 'relative',
}))
const itemStyle = (row: { top: number; size: number }): CSSProperties => ({
  position: 'absolute',
  top: `${row.top}px`,
  left: 0,
  right: 0,
  // 动态模式不锁行高：内容决定高度，ResizeObserver 测量后接管
  ...(isDynamic.value ? {} : { height: `${row.size}px` }),
})

/** 跳转到指定索引（start/center/end 对齐） */
function scrollToIndex(index: number, align: 'start' | 'center' | 'end' = 'start') {
  const target = getOffsetForIndex(index, align)
  scrollTop.value = target
  if (containerEl.value) containerEl.value.scrollTop = target
}

/** 回到顶部并清空测量（整批换数据后调用，ADR-0003） */
function reset() {
  scrollTop.value = 0
  if (containerEl.value) containerEl.value.scrollTop = 0
  measurements.value = clearMeasurements()
}

function measure() {
  if (props.height != null) return
  containerHeight.value = containerEl.value?.clientHeight ?? 0
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && props.height == null && containerEl.value) {
    containerObserver = new ResizeObserver(measure)
    containerObserver.observe(containerEl.value)
  }
  // 动态模式：ResizeObserver 持续观察已渲染行，行高变化自动跟进
  if (isDynamic.value) {
    const RO = props.resizeObserver ?? globalThis.ResizeObserver
    if (RO) {
      rowObserver = new RO(onRowsResize)
      for (const node of rowEls.values()) {
        rowObserver.observe(node)
      }
    }
  }
  // 触底加载哨兵：真正进入视口才 emit loadMore
  // （observe 后的首次异步回调可能带 isIntersecting:false，必须过滤）
  const IORef = props.intersectionObserver ?? globalThis.IntersectionObserver
  if (IORef && sentinelEl.value && containerEl.value) {
    observer = new IORef(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) emit('loadMore')
      },
      { root: containerEl.value },
    )
    observer.observe(sentinelEl.value)
  }
})

onBeforeUnmount(() => {
  disposed = true
  containerObserver?.disconnect()
  observer?.disconnect()
  rowObserver?.disconnect()
  rowEls.clear()
  rowRefFns.clear()
  if (commitRafId != null && typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(commitRafId)
  }
})

defineExpose({ scrollToIndex, reset })
</script>

<template>
  <div ref="containerEl" class="vscroll" :style="containerStyle" @scroll.passive="onScroll">
    <slot name="header" />
    <div class="vscroll-inner" :style="innerStyle">
      <template v-if="items.length > 0">
        <div
          v-for="row in view.rows"
          :key="row.index"
          class="vscroll-item"
          :style="itemStyle(row)"
          :ref="rowRefFor(row.index)"
        >
          <slot name="item" :item="items[row.index]" :index="row.index" />
        </div>
      </template>
      <slot v-else name="empty" />
      <div
        ref="sentinelEl"
        class="vscroll-sentinel"
        aria-hidden="true"
      ></div>
    </div>
    <slot v-if="loading" name="loading" />
    <slot name="footer" />
  </div>
</template>

<style scoped>
.vscroll {
  overflow: auto;
  position: relative;
  -webkit-overflow-scrolling: touch;
}
.vscroll-inner {
  width: 100%;
}
.vscroll-sentinel {
  width: 100%;
  height: 1px;
  position: absolute;
  bottom: 0;
}
</style>