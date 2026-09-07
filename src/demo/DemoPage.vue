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

// 已知变高：行高由函数给出（40–140px，确定性伪随机），服务端已知行高时零测量
const varItems = ref(Array.from({ length: 500 }, (_, i) => ({ id: i, label: `卡片 ${i}` })))
const varEl = ref<VScrollExpose | null>(null)
const sizeAt = (index: number) => 40 + ((index * 53) % 101)
const heightClass = (index: number) => (sizeAt(index) > 90 ? 'card-tall' : 'card-short')
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

    <h2>已知变高示例（itemSize 传函数）</h2>
    <p class="tip">行高由 <code>(index) =&gt; 40 + (index * 53) % 101</code> 直接算出（40–140px），无需测量、零误差</p>
    <div class="actions">
      <button @click="varEl?.scrollToIndex(250)">跳到第 250 条</button>
      <button @click="varEl?.scrollToIndex(250, 'end')">底部对齐跳转</button>
      <button @click="varEl?.reset()">回到顶部</button>
    </div>
    <VScroll
      ref="varEl"
      class="demo-list"
      :items="varItems"
      :item-size="sizeAt"
      :height="360"
      :overscan="5"
    >
      <template #item="{ item, index }">
        <div class="demo-card" :class="heightClass(index)" :style="{ height: `${sizeAt(index)}px` }">
          <span class="badge">#{{ index }}</span>
          <span class="content">{{ item.label }}（{{ sizeAt(index) }}px）</span>
        </div>
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
.demo-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  box-sizing: border-box;
  border-bottom: 1px solid #f0f0f0;
  overflow: hidden;
}
.card-tall {
  background: #f4faf7;
}
.card-short {
  background: #fff;
}
</style>