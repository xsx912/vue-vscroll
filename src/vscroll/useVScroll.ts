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

/** 跳转/对齐方式：目标行贴视口顶/居中/贴底 */
export type Align = 'start' | 'center' | 'end'

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
  /** 钉底（ADR-0004 opt-in）：变化前已在底部（含底容差）则贴新底 */
  stickToBottom?: Ref<boolean>
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
  scrollToIndex(index: number, align?: Align): void
  reset(): void
}

/** 组件消费的视图状态：可渲染窗口 + 总高度 */
export interface VScrollView {
  rows: VScrollRow[]
  totalSize: number
}

const EMPTY_MEASUREMENTS: Measurements = new Map()

/** 两阶段跳转的修正次数上界（CONTEXT.md：有界，不无限循环） */
const MAX_JUMP_CORRECTIONS = 2

/** 钉底的底容差（px）：距底不超过该值视为"在底部"，吸收行高小数与滚动取整 */
const BOTTOM_TOLERANCE = 4

/**
 * 最大滚动位置：总高 − 视口（不小于 0）。
 */
function maxScrollOf(offsets: readonly number[], viewport: number): number {
  return Math.max(0, offsets[offsets.length - 1] - viewport)
}

/**
 * 是否"在底部"：距底不超过底容差（吸收行高小数与滚动取整）。
 */
function isAtBottom(maxScroll: number, scrollTop: number): boolean {
  return maxScroll - scrollTop <= BOTTOM_TOLERANCE
}

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
   * 两阶段跳转（动态模式）：估算落点已应用，等待测量落地后的有界修正。
   * 固定/已知变高模式偏移确定，跳转一步到位，不登记。
   */
  let pendingJump: {
    index: number
    align: Align
    remaining: number
  } | null = null

  /**
   * 锚定：offsets 重新计算时（数据增删或测量落地），保持变化前第一个可见项的屏幕位置不变，
   * 用偏移量差修正 scrollTop；列表缩到锚点不存在时钳制到最大滚动位置。
   * 锚点行必须用旧 offsets 定位：新 offsets 下同一 scrollTop 命中的可能已是别的行。
   */
  watch(offsets, (newOffsets, oldOffsets) => {
    if (!oldOffsets || oldOffsets.length === 0) return
    // 跳转修正优先于锚定：要纹丝不动的是跳转目标行的落点，而非首个可见行。
    // 预算只被"真正移动落点的修正"消耗：目标行上/下方的无关测量落地不计数，
    // 否则分批提交的真实浏览器场景下预算会被空跑耗尽。
    if (pendingJump) {
      const target = getOffsetForIndex(pendingJump.index, pendingJump.align)
      if (target !== opts.scrollTop.value) {
        opts.scrollTop.value = target
        if (--pendingJump.remaining <= 0) pendingJump = null
      }
      return
    }
    // 钉底（ADR-0004）：变化前已在底部（含底容差）→ 贴新底。无状态判定——
    // 追加、测量落地、删减皆然；用户上滚离开底容差自然退出，滚回恢复。
    if (
      opts.stickToBottom?.value &&
      isAtBottom(maxScrollOf(oldOffsets, opts.viewportSize.value), opts.scrollTop.value)
    ) {
      opts.scrollTop.value = maxScrollOf(newOffsets, opts.viewportSize.value)
      return
    }
    const first = findStartIndex(oldOffsets, opts.scrollTop.value)
    if (first >= newOffsets.length - 1) {
      opts.scrollTop.value = Math.min(opts.scrollTop.value, maxScrollOf(newOffsets, opts.viewportSize.value))
      return
    }
    const delta = newOffsets[first] - (oldOffsets[first] ?? 0)
    if (delta !== 0) {
      const maxScroll = maxScrollOf(newOffsets, opts.viewportSize.value)
      opts.scrollTop.value = Math.min(Math.max(0, opts.scrollTop.value + delta), maxScroll)
    }
  })

  /**
   * 两阶段跳转第一阶段：登记跳转意图并返回估算落点（组件直接应用）。
   * 仅动态模式登记；固定/已知变高偏移确定，等价于 getOffsetForIndex 一步到位。
   * 钉底模式下落点已在底部（含底容差）时不登记：底部定位归钉底（无状态跟底），
   * 同时清掉旧的跳转意图——残留的 pendingJump 会在下次 offsets 变化时把视图拽走。
   */
  function beginJump(index: number, align: Align): number {
    const target = getOffsetForIndex(index, align)
    if (opts.itemSize == null) {
      if (
        opts.stickToBottom?.value &&
        isAtBottom(maxScrollOf(offsets.value, opts.viewportSize.value), target)
      ) {
        pendingJump = null
      } else {
        pendingJump = { index, align, remaining: MAX_JUMP_CORRECTIONS }
      }
    }
    return target
  }

  /** 放弃等待中的跳转修正（reset，或用户手动滚离目标位置） */
  function cancelJump() {
    pendingJump = null
  }

  /** 计算跳转到指定索引所需的滚动偏移（组件负责应用到容器） */
  function getOffsetForIndex(index: number, align: Align = 'start'): number {
    const n = opts.count.value
    if (n === 0) return 0
    const clamped = Math.min(Math.max(0, index), n - 1)
    const top = offsets.value[clamped] ?? 0
    const size = sizeAt(clamped)
    const viewport = opts.viewportSize.value
    const max = maxScrollOf(offsets.value, viewport)
    const target =
      align === 'start' ? top : align === 'center' ? top - (viewport - size) / 2 : top + size - viewport
    return Math.min(Math.max(0, target), max)
  }

  return { view, startIndex, getOffsetForIndex, sizeAt, beginJump, cancelJump }
}