import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import VScroll from '../VScroll.vue'

const items = Array.from({ length: 100 }, (_, i) => ({ id: i, label: `item-${i}` }))
const items200 = Array.from({ length: 200 }, (_, i) => ({ id: i, label: `item-${i}` }))

/** 可控的 IntersectionObserver 桩：捕获回调，由测试手动触发 */
class IOStub {
  static instance: IOStub | null = null
  callback: IntersectionObserverCallback
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    IOStub.instance = this
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}

const IOStubCtor = IOStub as unknown as typeof IntersectionObserver

function vmScroll(wrapper: ReturnType<typeof mountVScroll>) {
  return wrapper.vm as unknown as {
    scrollToIndex: (index: number, align?: 'start' | 'center' | 'end') => void
    reset: () => void
  }
}

function mountVScroll(
  overrides: { props?: Record<string, unknown>; slots?: Record<string, string> } = {},
) {
  return mount(VScroll, {
    props: { items, itemSize: 50, height: 200, overscan: 2, ...(overrides.props ?? {}) },
    slots: { item: `<div class="row">{{ item.label }}</div>`, ...(overrides.slots ?? {}) },
  })
}

describe('VScroll', () => {
  it('renders only the visible window plus overscan rows at the top', () => {
    const wrapper = mountVScroll()
    const rows = wrapper.findAll('.row')
    expect(rows).toHaveLength(6) // 4 visible (200/50) + 2 overscan
    expect(rows[0].text()).toBe('item-0')
    expect(rows[5].text()).toBe('item-5')
  })

  it('applies the fixed height to the scroll container', () => {
    const wrapper = mountVScroll()
    expect(wrapper.find('.vscroll').attributes('style')).toContain('height: 200px')
  })

  it('spans the inner placeholder to the total list height', () => {
    const wrapper = mountVScroll()
    const inner = wrapper.find('.vscroll-inner')
    expect(inner.attributes('style')).toContain('height: 5000px') // 100 * 50
  })

  it('shifts the window down when scrolled', async () => {
    const wrapper = mountVScroll()
    const container = wrapper.find('.vscroll')
    ;(container.element as HTMLElement).scrollTop = 250
    await container.trigger('scroll')
    const rows = wrapper.findAll('.row')
    expect(rows[0].text()).toBe('item-3') // startIndex=5, overscan 2 → 窗口 3..11
    expect(rows).toHaveLength(8)
  })

  it('clamps the window at the end of the list', async () => {
    const wrapper = mountVScroll()
    const container = wrapper.find('.vscroll')
    ;(container.element as HTMLElement).scrollTop = 4950
    await container.trigger('scroll')
    const rows = wrapper.findAll('.row')
    expect(rows[0].text()).toBe('item-97')
    expect(rows[rows.length - 1].text()).toBe('item-99')
    expect(rows).toHaveLength(3)
  })

  it('scrollToIndex jumps to the row with start alignment', async () => {
    const wrapper = mountVScroll()
    vmScroll(wrapper).scrollToIndex(50)
    await nextTick()
    const container = wrapper.find('.vscroll').element as HTMLElement
    expect(container.scrollTop).toBe(2500) // 50 * 50
    const rows = wrapper.findAll('.row')
    expect(rows[0].text()).toBe('item-48')
  })

  it('scrollToIndex supports center and end alignment', () => {
    const wrapper = mountVScroll()
    const scroll = () => (wrapper.find('.vscroll').element as HTMLElement).scrollTop
    vmScroll(wrapper).scrollToIndex(50, 'center')
    expect(scroll()).toBe(2425) // 2500 - (200-50)/2
    vmScroll(wrapper).scrollToIndex(50, 'end')
    expect(scroll()).toBe(2350) // 2500 + 50 - 200
  })

  it('scrollToIndex clamps beyond the list end', () => {
    const wrapper = mountVScroll()
    vmScroll(wrapper).scrollToIndex(9999)
    expect((wrapper.find('.vscroll').element as HTMLElement).scrollTop).toBe(4800)
  })

  it('emits loadMore when the sentinel enters the viewport', async () => {
    const wrapper = mountVScroll({ props: { intersectionObserver: IOStubCtor } })
    const container = wrapper.find('.vscroll')
    ;(container.element as HTMLElement).scrollTop = 4950
    await container.trigger('scroll')
    IOStub.instance?.callback([], null as unknown as IntersectionObserver)
    await nextTick()
    expect(wrapper.emitted('loadMore')?.length).toBe(1)
  })

  it('does not emit loadMore before the sentinel is reached', async () => {
    const wrapper = mountVScroll({ props: { intersectionObserver: IOStubCtor } })
    const container = wrapper.find('.vscroll')
    ;(container.element as HTMLElement).scrollTop = 250
    await container.trigger('scroll')
    expect(wrapper.emitted('loadMore')).toBeUndefined()
  })

  it('keeps the scroll position when items are appended', async () => {
    const wrapper = mountVScroll()
    const container = wrapper.find('.vscroll')
    ;(container.element as HTMLElement).scrollTop = 2500
    await container.trigger('scroll')
    await wrapper.setProps({ items: items200 })
    expect((container.element as HTMLElement).scrollTop).toBe(2500)
    expect(wrapper.findAll('.row')[0].text()).toBe('item-48')
  })

  it('clamps back to the top when the list shrinks past the anchor', async () => {
    const wrapper = mountVScroll()
    const container = wrapper.find('.vscroll')
    ;(container.element as HTMLElement).scrollTop = 2500
    await container.trigger('scroll')
    await wrapper.setProps({ items: items.slice(0, 3) })
    expect((container.element as HTMLElement).scrollTop).toBe(0)
    expect(wrapper.findAll('.row')[0].text()).toBe('item-0')
  })

  it('renders the header and footer slots around the scroll area', () => {
    const wrapper = mountVScroll({
      slots: {
        header: `<div class="head">header</div>`,
        footer: `<div class="foot">footer</div>`,
      },
    })
    expect(wrapper.find('.head').text()).toBe('header')
    expect(wrapper.find('.foot').text()).toBe('footer')
  })

  it('renders the loading slot while loading is true', () => {
    const wrapper = mountVScroll({
      props: { loading: true },
      slots: { loading: `<div class="loading">loading</div>` },
    })
    expect(wrapper.find('.loading').text()).toBe('loading')
  })

  it('does not render the loading slot when loading is false', () => {
    const wrapper = mountVScroll({ slots: { loading: `<div class="loading">loading</div>` } })
    expect(wrapper.find('.loading').exists()).toBe(false)
  })

  it('renders the empty slot when there are no items', () => {
    const wrapper = mountVScroll({
      props: { items: [] },
      slots: { empty: `<div class="empty">empty</div>` },
    })
    expect(wrapper.find('.empty').text()).toBe('empty')
  })

  it('reset() returns to the top', async () => {
    const wrapper = mountVScroll()
    vmScroll(wrapper).scrollToIndex(50)
    await nextTick()
    vmScroll(wrapper).reset()
    await nextTick()
    expect((wrapper.find('.vscroll').element as HTMLElement).scrollTop).toBe(0)
    expect(wrapper.findAll('.row')[0].text()).toBe('item-0')
  })
})