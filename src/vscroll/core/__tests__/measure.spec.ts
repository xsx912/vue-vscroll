import { describe, expect, it } from 'vitest'
import {
  buildOffsets,
  clearMeasurements,
  measuredSizeAt,
  setMeasurement,
  totalSize,
  type Measurements,
} from '../measure'

describe('测量缓存（索引键）', () => {
  it('setMeasurement 写入后查询得到测量值', () => {
    const withRow = setMeasurement(new Map(), 1, 80)
    expect(measuredSizeAt(withRow, 40, 1)).toBe(80)
    expect(measuredSizeAt(withRow, 40, 2)).toBe(40)
  })

  it('setMeasurement 返回新缓存，原缓存不变（帧合并后一次性提交的前提）', () => {
    const original: Measurements = new Map()
    const updated = setMeasurement(original, 0, 120)
    expect(updated).not.toBe(original)
    expect(original.get(0)).toBeUndefined()
    expect(updated.get(0)).toBe(120)
  })

  it('clearMeasurements 返回空缓存', () => {
    const cleared = clearMeasurements()
    expect(cleared.size).toBe(0)
    expect(measuredSizeAt(cleared, 40, 0)).toBe(40)
  })
})

describe('measuredSizeAt', () => {
  const measurements: Measurements = new Map([
    [1, 80],
    [3, 120],
  ])

  it('returns the measured size for a measured row', () => {
    expect(measuredSizeAt(measurements, 40, 1)).toBe(80)
  })

  it('returns the estimate for an unmeasured row', () => {
    expect(measuredSizeAt(measurements, 40, 2)).toBe(40)
  })

  it('returns the estimate for any index when nothing is measured', () => {
    expect(measuredSizeAt(new Map(), 40, 0)).toBe(40)
    expect(measuredSizeAt(new Map(), 40, 99)).toBe(40)
  })
})

describe('buildOffsets', () => {
  it('accumulates sizes into offsets of length count + 1', () => {
    const sizeAt = (i: number) => [40, 80, 60][i]
    expect(buildOffsets(3, sizeAt)).toEqual([0, 40, 120, 180])
  })

  it('returns a single zero offset for an empty list', () => {
    expect(buildOffsets(0, () => 40)).toEqual([0])
  })
})

describe('totalSize', () => {
  it('returns the last offset', () => {
    expect(totalSize([0, 40, 120, 180])).toBe(180)
  })

  it('returns 0 for an empty offsets array', () => {
    expect(totalSize([])).toBe(0)
  })
})
