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

// 钉底：动态高度聊天——追加消息贴底，测量落地继续贴新底；上滚读历史不打扰
const chatItems = ref(
  Array.from({ length: 60 }, (_, i) => ({
    id: i,
    self: i % 3 === 0,
    lines: 1 + ((i * 7) % 3),
    text: `消息 ${i}`,
  })),
)
const chatEl = ref<VScrollExpose | null>(null)
let chatTail = 60
function receiveMessage() {
  const n = chatTail++
  chatItems.value.push({ id: n, self: n % 3 === 0, lines: 1 + ((n * 7) % 3), text: `消息 ${n}` })
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

    <h2>钉底示例（stickToBottom · 聊天场景）</h2>
    <p class="tip">动态测量 + 钉底联动：贴底时点「收到新消息」仍贴底（行高测出后继续贴新底）；上滚读历史则不打扰，滚回底部恢复</p>
    <div class="actions">
      <button @click="receiveMessage">收到新消息</button>
      <button @click="chatEl?.scrollToIndex(0)">回顶部读历史</button>
    </div>
    <VScroll
      ref="chatEl"
      class="demo-list chat-list"
      :items="chatItems"
      :estimated-item-size="48"
      :height="360"
      :overscan="4"
      stick-to-bottom
    >
      <template #item="{ item }">
        <div class="chat-row" :class="{ self: item.self }">
          <p v-for="n in item.lines" :key="n">{{ item.text }} · 第 {{ n }} 行</p>
        </div>
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
.chat-list {
  background: #fafbfc;
}
.chat-row {
  display: flex;
  flex-direction: column;
  max-width: 72%;
  margin: 4px 12px;
  padding: 6px 12px;
  border-radius: 10px;
  background: #fff;
  border: 1px solid #ececec;
  box-sizing: border-box;
}
.chat-row.self {
  margin-left: auto;
  background: #edfbf3;
  border-color: #d9f2e5;
}
.chat-row p {
  margin: 0 0 2px;
  font-size: 13px;
  line-height: 20px;
  color: #333;
}
</style>