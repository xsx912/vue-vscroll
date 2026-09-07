import { computed, type Ref, watch } from 'vue'
import {
  buildOffsets,
  DEFAULT_ESTIMATED_ITEM_SIZE,
  measuredSizeAt,
  totalSize,
  type Measurements,
} from './core/measure'
import { computeWindow, computeWindowFromOffsets, findStartIndex } from './core/window'

export type ItemSize = number | ((index: number) => number)

export interface UseVScrollOptions {
  /** 列表条目总数（响应式） */
  count: Ref<number>
  /**
   * 行高来源：数字 = 固定行高（既有乘法捷径），函数 = 已知变高，
   * 缺省 = 动态高度（先按估算渲染，测量后接管）
   */
  itemSize?: ItemSize
  /** 动态模式下未测行的估算高度（px，默认 40） */
  estimatedItemSize?: number
  /** 动态模式的测量缓存（索引键 → 真实行高）；由组件持有，reset() 清空 */
  measurements?: Ref<Measurements>
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

/** VScroll 组件通过 ref 暴露的实例方法（对外类型契约） */
export interface VScrollExpose {
  scrollToIndex(index: number, align?: 'start' | 'center' | 'end'): void
  reset(): void
}

/** 组件消费的视图状态：可渲染窗口 + 总高度 */
export interface VScrollView {
  rows: VScrollRow[]
  totalSize: number
}

const EMPTY_MEASUREMENTS: Measurements = new Map()

/**
 * 虚拟滚动的核心状态机（不触碰 DOM，便于测试与 v2 复用）：
 * 由 scrollTop 推导渲染窗口；数据变化时锚定第一个可见项的位置。
 */
export function useVScroll(opts: UseVScrollOptions) {
  const sizeAt = (index: number): number => {
    const size = opts.itemSize
    if (typeof size === 'number') return size
    if (typeof size === 'function') return size(index)
    // 动态高度：已测值取代估算值
    return measuredSizeAt(
      opts.measurements?.value ?? EMPTY_MEASUREMENTS,
      opts.estimatedItemSize ?? DEFAULT_ESTIMATED_ITEM_SIZE,
      index,
    )
  }

  // offsets[i] = 第 i 个 item 的起始像素位置；length = count + 1
  const offsets = computed<number[]>(() => buildOffsets(opts.count.value, sizeAt))

  const startIndex = computed(() => findStartIndex(offsets.value, opts.scrollTop.value))

  const view = computed<VScrollView>(() => {
    const win =
      typeof opts.itemSize === 'number'
        ? // 固定行高保留乘法捷径（v1 路径零改动）
          computeWindow({
            count: opts.count.value,
            itemSize: sizeAt(startIndex.value),
            viewportSize: opts.viewportSize.value,
            overscan: opts.overscan.value,
            startIndex: startIndex.value,
          })
        : // 已知变高：窗口由偏移数组二分求出
          computeWindowFromOffsets({
            offsets: offsets.value,
            viewportSize: opts.viewportSize.value,
            overscan: opts.overscan.value,
            startIndex: startIndex.value,
          })
    const rows: VScrollRow[] = []
    for (let i = win.startIndex; i < win.endIndex; i++) {
      rows.push({ index: i, top: offsets.value[i], size: sizeAt(i) })
    }
    return { rows, totalSize: totalSize(offsets.value) }
  })

  /**
   * 锚定：offsets 重新计算时（数据增删或测量落地），保持当前第一个可见项的屏幕位置不变，
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