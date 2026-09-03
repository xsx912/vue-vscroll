<script setup lang="ts">
import { ref } from 'vue'
import VScroll from '../vscroll/VScroll.vue'
import type { VScrollExpose } from '../vscroll/useVScroll'

const base = 1000
const items = ref(Array.from({ length: base }, (_, i) => ({ id: i, label: `消息 ${i}` })))
const loading = ref(false)
const vscrollEl = ref<VScrollExpose | null>(null)

let tail = base
function loadMore() {
  if (loading.value) return
  loading.value = true
  // 模拟异步加载：追加 100 条
  setTimeout(() => {
    const next = Array.from({ length: 100 }, (_, i) => ({ id: tail + i, label: `消息 ${tail + i}` }))
    tail += 100
    items.value.push(...next)
    loading.value = false
  }, 600)
}
</script>

<template>
  <div class="demo">
    <h2>VScroll 示例</h2>
    <p class="tip">滚动到底部自动加载更多（IntersectionObserver 哨兵）；试试「跳到第 500 条」</p>
    <div class="actions">
      <button @click="vscrollEl?.scrollToIndex(500)">跳到第 500 条</button>
      <button @click="vscrollEl?.scrollToIndex(500, 'center')">居中跳转</button>
      <button @click="vscrollEl?.reset()">回到顶部</button>
    </div>
    <VScroll
      ref="vscrollEl"
      class="demo-list"
      :items="items"
      :item-size="64"
      :height="480"
      :overscan="5"
      :loading="loading"
      @load-more="loadMore"
    >
      <template #header>
        <div class="list-header">头部插槽 · 共 {{ items.length }} 条</div>
      </template>
      <template #item="{ item, index }">
        <div class="demo-row">
          <span class="badge">#{{ index }}</span>
          <span class="content">{{ item.label }}</span>
        </div>
      </template>
      <template #loading>
        <div class="list-loading">加载中…</div>
      </template>
      <template #footer>
        <div class="list-footer">尾部插槽 · 触底后自动加载</div>
      </template>
      <template #empty>
        <div class="list-empty">没有数据</div>
      </template>
    </VScroll>
  </div>
</template>

<style scoped>
.demo {
  padding: 16px;
  max-width: 640px;
  margin: 0 auto;
}
.tip {
  color: #666;
}
.actions {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.demo-list {
  border: 1px solid #e2e2e2;
  border-radius: 8px;
  background: #fff;
}
.list-header,
.list-footer {
  padding: 8px 16px;
  background: #f7f7f7;
  font-size: 13px;
  color: #666;
}
.list-loading {
  padding: 8px 16px;
  text-align: center;
  color: #999;
  font-size: 13px;
}
.list-empty {
  padding: 40px 16px;
  text-align: center;
  color: #bbb;
}
.demo-row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 64px;
  padding: 0 16px;
  border-bottom: 1px solid #f0f0f0;
  box-sizing: border-box;
}
.badge {
  color: #999;
  font-size: 12px;
  width: 48px;
  font-variant-numeric: tabular-nums;
}
</style>