import { mount } from '@vue/test-utils'
import { createSSRApp, h } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { describe, expect, it, vi } from 'vitest'
import VScroll from '../VScroll.vue'
import VGrid from '../VGrid.vue'

const items = Array.from({ length: 100 }, (_, i) => ({ id: i, label: `item-${i}` }))
const rows = Array.from({ length: 100 }, (_, i) => ({ id: i, name: `名称 ${i}` }))

describe('SSR 与无障碍', () => {
  it('SSR with height renders the initial window server-side (meaningful first paint)', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(VScroll as never, { items, itemSize: 50, height: 200, overscan: 2 }, {
            item: ({ index }: { index: number }) => h('div', `row-${index}`),
          } as never),
      }),
    )
    expect(html).toContain('vscroll-inner')
    expect(html).toContain('height:5000px') // 占位撑起总高（SSR 样式序列化无空格）
    expect(html).toContain('row-0') // 首窗口在服务端渲染
  })

  it('hydrates over SSR markup without mismatch warnings', async () => {
    const html = await renderToString(
      createSSRApp({
        render: () =>
          h(VScroll as never, { items, itemSize: 50, height: 200, overscan: 2 }, {
            item: ({ index }: { index: number }) => h('div', { class: 'h-row' }, `row-${index}`),
          } as never),
      }),
    )
    const el = document.createElement('div')
    el.innerHTML = html
    document.body.appendChild(el)

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const app = createSSRApp({
        render: () =>
          h(VScroll as never, { items, itemSize: 50, height: 200, overscan: 2 }, {
            item: ({ index }: { index: number }) => h('div', { class: 'h-row' }, `row-${index}`),
          } as never),
      })
      app.mount(el)
      expect(el.querySelectorAll('.h-row').length).toBeGreaterThan(0)
      const mismatch = warn.mock.calls.some((c) =>
        String(c[0]).includes('Hydration') || String(c[0]).includes('hydration'),
      )
      expect(mismatch).toBe(false)
    } finally {
      warn.mockRestore()
      el.remove()
    }
  })

  it('scroll containers are keyboard-focusable (native arrow/space scrolling)', () => {
    const list = mount(VScroll, {
      props: { items, itemSize: 50, height: 200 },
      slots: { item: '<div class="row"/>' },
    })
    expect(list.find('.vscroll').attributes('tabindex')).toBe('0')

    const grid = mount(VGrid, {
      props: { rows, columns: [100, 80], rowSize: 40, height: 200 },
      slots: { cell: '<span/>' },
    })
    expect(grid.find('.vgrid').attributes('tabindex')).toBe('0')
  })

  it('VGrid carries table semantics (grid/row/gridcell + aria-rowcount incl. header)', () => {
    const grid = mount(VGrid, {
      props: { rows, columns: [100, 80], rowSize: 40, height: 200, overscan: 1 },
      slots: {
        cell: '<span class="c"/>',
        header: '<div class="th-a">A</div><div class="th-b">B</div>',
      },
    })
    const container = grid.find('.vgrid')
    expect(container.attributes('role')).toBe('grid')
    expect(container.attributes('aria-rowcount')).toBe('101') // 100 数据行 + 1 表头行
    expect(grid.find('.vgrid-header').attributes('role')).toBe('row')
    const row = grid.find('.vgrid-row')
    expect(row.attributes('role')).toBe('row')
    expect(row.attributes('aria-rowindex')).toBe('2') // APG 1-based：表头是第 1 行
    expect(row.findAll('.vgrid-cell')[0].attributes('role')).toBe('gridcell')
  })

  it('VScroll stays role-neutral (consumers pass role via attrs)', () => {
    const list = mount(VScroll, {
      props: { items, itemSize: 50, height: 200 },
      attrs: { role: 'list', 'aria-label': '消息列表' },
      slots: { item: '<div class="row"/>' },
    })
    expect(list.find('.vscroll').attributes('role')).toBe('list')
    expect(list.find('.vscroll').attributes('aria-label')).toBe('消息列表')
  })
})
