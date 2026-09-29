import { mount, type VueWrapper } from '@vue/test-utils'
import { createSSRApp, nextTick, type Component } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

function vmScroll(wrapper: VueWrapper) {
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

/** 可控的 ResizeObserver 桩：捕获 callback，记录观察目标，由测试手动触发 */
class ROStub {
  static instance: ROStub | null = null
  callback: ResizeObserverCallback
  observed: Element[] = []
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback
    ROStub.instance = this
  }
  observe(el: Element) {
    this.observed.push(el)
  }
  unobserve(el: Element) {
    this.observed = this.observed.filter((e) => e !== el)
  }
  disconnect() {
    this.observed = []
  }
}

const ROStubCtor = ROStub as unknown as typeof ResizeObserver

function rowElFor(index: number): Element {
  const el = ROStub.instance!.observed.find(
    (e) => e.querySelector('.row')?.textContent === `item-${index}`,
  )
  expect(el, `row ${index} should be observed`).toBeTruthy()
  return el!
}

function fireResize(index: number, height: number) {
  ROStub.instance!.callback(
    [{ target: rowElFor(index), contentRect: { height } } as unknown as ResizeObserverEntry],
    ROStub.instance as unknown as ResizeObserver,
  )
}

/** 用 rAF 桩替换全局 rAF，测试手动推进帧 */
function stubRaf() {
  const callbacks: FrameRequestCallback[] = []
  const cancelSpy = vi.fn()
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    callbacks.push(cb)
    return callbacks.length
  })
  vi.stubGlobal('cancelAnimationFrame', cancelSpy)
  return {
    flush: () => callbacks.splice(0).forEach((cb) => cb(0)),
    cancelSpy,
  }
}

/** 动态模式标准挂载：估算 40px + RO 桩 */
function mountDynamicRO() {
  return mount(VScroll, {
    props: { items, height: 200, overscan: 2, resizeObserver: ROStubCtor },
    slots: { item: `<div class="row">{{ item.label }}</div>` },
  })
}

const scrollOf = (wrapper: VueWrapper) =>
  (wrapper.find('.vscroll').element as HTMLElement).scrollTop
const innerHeight = (wrapper: VueWrapper) =>
  wrapper.find('.vscroll-inner').attributes('style') ?? ''

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
    IOStub.instance?.callback(
      [{ isIntersecting: true }] as unknown as IntersectionObserverEntry[],
      null as unknown as IntersectionObserver,
    )
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

  it('ignores non-intersecting observer entries (initial callback)', async () => {
    const wrapper = mountVScroll({ props: { intersectionObserver: IOStubCtor } })
    // 真实 IntersectionObserver observe 后会立即异步回调一次初始 entry；
    // 哨兵不在视口时应传 isIntersecting:false，组件必须忽略它
    IOStub.instance?.callback(
      [{ isIntersecting: false }] as unknown as IntersectionObserverEntry[],
      null as unknown as IntersectionObserver,
    )
    await nextTick()
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

  it('virtualizes against the measured container height without a height prop', async () => {
    const orig = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight')
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 400,
    })
    try {
      const wrapper = mountVScroll({ props: { height: undefined } })
      await nextTick()
      const rows = wrapper.findAll('.row')
      expect(rows).toHaveLength(10) // 400/50 = 8 可见 + 2 overscan（mountVScroll 默认）
      expect(rows[0].text()).toBe('item-0')
    } finally {
      if (orig) Object.defineProperty(HTMLElement.prototype, 'clientHeight', orig)
    }
  })

  it('keeps the sentinel rendered when the list is empty (loadMore can refill)', () => {
    const wrapper = mountVScroll({
      props: { items: [], intersectionObserver: IOStubCtor },
      slots: { empty: `<div class="empty">empty</div>` },
    })
    expect(wrapper.find('.vscroll-sentinel').exists()).toBe(true)
  })
})

