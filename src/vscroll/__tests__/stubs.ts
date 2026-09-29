/** 可控的 IntersectionObserver 桩：捕获回调，由测试手动触发（VScroll/VGrid 共用） */
export class IOStub {
  static instance: IOStub | null = null
  callback: IntersectionObserverCallback
  observed: Element[] = []
  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback
    IOStub.instance = this
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

export const IOStubCtor = IOStub as unknown as typeof IntersectionObserver
