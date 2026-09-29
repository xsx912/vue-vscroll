import { computed, onBeforeUnmount, onMounted, ref, type ComputedRef, type Ref } from 'vue'

function parseSize(value: string | number): number {
  return typeof value === 'number' ? value : parseFloat(value)
}

/**
 * 视口尺寸（组合函数，VScroll/VGrid 共用）：`height` 固定时直接解析；
 * 缺省则测量容器并持续观察其尺寸变化（自适应高度容器）。
 */
export function useContainerViewport(options: {
  container: Ref<HTMLElement | null>
  /** 固定高度 prop（px 数或 CSS 长度）；不传则撑满父容器并自适应 */
  fixedHeight: () => string | number | undefined
}): ComputedRef<number> {
  const measured = ref(0)

  function measure() {
    if (options.fixedHeight() != null) return
    measured.value = options.container.value?.clientHeight ?? 0
  }

  let containerObserver: ResizeObserver | null = null

  onMounted(() => {
    measure()
    if (
      typeof ResizeObserver !== 'undefined' &&
      options.fixedHeight() == null &&
      options.container.value
    ) {
      containerObserver = new ResizeObserver(measure)
      containerObserver.observe(options.container.value)
    }
  })

  onBeforeUnmount(() => containerObserver?.disconnect())

  return computed(() => {
    const fixed = options.fixedHeight()
    return fixed != null ? parseSize(fixed) : measured.value
  })
}
