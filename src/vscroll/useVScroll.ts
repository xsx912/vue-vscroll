import { computed, type Ref, watch } from 'vue'
import { computeWindow, findStartIndex } from './core/window'

export type ItemSize = number | ((index: number) => number)

export interface UseVScrollOptions {
  /** 列表条目总数（响应式） */
  count: Ref<number>
  /** 固定尺寸或按索引取尺寸；函数形式为 v2 动态高度预留 */
  itemSize: ItemSize
  /** 视口外缓冲行数 */
  overscan: Ref<number>
  /** 滚动偏移（px），由滚动容器喂入 */
  scrollTop: Ref<number>
  /** 滚动方向上的视口尺寸（px） */
  viewportSize: Ref<number>
}

export interface VScrollRow {
  index: number
  top: number
  size: number
}

/** 组件消费的视图状态：可渲染窗口 + 总高度 */
export interface VScrollView {
  rows: VScrollRow[]
  totalSize: number
}

/**
 * 虚拟滚动的核心状态机（不触碰 DOM，便于测试与 v2 复用）：
 * 由 scrollTop 推导渲染窗口；数据变化时锚定第一个可见项的位置。
 */
export function useVScroll(opts: UseVScrollOptions) {
  const sizeAt = (index: number): number =>
    typeof opts.itemSize === 'function' ? opts.itemSize(index) : opts.itemSize

  // offsets[i] = 第 i 个 item 的起始像素位置；length = count + 1
  const offsets = computed<number[]>(() => {
    const n = opts.count.value
    const arr = new Array<number>(n + 1)
    arr[0] = 0
    for (let i = 0; i < n; i++) arr[i + 1] = arr[i] + sizeAt(i)
    return arr
  })

  const startIndex = computed(() => findStartIndex(offsets.value, opts.scrollTop.value))

  const view = computed<VScrollView>(() => {
    const win = computeWindow({
      count: opts.count.value,
      itemSize: sizeAt(startIndex.value),
      viewportSize: opts.viewportSize.value,
      overscan: opts.overscan.value,
      startIndex: startIndex.value,
    })
    const rows: VScrollRow[] = []
    for (let i = win.startIndex; i < win.endIndex; i++) {
      rows.push({ index: i, top: offsets.value[i], size: sizeAt(i) })
    }
    return { rows, totalSize: offsets.value[opts.count.value] ?? 0 }
  })

  /**
   * 锚定：offsets 重新计算时（数据增删），保持当前第一个可见项的屏幕位置不变，
   * 用偏移量差修正 scrollTop；列表缩到锚点不存在时钳制到最大滚动位置。
   */
  watch(offsets, (newOffsets, oldOffsets) => {
    if (!oldOffsets || oldOffsets.length === 0) return
    const first = startIndex.value
    if (first >= newOffsets.length - 1) {
      const maxScroll = Math.max(0, newOffsets[newOffsets.length - 1] - opts.viewportSize.value)
      opts.scrollTop.value = Math.min(opts.scrollTop.value, maxScroll)
      return
    }
    const delta = newOffsets[first] - (oldOffsets[first] ?? 0)
    if (delta !== 0) {
      const maxScroll = Math.max(0, newOffsets[newOffsets.length - 1] - opts.viewportSize.value)
      opts.scrollTop.value = Math.min(Math.max(0, opts.scrollTop.value + delta), maxScroll)
    }
  })

  /** 计算跳转到指定索引所需的滚动偏移（组件负责应用到容器） */
  function getOffsetForIndex(index: number, align: 'start' | 'center' | 'end' = 'start'): number {
    const n = opts.count.value
    if (n === 0) return 0
    const clamped = Math.min(Math.max(0, index), n - 1)
    const top = offsets.value[clamped] ?? 0
    const size = sizeAt(clamped)
    const viewport = opts.viewportSize.value
    const max = Math.max(0, (offsets.value[n] ?? 0) - viewport)
    const target =
      align === 'start' ? top : align === 'center' ? top - (viewport - size) / 2 : top + size - viewport
    return Math.min(Math.max(0, target), max)
  }

  return { view, startIndex, getOffsetForIndex, sizeAt }
}