import { describe, expect, it } from 'vitest'
import { computeWindow, computeWindowFromOffsets, findEndIndex, findStartIndex } from '../window'

describe('findStartIndex', () => {
  // offsets[i] = 第 i 个 item 的起始像素位置
  const offsets = [0, 50, 100, 150, 200]

  it('returns 0 at the very top', () => {
    expect(findStartIndex(offsets, 0)).toBe(0)
  })

  it('returns the item starting at an exact boundary', () => {
    expect(findStartIndex(offsets, 50)).toBe(1)
    expect(findStartIndex(offsets, 150)).toBe(3)
  })

  it('returns the item containing a mid-item scroll position', () => {
    expect(findStartIndex(offsets, 120)).toBe(2)
  })

  it('clamps to the last item when scrolling past the end', () => {
    expect(findStartIndex(offsets, 250)).toBe(4)
  })

  it('returns 0 for an empty list', () => {
    expect(findStartIndex([], 0)).toBe(0)
  })
})

describe('computeWindow', () => {
  const opts = {
    count: 10,
    itemSize: 50,
    viewportSize: 200,
    overscan: 2,
  }

  it('renders visible + overscan rows with padding at the top', () => {
    expect(computeWindow({ ...opts, startIndex: 0 })).toEqual({
      startIndex: 0,
      endIndex: 6,
      padBefore: 0,
      padAfter: 200,
    })
  })

  it('expands the window above the start when scrolled deep', () => {
    expect(computeWindow({ ...opts, startIndex: 5 })).toEqual({
      startIndex: 3,
      endIndex: 10,
      padBefore: 150,
      padAfter: 0,
    })
  })

  it('clamps the window to the list bounds at the end', () => {
    expect(computeWindow({ ...opts, startIndex: 9 })).toEqual({
      startIndex: 7,
      endIndex: 10,
      padBefore: 350,
      padAfter: 0,
    })
  })

  it('returns an empty window for an empty list', () => {
    expect(computeWindow({ ...opts, count: 0, startIndex: 0 })).toEqual({
      startIndex: 0,
      endIndex: 0,
      padBefore: 0,
      padAfter: 0,
    })
  })

  it('treats a viewport smaller than one item as one visible row', () => {
    expect(computeWindow({ ...opts, viewportSize: 50, startIndex: 0 })).toEqual({
      startIndex: 0,
      endIndex: 3,
      padBefore: 0,
      padAfter: 350,
    })
  })

  it('shrinks the window when overscan exceeds the list', () => {
    expect(computeWindow({ ...opts, count: 3, overscan: 5, startIndex: 1 })).toEqual({
      startIndex: 0,
      endIndex: 3,
      padBefore: 0,
      padAfter: 0,
    })
  })
})

// 已知变高模式：offsets 由函数行高累计而来
// heights = [30, 50, 70, 90, 30, 50, 70, 90, 30, 50]
const varOffsets = [0, 30, 80, 150, 240, 270, 320, 390, 480, 510, 560]

describe('findEndIndex', () => {
  it('returns the first item whose start is at or past the target', () => {
    expect(findEndIndex(varOffsets, 200)).toBe(4)
  })

  it('returns the item at an exact boundary target', () => {
    expect(findEndIndex(varOffsets, 150)).toBe(3)
  })

  it('returns the total offset index when the target is past the end', () => {
    expect(findEndIndex(varOffsets, 560)).toBe(10)
    expect(findEndIndex(varOffsets, 999)).toBe(10)
  })
})

describe('computeWindowFromOffsets', () => {
  it('renders visible rows plus overscan from the top', () => {
    expect(
      computeWindowFromOffsets({ offsets: varOffsets, viewportSize: 200, overscan: 2, startIndex: 0 }),
    ).toEqual({ startIndex: 0, endIndex: 6, padBefore: 0, padAfter: 240 })
  })

  it('shifts the window with variable padBefore when scrolled', () => {
    // scrollTop=200 → startIndex=3；窗口应覆盖 200..400 再加 2 行缓冲
    expect(
      computeWindowFromOffsets({ offsets: varOffsets, viewportSize: 200, overscan: 2, startIndex: 3 }),
    ).toEqual({ startIndex: 1, endIndex: 9, padBefore: 30, padAfter: 50 })
  })

  it('clamps to the list bounds near the end', () => {
    expect(
      computeWindowFromOffsets({ offsets: varOffsets, viewportSize: 200, overscan: 2, startIndex: 8 }),
    ).toEqual({ startIndex: 6, endIndex: 10, padBefore: 320, padAfter: 0 })
  })

  it('renders a single-row list in full even when the viewport exceeds it', () => {
    expect(
      computeWindowFromOffsets({ offsets: [0, 80], viewportSize: 200, overscan: 2, startIndex: 0 }),
    ).toEqual({ startIndex: 0, endIndex: 1, padBefore: 0, padAfter: 0 })
  })

  it('renders the whole list when the viewport exceeds the total size', () => {
    expect(
      computeWindowFromOffsets({ offsets: [0, 30, 60, 100], viewportSize: 500, overscan: 2, startIndex: 0 }),
    ).toEqual({ startIndex: 0, endIndex: 3, padBefore: 0, padAfter: 0 })
  })

  it('returns an empty window for an empty list', () => {
    expect(
      computeWindowFromOffsets({ offsets: [], viewportSize: 200, overscan: 2, startIndex: 0 }),
    ).toEqual({ startIndex: 0, endIndex: 0, padBefore: 0, padAfter: 0 })
  })

  it('covers the viewport when scrollTop sits mid-item', () => {
    // scrollTop=50 → startIndex=1；视口 50..150 需要行 1(40..90) 与行 2(90..150)
    expect(
      computeWindowFromOffsets({ offsets: [0, 40, 90, 150], viewportSize: 100, overscan: 1, startIndex: 1 }),
    ).toEqual({ startIndex: 0, endIndex: 3, padBefore: 0, padAfter: 0 })
  })
})