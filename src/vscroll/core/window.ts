/**
 * 找到 scrollTop 落在哪个 item 上：返回最大的 i 使 offsets[i] <= scrollTop。
 * offsets[i] 是第 i 个 item 的起始像素位置（单调不减数组）。
 * 空列表返回 0；滚过末尾返回最后一个索引。
 */
export function findStartIndex(offsets: number[], scrollTop: number): number {
  if (offsets.length === 0) return 0
  let lo = 0
  let hi = offsets.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (offsets[mid] <= scrollTop) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }
  return lo
}

export interface VirtualWindow {
  /** 第一个渲染的索引（含 overscan 缓冲） */
  startIndex: number
  /** 最后一个渲染索引之后一位（不含） */
  endIndex: number
  /** 首渲染项上方的占位像素 */
  padBefore: number
  /** 末渲染项下方的占位像素 */
  padAfter: number
}

export interface ComputeWindowOptions {
  count: number
  /** 单个 item 在滚动方向上的尺寸（px） */
  itemSize: number
  /** 视口尺寸（px） */
  viewportSize: number
  /** 视口外上下各多渲染的行数 */
  overscan: number
  /** 当前滚动位置命中的起始索引（来自 findStartIndex） */
  startIndex: number
}

/**
 * 计算需要渲染的窗口：start/end 索引 + 上下占位 padding，
 * 占位 padding 撑起滚动条的假高度。
 */
export function computeWindow(opts: ComputeWindowOptions): VirtualWindow {
  const { count, itemSize, viewportSize, overscan, startIndex } = opts
  if (count <= 0 || itemSize <= 0) {
    return { startIndex: 0, endIndex: 0, padBefore: 0, padAfter: 0 }
  }
  const visible = Math.ceil(Math.max(0, viewportSize) / itemSize)
  const start = Math.max(0, startIndex - overscan)
  const end = Math.min(count, startIndex + visible + overscan)
  return {
    startIndex: start,
    endIndex: end,
    padBefore: start * itemSize,
    padAfter: (count - end) * itemSize,
  }
}

/** 整个列表在滚动方向上的总尺寸（px） */
export function getTotalSize(count: number, itemSize: number): number {
  return count * itemSize
}

/**
 * 找到目标像素位置由哪一行开始覆盖：返回最小的 e 使 offsets[e] >= target。
 * 用于非均匀行高时求窗口 end（窗口要覆盖到 scrollTop + viewportSize）。
 */
export function findEndIndex(offsets: readonly number[], target: number): number {
  let lo = 0
  let hi = offsets.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (offsets[mid] < target) {
      lo = mid + 1
    } else {
      hi = mid
    }
  }
  return lo
}

export interface ComputeWindowFromOffsetsOptions {
  /** offsets[i] = 第 i 个 item 的起始像素位置，length = count + 1（单调不减） */
  offsets: readonly number[]
  /** 视口尺寸（px） */
  viewportSize: number
  /** 视口外上下各多渲染的行数 */
  overscan: number
  /** 当前滚动位置命中的起始索引（来自 findStartIndex） */
  startIndex: number
}

/**
 * 非均匀行高（已知变高）的窗口计算：窗口 end 由偏移数组二分求出，
 * padBefore = 起始偏移，padAfter = 总高 − 末尾偏移。固定行高仍走 computeWindow 乘法捷径。
 */
export function computeWindowFromOffsets(opts: ComputeWindowFromOffsetsOptions): VirtualWindow {
  const { offsets, viewportSize, overscan, startIndex } = opts
  const count = offsets.length - 1
  if (count <= 0) {
    return { startIndex: 0, endIndex: 0, padBefore: 0, padAfter: 0 }
  }
  const start = Math.max(0, startIndex - overscan)
  const target = offsets[startIndex] + Math.max(0, viewportSize)
  const endVisible = findEndIndex(offsets, target)
  const end = Math.min(count, Math.max(start + 1, endVisible + overscan))
  return {
    startIndex: start,
    endIndex: end,
    padBefore: offsets[start],
    padAfter: offsets[count] - offsets[end],
  }
}