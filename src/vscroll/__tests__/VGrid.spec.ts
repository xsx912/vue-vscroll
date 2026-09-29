import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import VGrid from '../VGrid.vue'
import type { VGridExpose } from '../VGrid.vue'
import { IOStub, IOStubCtor } from './stubs'

const rows = Array.from({ length: 100 }, (_, i) => ({
  id: i,
  name: `名称 ${i}`,
  score: (i * 7) % 100,
}))
const COLUMNS = [140, 90, 70]

function mountGrid(overrides: Record<string, unknown> = {}) {
  const { slots, ...rest } = overrides
  return mount(VGrid, {
    props: { rows, columns: COLUMNS, rowSize: 50, height: 200, overscan: 2, ...rest },
    slots: {
      cell: `<span class="cell">{{ item.name }}·{{ column }}</span>`,
      header: `<div class="th">表头</div>`,
      ...((slots as Record<string, string> | undefined) ?? {}),
    },
  })
}

function vmGrid(wrapper: VueWrapper) {
  return wrapper.vm as unknown as VGridExpose
}

const scrollOf = (wrapper: VueWrapper) =>
  (wrapper.find('.vgrid').element as HTMLElement).scrollTop

describe('VGrid · 虚拟表格', () => {
  it('renders the row window × columns (fixed row height)', () => {
    const wrapper = mountGrid()
    // 200/50 = 4 可见行 + 2 行缓冲 = 6 行 × 3 列
    expect(wrapper.findAll('.vgrid-row')).toHaveLength(6)
    expect(wrapper.findAll('.cell')).toHaveLength(18)
    expect(wrapper.find('.vgrid-inner').attributes('style')).toContain('height: 5000px')
    expect(wrapper.find('.cell').text()).toBe('名称 0·0')
  })

  it('renders the sticky header outside the virtual inner area', () => {
    const wrapper = mountGrid()
    const header = wrapper.find('.vgrid-header')
    expect(header.exists()).toBe(true)
    expect(header.find('.th').exists()).toBe(true)
    const inner = wrapper.find('.vgrid-inner').element as HTMLElement
    expect(inner.contains(header.element as Node)).toBe(false)
  })

  it('sizes cells by the declared column widths', () => {
    const wrapper = mountGrid()
    const widths = wrapper.findAll('.vgrid-row')[0].findAll('.vgrid-cell').map((c) =>
      c.attributes('style'),
    )
    expect(widths[0]).toContain('width: 140px')
    expect(widths[1]).toContain('width: 90px')
    expect(widths[2]).toContain('width: 70px')
  })

  it('virtualizes on scroll and keeps the cell slot scope correct', async () => {
    const wrapper = mountGrid()
    vmGrid(wrapper).scrollToRow(50)
    await nextTick()
    expect(scrollOf(wrapper)).toBe(2500)
    const firstRow = wrapper.findAll('.vgrid-row')[0]
    expect(firstRow.attributes('style')).toContain('top: 2400px') // 50 行 − 2 缓冲
    expect(firstRow.findAll('.cell')[0].text()).toBe('名称 48·0')
    expect(firstRow.findAll('.cell')[2].text()).toBe('名称 48·2')
  })

  it('emits loadMore when the sentinel intersects (filtered first callback)', async () => {
    const wrapper = mountGrid({ intersectionObserver: IOStubCtor })
    expect(wrapper.emitted('loadMore')).toBeUndefined() // 首次 isIntersecting:false 不触发
    IOStub.instance!.callback(
      [{ isIntersecting: false } as unknown as IntersectionObserverEntry],
      IOStub.instance as unknown as IntersectionObserver,
    )
    expect(wrapper.emitted('loadMore')).toBeUndefined()
    IOStub.instance!.callback(
      [{ isIntersecting: true } as unknown as IntersectionObserverEntry],
      IOStub.instance as unknown as IntersectionObserver,
    )
    expect(wrapper.emitted('loadMore')).toHaveLength(1)
  })

  it('shows the empty slot when there are no rows', () => {
    const wrapper = mountGrid({ rows: [], slots: { empty: '<div class="empty">无数据</div>' } })
    expect(wrapper.find('.empty').text()).toBe('无数据')
    expect(wrapper.findAll('.vgrid-row')).toHaveLength(0)
  })

  it('anchors prepended rows via the reference probe (block = n × rowSize)', async () => {
    const wrapper = mountGrid()
    vmGrid(wrapper).scrollToRow(50)
    await nextTick()
    const prepended = [
      ...Array.from({ length: 10 }, (_, i) => ({ id: -1 - i, name: `更早 ${i}`, score: 0 })),
      ...rows,
    ]
    await wrapper.setProps({ rows: prepended })
    await nextTick()
    expect(scrollOf(wrapper)).toBe(3000) // 2500 + 10×50
    expect(wrapper.findAll('.vgrid-row')[0].findAll('.cell')[0].text()).toBe('名称 48·0')
  })

  it('reset() returns to the top', async () => {
    const wrapper = mountGrid()
    vmGrid(wrapper).scrollToRow(50)
    await nextTick()
    vmGrid(wrapper).reset()
    await nextTick()
    expect(scrollOf(wrapper)).toBe(0)
    expect(wrapper.find('.cell').text()).toBe('名称 0·0')
  })
})