describe('VScroll · 已知变高（itemSize 传函数）', () => {
  // 行高由函数给出：30 + (i % 4) * 20 → [30,50,70,90,…]
  // 累计偏移 offsets = [0,30,80,150,240,270,320,390,480,510,560]，总高 560
  const varItems = Array.from({ length: 10 }, (_, i) => ({ id: i, label: `item-${i}` }))
  const sizeAt = (i: number) => 30 + (i % 4) * 20

  function mountVar(
    overrides: { props?: Record<string, unknown>; slots?: Record<string, string> } = {},
  ) {
    return mount(VScroll, {
      props: { items: varItems, itemSize: sizeAt, height: 200, overscan: 2, ...(overrides.props ?? {}) },
      slots: { item: `<div class="row">{{ item.label }}</div>`, ...(overrides.slots ?? {}) },
    })
  }

  it('renders the non-uniform window with per-row tops and the summed total size', () => {
    const wrapper = mountVar()
    const rows = wrapper.findAll('.row')
    expect(rows).toHaveLength(6) // 200 视口覆盖行 0..3，加 2 行缓冲
    expect(rows[0].text()).toBe('item-0')
    expect(rows[5].text()).toBe('item-5')
    expect(wrapper.find('.vscroll-inner').attributes('style')).toContain('height: 560px')
    const style = (n: number) => wrapper.findAll('.vscroll-item')[n].attributes('style')
    expect(style(2)).toContain('top: 80px')
    expect(style(2)).toContain('height: 70px')
  })

  it('shifts the window by accumulated offsets when scrolled', async () => {
    const wrapper = mountVar()
    const container = wrapper.find('.vscroll')
    ;(container.element as HTMLElement).scrollTop = 200
    await container.trigger('scroll')
    const rows = wrapper.findAll('.row')
    expect(rows).toHaveLength(8) // startIndex=3 → 窗口 1..8
    expect(rows[0].text()).toBe('item-1')
    expect(rows[7].text()).toBe('item-8')
    expect(wrapper.findAll('.vscroll-item')[0].attributes('style')).toContain('top: 30px')
  })

  it('scrollToIndex lands on accumulated offsets with start/center/end alignment', () => {
    const wrapper = mountVar()
    const scroll = () => (wrapper.find('.vscroll').element as HTMLElement).scrollTop
    vmScroll(wrapper).scrollToIndex(2) // top=80，未钳制
    expect(scroll()).toBe(80)
    vmScroll(wrapper).scrollToIndex(3, 'center') // 150-(200-90)/2=95，未钳制
    expect(scroll()).toBe(95)
    vmScroll(wrapper).scrollToIndex(8) // top=480，max=560-200=360 → 钳制
    expect(scroll()).toBe(360)
    vmScroll(wrapper).scrollToIndex(8, 'end') // 480+30-200=310
    expect(scroll()).toBe(310)
  })

  it('clamps the variable-height window at the last row', async () => {
    const wrapper = mountVar()
    const container = wrapper.find('.vscroll')
    ;(container.element as HTMLElement).scrollTop = 360 // 滚到底：总高 560 − 视口 200
    await container.trigger('scroll')
    const rows = wrapper.findAll('.row')
    expect(rows).toHaveLength(6) // startIndex=6 → 窗口 4..9
    expect(rows[0].text()).toBe('item-4')
    expect(rows[5].text()).toBe('item-9')
    expect(wrapper.findAll('.vscroll-item')[0].attributes('style')).toContain('top: 240px')
  })

  it('renders the empty slot without crashing when itemSize is a function', () => {
    const wrapper = mountVar({
      props: { items: [] },
      slots: { empty: `<div class="empty">empty</div>` },
    })
    expect(wrapper.find('.empty').exists()).toBe(true)
    expect(wrapper.find('.vscroll-inner').attributes('style')).toContain('height: 0px')
  })
})

describe('VScroll · 动态高度骨架（itemSize 缺省，按估算渲染）', () => {
  function mountDynamic(overrides: { props?: Record<string, unknown> } = {}) {
    return mount(VScroll, {
      props: { items, height: 200, overscan: 2, ...(overrides.props ?? {}) },
      slots: { item: `<div class="row">{{ item.label }}</div>` },
    })
  }

  it('renders the estimated window and estimated total size (default 40px)', () => {
    const wrapper = mountDynamic()
    const rows = wrapper.findAll('.row')
    expect(rows).toHaveLength(7) // 200/40 = 5 可见 + 2 缓冲
    expect(rows[0].text()).toBe('item-0')
    expect(rows[6].text()).toBe('item-6')
    expect(wrapper.find('.vscroll-inner').attributes('style')).toContain('height: 4000px')
  })

  it('uses a custom estimatedItemSize', () => {
    const wrapper = mountDynamic({ props: { estimatedItemSize: 50 } })
    expect(wrapper.findAll('.row')).toHaveLength(6) // 200/50 = 4 可见 + 2 缓冲
    expect(wrapper.find('.vscroll-inner').attributes('style')).toContain('height: 5000px')
  })

  it('shifts the estimated window when scrolled', async () => {
    const wrapper = mountDynamic()
    const container = wrapper.find('.vscroll')
    ;(container.element as HTMLElement).scrollTop = 400
    await container.trigger('scroll')
    const rows = wrapper.findAll('.row')
    expect(rows).toHaveLength(9) // startIndex=10 → 窗口 8..16
    expect(rows[0].text()).toBe('item-8')
    expect(rows[8].text()).toBe('item-16')
  })

  it('scrollToIndex lands on the estimated offsets with all alignments', () => {
    const wrapper = mountDynamic()
    const scroll = () => (wrapper.find('.vscroll').element as HTMLElement).scrollTop
    vmScroll(wrapper).scrollToIndex(50)
    expect(scroll()).toBe(2000) // 50 * 40
    vmScroll(wrapper).scrollToIndex(50, 'center')
    expect(scroll()).toBe(1920) // 2000 - (200-40)/2
    vmScroll(wrapper).scrollToIndex(50, 'end')
    expect(scroll()).toBe(1840) // 2000 + 40 - 200
  })

  it('reset() returns to the top in dynamic mode', async () => {
    const wrapper = mountDynamic()
    vmScroll(wrapper).scrollToIndex(50)
    await nextTick()
    vmScroll(wrapper).reset()
    await nextTick()
    expect((wrapper.find('.vscroll').element as HTMLElement).scrollTop).toBe(0)
    expect(wrapper.findAll('.row')[0].text()).toBe('item-0')
  })
})

