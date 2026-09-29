import { onBeforeUnmount, onMounted, type Ref } from 'vue'

/**
 * 触底加载哨兵（组合函数，VScroll/VGrid 共用）：IntersectionObserver 观察
 * 哨兵元素，真正进入视口才回调。observe 后的首次异步回调可能带
 * isIntersecting:false，必须过滤（挂载即触发的假信号）。
 */
export function useLoadMoreSentinel(options: {
  root: Ref<HTMLElement | null>
  sentinel: Ref<HTMLElement | null>
  /** 注入 IO 构造器（测试/降级用）；缺省用全局，不存在则禁用触底检测 */
  ioCtor?: typeof IntersectionObserver
  onLoadMore: () => void
}) {
  let observer: IntersectionObserver | null = null
  onMounted(() => {
    const IORef = options.ioCtor ?? globalThis.IntersectionObserver
    if (IORef && options.sentinel.value && options.root.value) {
      observer = new IORef(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) options.onLoadMore()
        },
        { root: options.root.value },
      )
      observer.observe(options.sentinel.value)
    }
  })
  onBeforeUnmount(() => observer?.disconnect())
}
