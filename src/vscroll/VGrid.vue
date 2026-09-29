<script lang="ts">
/** VGrid 通过 ref 暴露的实例方法（对外类型契约） */
export interface VGridExpose {
  scrollToRow(row: number, align?: 'start' | 'center' | 'end'): void
  reset(): void
}
</script>

<script setup lang="ts" generic="T">
import { computed, ref, watch, type CSSProperties } from 'vue'
import { useVScroll, type Align } from './useVScroll'
import { useLoadMoreSentinel } from './useLoadMore'
import { useContainerViewport } from './useContainerViewport'

const props = withDefaults(
  defineProps<{
    /** 行数据（每行一个条目，行内容按列切分渲染） */
    rows: T[]
    /** 列宽（px），长度即列数；总宽超出容器时出现横向滚动条 */
    columns: number[]
    /** 行高（px）——网格为固定行高模式（ADR-0007）；运行时切换不生效，密度切换请用 :key 重建 */
    rowSize: number
    /** 容器固定高度；不传则撑满父容器 */
    height?: string | number
    /** 视口外上下缓冲行数 */
    overscan?: number
    /** 是否显示加载状态（渲染底部 loading 插槽） */
    loading?: boolean
    /** 注入 IntersectionObserver 构造器（测试/降级用） */
    intersectionObserver?: typeof IntersectionObserver
  }>(),
  { overscan: 5, loading: false },
)

const emit = defineEmits<{ loadMore: [] }>()

defineSlots<{
  cell(slotProps: { item: T; row: number; column: number }): unknown
  header?(slotProps: { columns: number[] }): unknown
  empty?(): unknown
  loading?(): unknown
}>()

const containerEl = ref<HTMLElement | null>(null)
const sentinelEl = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const viewportSize = useContainerViewport({
  container: containerEl,
  fixedHeight: () => props.height,
})

/** 待消费的头部插入修正量（px）：offsets watcher 在下次重算时取走 */
let pendingPrependShift: number | null = null

/**
 * 头部插入检测（ADR-0006，向上加载历史）：定高网格的 offsets 纯由索引决定，
 * delta 锚定对前插恒为 0，必须按块高显式修正。O(1) 引用探测（行数据为
 * 对象）；原始值数组不可靠探测，跳过。须在 useVScroll 之前注册。
 */
watch(
  () => props.rows,
  (next, prev) => {
    pendingPrependShift = null
    if (!Array.isArray(next) || !Array.isArray(prev) || next.length <= prev.length) return
    const n = next.length - prev.length
    if (n >= next.length) return
    if (prev[0] == null || typeof prev[0] !== 'object' || prev[0] !== next[n]) return
    pendingPrependShift = n * props.rowSize
  },
)

const { view, getOffsetForIndex } = useVScroll({
  count: computed(() => props.rows.length),
  itemSize: props.rowSize,
  prependShift: () => {
    const shift = pendingPrependShift
    pendingPrependShift = null
    return shift
  },
  overscan: computed(() => props.overscan),
  scrollTop,
  viewportSize,
})

useLoadMoreSentinel({
  root: containerEl,
  sentinel: sentinelEl,
  ioCtor: props.intersectionObserver,
  onLoadMore: () => emit('loadMore'),
})

function onScroll(event: Event) {
  scrollTop.value = (event.target as HTMLElement).scrollTop
}

/** 头部插入锚定等逻辑改动的 scrollTop，同步回真实滚动容器 */
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
  // 列总宽超出容器时撑出横向滚动；不足时占满容器宽度
  width: 'max-content',
  minWidth: '100%',
}))

/** 统一落点应用：状态与真实容器同步写 */
function applyScrollTop(value: number) {
  scrollTop.value = value
  if (containerEl.value) containerEl.value.scrollTop = value
}

/** 跳转到指定行（start/center/end 对齐，固定行高一步到位） */
function scrollToRow(row: number, align: Align = 'start') {
  applyScrollTop(getOffsetForIndex(row, align))
}

/** 回到顶部 */
function reset() {
  applyScrollTop(0)
}

defineExpose({ scrollToRow, reset })
</script>

<template>
  <div
    ref="containerEl"
    class="vgrid"
    :style="containerStyle"
    tabindex="0"
    role="grid"
    :aria-rowcount="rows.length + 1"
    @scroll.passive="onScroll"
  >
    <div class="vgrid-header" role="row">
      <slot name="header" :columns="columns" />
    </div>
    <div class="vgrid-inner" :style="innerStyle">
      <template v-if="rows.length > 0">
        <div
          v-for="row in view.rows"
          :key="row.index"
          class="vgrid-row"
          role="row"
          :aria-rowindex="row.index + 2"
          :style="{ top: `${row.top}px`, height: `${rowSize}px` }"
        >
          <div
            v-for="(col, column) in columns"
            :key="column"
            class="vgrid-cell"
            role="gridcell"
            :style="{ width: `${col}px` }"
          >
            <slot name="cell" :item="rows[row.index]" :row="row.index" :column="column" />
          </div>
        </div>
      </template>
      <slot v-else name="empty" />
      <div ref="sentinelEl" class="vgrid-sentinel" aria-hidden="true"></div>
    </div>
    <slot v-if="loading" name="loading" />
  </div>
</template>

<style scoped>
.vgrid {
  overflow: auto;
  position: relative;
  -webkit-overflow-scrolling: touch;
  /* 关闭浏览器原生滚动锚定：虚拟表格自行修正 */
  overflow-anchor: none;
}
.vgrid-header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  width: max-content;
  min-width: 100%;
  background: #fff;
}
.vgrid-inner {
  width: max-content;
  min-width: 100%;
}
.vgrid-row {
  position: absolute;
  left: 0;
  display: flex;
}
.vgrid-cell {
  flex: none;
  overflow: hidden;
}
.vgrid-sentinel {
  position: absolute;
  bottom: 0;
  width: 100%;
  height: 1px;
}
</style>
