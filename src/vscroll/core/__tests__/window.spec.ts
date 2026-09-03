import { describe, expect, it } from 'vitest'
import { computeWindow, findStartIndex } from '../window'

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