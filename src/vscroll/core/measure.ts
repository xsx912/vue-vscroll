/**
 * 测量核心：动态高度模式的纯函数层（不触 DOM，spec 决策 4 的唯一新 seam）。
 * 术语见 CONTEXT.md：测量（索引键/身份键归属）、估算高度、偏移、总高。
 */

/** 动态模式未测行的估算高度缺省值（px） */
export const DEFAULT_ESTIMATED_ITEM_SIZE = 40

/** 测量缓存的键：索引键（默认，ADR-0003）或身份键（getItemKey，ADR-0005） */
export type MeasureKey = number | string

/** 测量缓存：键 → 已测行高。跨 items 变更保留（ADR-0003），清空 = 替换为新缓存 */
export type Measurements = ReadonlyMap<MeasureKey, number>

/** 写入一条测量：返回新缓存（原缓存不变，便于按帧合并后一次性提交） */
export function setMeasurement(
  measurements: Measurements,
  key: MeasureKey,
  size: number,
): Measurements {
  const next = new Map(measurements)
  next.set(key, size)
  return next
}

/** 批量写入测量（一帧合并后一次提交）：返回新缓存，offsets 至多重建一次 */
export function setMeasurements(
  measurements: Measurements,
  entries: Iterable<[MeasureKey, number]>,
): Measurements {
  const next = new Map(measurements)
  for (const [key, size] of entries) {
    next.set(key, size)
  }
  return next
}

/** 空测量缓存（reset() 清空测量，ADR-0003） */
export function clearMeasurements(): Measurements {
  return new Map()
}

/**
 * 高度查询：已测行返回测量值，未测行返回估算高度。
 */
export function measuredSizeAt(
  measurements: Measurements,
  estimatedItemSize: number,
  key: MeasureKey,
): number {
  return measurements.get(key) ?? estimatedItemSize
}

/**
 * 偏移重建：offsets[i] = 第 i 行的起始像素位置，length = count + 1。
 */
export function buildOffsets(count: number, sizeAt: (index: number) => number): number[] {
  const offsets = new Array<number>(count + 1)
  offsets[0] = 0
  for (let i = 0; i < count; i++) {
    offsets[i + 1] = offsets[i] + sizeAt(i)
  }
  return offsets
}

/** 总高：最后一行末尾的像素位置（空 offsets 为 0） */
export function totalSize(offsets: readonly number[]): number {
  return offsets.length > 0 ? offsets[offsets.length - 1] : 0
}
