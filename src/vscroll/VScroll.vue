<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch, type CSSProperties } from 'vue'
import { useVScroll, type ItemSize } from './useVScroll'

const props = withDefaults(
  defineProps<{
    /** 列表数据 */
    items: unknown[]
    /** 每个 item 在滚动方向上的尺寸（px）；函数形式为 v2 动态高度预留 */
    itemSize: ItemSize
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
  }>(),
  { overscan: 5, loading: false },
)

const emit = defineEmits<{
  loadMore: []
}>()

defineSlots<{
  item(props: { item: unknown; index: number }): unknown
  header?(): unknown
  footer?(): unknown
  empty?(): unknown
  loading?(): unknown
}>()

const containerEl = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const containerHeight = ref(0)
let resizeObserver: ResizeObserver | null = null

function parseSize(value: string | number): number {
  return typeof value === 'number' ? value : parseFloat(value)
}

const viewportSize = computed(() =>
  props.height != null ? parseSize(props.height) : containerHeight.value,
)

const { view, getOffsetForIndex } = useVScroll({
  count: computed(() => props.items.length),
  itemSize: props.itemSize,
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
const containerStyle = computed<CSSProperties | undefined>(() =>
  props.height != null
    ? { height: typeof props.height === 'number' ? `${props.height}px` : props.height }
    : undefined,
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
  height: `${row.size}px`,
})

/** 跳转到指定索引（start/center/end 对齐） */
function scrollToIndex(index: number, align: 'start' | 'center' | 'end' = 'start') {
  const target = getOffsetForIndex(index, align)
  scrollTop.value = target
  if (containerEl.value) containerEl.value.scrollTop = target
}

/** 回到顶部 */
function reset() {
  scrollTop.value = 0
  if (containerEl.value) containerEl.value.scrollTop = 0
}

function measure() {
  if (props.height != null) return
  containerHeight.value = containerEl.value?.clientHeight ?? 0
}

onMounted(() => {
  measure()
  if (typeof ResizeObserver !== 'undefined' && props.height == null && containerEl.value) {
    resizeObserver = new ResizeObserver(measure)
    resizeObserver.observe(containerEl.value)
  }
  // 触底加载哨兵：进入视口即 emit loadMore
  const IORef = props.intersectionObserver ?? globalThis.IntersectionObserver
  if (IORef && sentinelEl.value && containerEl.value) {
    observer = new IORef(() => emit('loadMore'), { root: containerEl.value })
    observer.observe(sentinelEl.value)
  }
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  observer?.disconnect()
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
        >
          <slot name="item" :item="items[row.index]" :index="row.index" />
        </div>
        <div
          ref="sentinelEl"
          class="vscroll-sentinel"
          aria-hidden="true"
        ></div>
      </template>
      <slot v-else name="empty" />
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