describe('VScroll · 模式判定与开发告警', () => {
  const slot = { item: `<div class="row">{{ item.label }}</div>` }

  it('warns once and lets itemSize win when both itemSize and estimatedItemSize are passed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const wrapper = mount(VScroll, {
        props: { items, itemSize: 50, estimatedItemSize: 40, height: 200, overscan: 2 },
        slots: slot,
      })
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0][0])).toContain('itemSize')
      expect(wrapper.findAll('.row')).toHaveLength(6) // 固定行高路径：200/50 + 2
    } finally {
      warn.mockRestore()
    }
  })

  it('does not warn when only one of the two is passed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      mount(VScroll, { props: { items, itemSize: 50, height: 200, overscan: 2 }, slots: slot })
      mount(VScroll, { props: { items, estimatedItemSize: 40, height: 200, overscan: 2 }, slots: slot })
      expect(warn).not.toHaveBeenCalled()
    } finally {
      warn.mockRestore()
    }
  })

  it('SSR：itemSize 缺省时服务端渲染不抛错', async () => {
    const app = createSSRApp(VScroll as unknown as Component, { items, height: 200 })
    const html = await renderToString(app)
    expect(html).toContain('vscroll')
  })
})

describe('VScroll · 动态测量（ResizeObserver 落地）', () => {
  let raf: ReturnType<typeof stubRaf>

  beforeEach(() => {
    raf = stubRaf()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('replaces the estimate once a row is measured (layout follows)', async () => {
    const wrapper = mountDynamicRO()
    expect(ROStub.instance!.observed).toHaveLength(7) // 窗口 0..6
    fireResize(0, 100)
    raf.flush()
    await nextTick()
    expect(innerHeight(wrapper)).toContain('height: 4060px') // 4000 - 40 + 100
    const items = wrapper.findAll('.vscroll-item')
    expect(items[1].attributes('style')).toContain('top: 100px') // 行 1 让位
  })

  it('follows when the same row changes again (e.g. content expands)', async () => {
    const wrapper = mountDynamicRO()
    fireResize(0, 100)
    raf.flush()
    fireResize(0, 60)
    raf.flush()
    await nextTick()
    expect(innerHeight(wrapper)).toContain('height: 4020px')
    expect(wrapper.findAll('.vscroll-item')[1].attributes('style')).toContain('top: 60px')
  })

  it('merges same-frame measurements into one commit', async () => {
    const wrapper = mountDynamicRO()
    fireResize(0, 100)
    fireResize(1, 90)
    fireResize(2, 80)
    expect(innerHeight(wrapper)).toContain('height: 4000px') // 帧提交前不生效
    raf.flush()
    await nextTick()
    expect(innerHeight(wrapper)).toContain('height: 4150px') // 4000 + 60 + 50 + 40
    expect(wrapper.findAll('.vscroll-item')[3].attributes('style')).toContain('top: 270px')
  })

  it('delta-corrects the scroll position when rows above the anchor are measured', async () => {
    const wrapper = mountDynamicRO()
    const container = wrapper.find('.vscroll').element as HTMLElement
    container.scrollTop = 400
    await wrapper.find('.vscroll').trigger('scroll')
    expect(wrapper.findAll('.row')[0].text()).toBe('item-8') // 锚点行 10
    fireResize(8, 60)
    fireResize(9, 60)
    raf.flush()
    await nextTick()
    // 上方两行各 +20：锚点行屏幕位置 0 不变
    expect(container.scrollTop).toBe(440)
    const anchor = wrapper
      .findAll('.vscroll-item')
      .find((el) => el.text().includes('item-10'))!
    expect(anchor.attributes('style')).toContain('top: 440px')
  })

  it('does not correct when only the anchor row itself changes', async () => {
    const wrapper = mountDynamicRO()
    const container = wrapper.find('.vscroll').element as HTMLElement
    container.scrollTop = 400
    await wrapper.find('.vscroll').trigger('scroll')
    fireResize(10, 80) // 锚点行自身 +40，其上方偏移不变
    raf.flush()
    await nextTick()
    expect(container.scrollTop).toBe(400)
    const row11 = wrapper
      .findAll('.vscroll-item')
      .find((el) => el.text().includes('item-11'))!
    expect(row11.attributes('style')).toContain('top: 480px')
  })

  it('keeps measurements after the row scrolls out of the window', async () => {
    const wrapper = mountDynamicRO()
    fireResize(0, 60)
    raf.flush()
    await nextTick()
    vmScroll(wrapper).scrollToIndex(50)
    await nextTick()
    vmScroll(wrapper).scrollToIndex(0)
    await nextTick()
    expect(innerHeight(wrapper)).toContain('height: 4020px') // 测量仍在缓存
    expect(wrapper.findAll('.vscroll-item')[1].attributes('style')).toContain('top: 60px')
  })

  it('cancels the pending frame commit on unmount', () => {
    const wrapper = mountDynamicRO()
    fireResize(0, 100) // 已调度，未提交
    wrapper.unmount()
    expect(raf.cancelSpy).toHaveBeenCalled()
    raf.flush() // 不抛错
  })

  it('renders estimates without crashing when no ResizeObserver is available', async () => {
    // jsdom 无全局 ResizeObserver 且不注入 prop：跳过测量、按估算渲染
    const wrapper = mount(VScroll, {
      props: { items, height: 200, overscan: 2 },
      slots: { item: `<div class="row">{{ item.label }}</div>` },
    })
    await nextTick()
    expect(wrapper.findAll('.row')).toHaveLength(7)
    expect(wrapper.find('.vscroll-inner').attributes('style')).toContain('height: 4000px')
  })

  it('observes rows mounted after scrolling', async () => {
    const wrapper = mountDynamicRO()
    vmScroll(wrapper).scrollToIndex(50)
    await nextTick()
    const observedTexts = ROStub.instance!.observed.map(
      (el) => el.querySelector('.row')?.textContent,
    )
    expect(observedTexts).toContain('item-48') // 新窗口首行进入观察
    expect(observedTexts).not.toContain('item-0') // 滚出的行停止观察
  })
})

describe('VScroll · 两阶段跳转与 reset（动态模式）', () => {
  let raf: ReturnType<typeof stubRaf>

  beforeEach(() => {
    raf = stubRaf()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('two-phase jump: rolls to the estimate first, corrects once measured', async () => {
    const wrapper = mountDynamicRO()
    vmScroll(wrapper).scrollToIndex(50) // 估算偏移：50 * 40 = 2000
    expect(scrollOf(wrapper)).toBe(2000)
    await nextTick() // 目标窗口渲染并进入观察
    fireResize(48, 100) // 目标上方行各 +60/+80：目标新偏移 2140
    fireResize(49, 120)
    raf.flush()
    await nextTick()
    expect(scrollOf(wrapper)).toBe(2140) // 测量落地后修正，落点准确
  })

  it('corrects center alignment after the estimate is replaced', async () => {
    const wrapper = mountDynamicRO()
    vmScroll(wrapper).scrollToIndex(50, 'center') // 2000 - 80 = 1920
    await nextTick()
    fireResize(48, 100)
    fireResize(49, 120)
    raf.flush()
    await nextTick()
    expect(scrollOf(wrapper)).toBe(2060) // 2140 - (200-40)/2
  })

  it('corrects end alignment after the estimate is replaced', async () => {
    const wrapper = mountDynamicRO()
    vmScroll(wrapper).scrollToIndex(50, 'end') // 2000 + 40 - 200 = 1840
    await nextTick()
    fireResize(48, 100)
    fireResize(49, 120)
    raf.flush()
    await nextTick()
    expect(scrollOf(wrapper)).toBe(1980) // 2140 + 40 - 200
  })

  it('gives up the correction when the user scrolls away from the target', async () => {
    const wrapper = mountDynamicRO()
    vmScroll(wrapper).scrollToIndex(50) // 2000
    await nextTick()
    const container = wrapper.find('.vscroll').element as HTMLElement
    container.scrollTop = 3000 // 用户手动滚离目标
    await wrapper.find('.vscroll').trigger('scroll')
    await nextTick() // 窗口移到 75 行附近
    fireResize(75, 100) // 锚点行自身变化：锚定本就不修正；跳转已放弃 → 不拉回 2140
    raf.flush()
    await nextTick()
    expect(scrollOf(wrapper)).toBe(3000)
  })

  it('retries the correction at most twice', async () => {
    const wrapper = mountDynamicRO()
    vmScroll(wrapper).scrollToIndex(50, 'center') // 1920
    await nextTick()
    fireResize(50, 90) // 目标行自身变高：center 落点变 1945
    raf.flush()
    await nextTick()
    expect(scrollOf(wrapper)).toBe(1945) // 修正 1
    fireResize(50, 130)
    raf.flush()
    await nextTick()
    expect(scrollOf(wrapper)).toBe(1965) // 修正 2
    fireResize(50, 170)
    raf.flush()
    await nextTick()
    expect(scrollOf(wrapper)).toBe(1965) // 上界已到：不再修正
  })

  it('does not spend retry budget on measurements that leave the landing point unchanged', async () => {
    const wrapper = mountDynamicRO()
    vmScroll(wrapper).scrollToIndex(50) // 2000
    await nextTick()
    fireResize(55, 100) // 目标行下方：落点不变（模拟真实浏览器分批提交）
    raf.flush()
    await nextTick()
    fireResize(54, 120)
    raf.flush()
    await nextTick()
    fireResize(53, 90)
    raf.flush()
    await nextTick()
    expect(scrollOf(wrapper)).toBe(2000) // 三次提交都无需修正，也不计数
    fireResize(48, 100) // 目标上方：落点真正变化
    fireResize(49, 120)
    raf.flush()
    await nextTick()
    expect(scrollOf(wrapper)).toBe(2140) // 预算未被空跑耗尽，修正仍生效
  })

  it('does not schedule corrections in fixed mode (one-shot jump)', async () => {
    const wrapper = mount(VScroll, {
      props: { items, itemSize: 50, height: 200, overscan: 2 },
      slots: { item: `<div class="row">{{ item.label }}</div>` },
    })
    vmScroll(wrapper).scrollToIndex(50)
    expect(scrollOf(wrapper)).toBe(2500)
    raf.flush()
    await nextTick()
    expect(scrollOf(wrapper)).toBe(2500) // 无重试开销
  })

  it('does not schedule corrections in known-variable mode (one-shot jump)', async () => {
    const wrapper = mount(VScroll, {
      props: { items, itemSize: (i: number) => 40 + (i % 3) * 10, height: 200, overscan: 2 },
      slots: { item: `<div class="row">{{ item.label }}</div>` },
    })
    // offset(50)：16 个 [40,50,60] 周期(2400) + 行 48(40) + 行 49(50) = 2490
    vmScroll(wrapper).scrollToIndex(50)
    expect(scrollOf(wrapper)).toBe(2490)
    raf.flush()
    await nextTick()
    expect(scrollOf(wrapper)).toBe(2490) // 偏移确定：一步到位
  })

  it('reset() clears measurements and returns offsets to pure estimates', async () => {
    const wrapper = mountDynamicRO()
    fireResize(0, 100)
    raf.flush()
    await nextTick()
    expect(innerHeight(wrapper)).toContain('height: 4060px')
    vmScroll(wrapper).reset()
    await nextTick()
    expect(innerHeight(wrapper)).toContain('height: 4000px') // 偏移回到纯估算
    expect(wrapper.findAll('.vscroll-item')[1].attributes('style')).toContain('top: 40px')
  })

  it('reset() cancels a pending jump correction', async () => {
    const wrapper = mountDynamicRO()
    vmScroll(wrapper).scrollToIndex(50) // 调度修正
    await nextTick()
    fireResize(48, 100)
    fireResize(49, 120)
    raf.flush() // 提交后修正已排入 nextTick
    vmScroll(wrapper).reset()
    await nextTick()
    expect(scrollOf(wrapper)).toBe(0) // 不被拉回第 50 行
  })

  it('repeated reset() is safe', async () => {
    const wrapper = mountDynamicRO()
    fireResize(0, 100)
    raf.flush()
    await nextTick()
    vmScroll(wrapper).reset()
    vmScroll(wrapper).reset()
    await nextTick()
    expect(scrollOf(wrapper)).toBe(0)
    expect(innerHeight(wrapper)).toContain('height: 4000px')
  })
})