<script setup lang="ts" generic="T">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch, type CSSProperties } from 'vue'
import { useVScroll, type Align, type ItemSize } from './useVScroll'
import {
  clearMeasurements,
  setMeasurements,
  type MeasureKey,
  type Measurements,
} from './core/measure'

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
     * 缺省时使用全局 ResizeObserver，不存在时跳过测量（按估算高度渲染）
     */
    resizeObserver?: typeof ResizeObserver
    /**
     * 身份键（ADR-0005，动态模式）：测量按条目身份归属，整批替换/重排数据时
     * 测量自动跟随，无需 reset()。键需在当前列表内唯一；不提供则按索引归属
     */
    getItemKey?: (item: T, index: number) => string | number
    /**
     * 钉底（ADR-0004，聊天场景）：已在底部（含底容差）时尾部追加内容仍贴底，
     * 追加行测量落地也继续贴新底；用户上滚离开即退出，滚回恢复。
     * 挂载时列表非空则初始定位到底部
     */
    stickToBottom?: boolean
  }>(),
  { overscan: 5, loading: false, stickToBottom: false },
)

// 模式判定与开发告警（ADR-0001 双 prop 协议：itemSize 优先）
if (import.meta.env.DEV && props.itemSize != null && props.estimatedItemSize != null) {
  console.warn(
    '[vue-vscroll] itemSize 与 estimatedItemSize 同时传入：itemSize 优先，estimatedItemSize 被忽略',
  )
}
if (import.meta.env.DEV && props.itemSize != null && props.getItemKey != null) {
  console.warn(
    '[vue-vscroll] itemSize 与 getItemKey 同时传入：行高确定，getItemKey 被忽略',
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
/** 每帧内暂存的测量（键 → 高度），帧末一次性提交；键在回调时即刻落定，
 *  避免 items 在提交前被替换/缩短时错归属或越界 */
let pendingMeasurements: Map<MeasureKey, number> | null = null
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
    // 键在回调时即刻落定：提交时 items 可能已被替换/缩短
    ;(pendingMeasurements ??= new Map()).set(keyOf(index), height)
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

/** 测量缓存的键：身份键（ADR-0005）缺省回退索引键（ADR-0003） */
function keyOf(index: number): MeasureKey {
  return props.getItemKey ? props.getItemKey(props.items[index], index) : index
}

function commitMeasurements() {
  commitScheduled = false
  commitRafId = null
  const sizes = pendingMeasurements
  pendingMeasurements = null
  if (disposed || !sizes || sizes.size === 0) return
  measurements.value = setMeasurements(measurements.value, sizes)
}

/** 待消费的头部插入修正量（px）：offsets watcher 在下次重算时取走 */
let pendingPrependShift: number | null = null
/** useVScroll 的 sizeAt（setup 完成后晚绑定，供前插块高计算复用行高解析） */
let sizeAtFn: ((index: number) => number) | null = null

/**
 * 头部插入检测（ADR-0006，向上加载历史）：纯头部插入 = 原首条原位后移，
 * O(1) 探测——身份键比对（动态模式必备，索引平移否则测量错位）或对象
 * 引用比对（定高/已知变高免键；原始值数组退化为值相等，需 getItemKey）。
 * 修正量 = 插入块总高。须在 useVScroll 之前注册：其内部 offsets watcher
 * 先创建先执行。
 */
watch(
  () => props.items,
  (next, prev) => {
    pendingPrependShift = null
    if (!Array.isArray(next) || !Array.isArray(prev) || next.length <= prev.length) return
    const n = next.length - prev.length
    if (n >= next.length || !sizeAtFn) return
    const getKey = props.getItemKey
    if (props.itemSize == null && !getKey) return // 动态 + 索引键：不支持（ADR-0005）
    if (getKey) {
      if (getKey(prev[0], 0) !== getKey(next[n], n)) return
    } else if (prev[0] != null && typeof prev[0] === 'object') {
      if (prev[0] !== next[n]) return
    } else {
      return // 原始值数组无 getItemKey：不可靠探测，跳过
    }
    let block = 0
    for (let i = 0; i < n; i++) block += sizeAtFn(i)
    pendingPrependShift = block
  },
)

const { view, beginJump, cancelJump, sizeAt } = useVScroll({
  count: computed(() => props.items.length),
  itemSize: props.itemSize,
  estimatedItemSize: props.estimatedItemSize,
  measurements,
  keyAt: keyOf,
  prependShift: () => {
    const shift = pendingPrependShift
    pendingPrependShift = null
    return shift
  },
  overscan: computed(() => props.overscan),
  scrollTop,
  viewportSize,
  stickToBottom: computed(() => props.stickToBottom),
})
sizeAtFn = sizeAt

const sentinelEl = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

function onScroll(event: Event) {
  const el = event.target as HTMLElement
  // 两阶段跳转等待修正期间用户手动滚离目标：放弃修正，不再把用户拉回。
  // 1px 容差吸收浏览器对小数落点的取整与内容收缩时的钳制，避免误判为用户操作
  // （自身落点/修正设置的位置与 scrollTop.value 一致，不触发取消）。
  if (Math.abs(el.scrollTop - scrollTop.value) > 1) cancelJump()
  scrollTop.value = el.scrollTop
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

/** 统一落点应用：状态与真实容器同步写（修正锚定走 watch(scrollTop) 同步器） */
function applyScrollTop(value: number) {
  scrollTop.value = value
  if (containerEl.value) containerEl.value.scrollTop = value
}

/** 跳转到指定索引（start/center/end 对齐）；动态模式为两阶段跳转，测量落地后自动修正落点 */
function scrollToIndex(index: number, align: Align = 'start') {
  applyScrollTop(beginJump(index, align))
}

/** 回到顶部并清空测量（整批换数据后调用，ADR-0003），同时放弃未完成的跳转修正 */
function reset() {
  cancelJump()
  applyScrollTop(0)
  measurements.value = clearMeasurements()
}

function measure() {
  if (props.height != null) return
  containerHeight.value = containerEl.value?.clientHeight ?? 0
}

onMounted(() => {
  measure()
  // 钉底：挂载时已有内容（聊天历史）则初始定位到底部；
  // 动态模式下这次跳转走两阶段，测量落地后自动贴到真实底部
  if (props.stickToBottom && props.items.length > 0) {
    scrollToIndex(props.items.length - 1, 'end')
  }
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
  /* 关闭浏览器原生滚动锚定：虚拟列表自行修正，原生锚定会双重补偿（尤其头部插入） */
  overflow-anchor: none;
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