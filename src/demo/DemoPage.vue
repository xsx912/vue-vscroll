<script setup lang="ts">
import { ref } from 'vue'
import VScroll from '../vscroll/VScroll.vue'
import VGrid from '../vscroll/VGrid.vue'
import type { VScrollExpose } from '../vscroll/useVScroll'
import type { VGridExpose } from '../vscroll/VGrid.vue'

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

interface ChatMsg {
  id: number
  self: boolean
  lines: number
  text: string
}
const chatKey = (m: ChatMsg) => m.id

// 钉底：动态高度聊天——追加消息贴底，测量落地继续贴新底；上滚读历史不打扰
const chatItems = ref<ChatMsg[]>(
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
let chatHead = -1
/** 向上加载历史：纯头部插入，视图锚定不动（ADR-0006） */
function loadEarlier() {
  const earlier = Array.from({ length: 10 }, () => {
    const id = chatHead--
    return { id, self: id % 3 === 0, lines: 1 + ((Math.abs(id) * 7) % 3), text: `更早的消息 ${id}` }
  })
  chatItems.value = [...earlier, ...chatItems.value]
}

// 虚拟表格：10 万行 × 3 列，行虚拟化 + sticky 表头 + 触底加载
const gridColumns = [240, 160, 120]
const gridRows = ref(
  Array.from({ length: 100_000 }, (_, i) => ({ id: i, name: `名称 ${i}`, score: (i * 7) % 100 })),
)
const gridEl = ref<VGridExpose | null>(null)
const gridLoading = ref(false)
function gridLoadMore() {
  if (gridLoading.value) return
  gridLoading.value = true
  setTimeout(() => {
    const base = gridRows.value.length
    gridRows.value.push(
      ...Array.from({ length: 1000 }, (_, i) => ({
        id: base + i,
        name: `名称 ${base + i}`,
        score: ((base + i) * 7) % 100,
      })),
    )
    gridLoading.value = false
  }, 500)
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
    <p class="tip">动态测量 + 钉底 + 头部插入三联动：贴底时点「收到新消息」仍贴底；滚到顶部附近点「加载更早」，视图锚定不动；身份键让测量跟随条目</p>
    <div class="actions">
      <button @click="receiveMessage">收到新消息</button>
      <button @click="loadEarlier">加载更早 10 条</button>
      <button @click="chatEl?.scrollToIndex(0)">回顶部读历史</button>
    </div>
    <VScroll
      ref="chatEl"
      class="demo-list chat-list"
      :items="chatItems"
      :estimated-item-size="48"
      :height="360"
      :overscan="4"
      :get-item-key="chatKey"
      stick-to-bottom
    >
      <template #item="{ item }">
        <div class="chat-row" :class="{ self: item.self }">
          <p v-for="n in item.lines" :key="n">{{ item.text }} · 第 {{ n }} 行</p>
        </div>
      </template>
    </VScroll>

    <h2>虚拟表格示例（VGrid · 10 万行）</h2>
    <p class="tip">行虚拟化 + sticky 表头；列宽 <code>[240, 160, 120]</code>，总宽超出容器时横向滚动；滚动到底自动加载</p>
    <div class="actions">
      <button @click="gridEl?.scrollToRow(50_000)">跳到第 50000 行</button>
      <button @click="gridEl?.reset()">回到顶部</button>
    </div>
    <VGrid
      ref="gridEl"
      class="demo-grid"
      :rows="gridRows"
      :columns="gridColumns"
      :row-size="44"
      :height="400"
      :overscan="5"
      :loading="gridLoading"
      @load-more="gridLoadMore"
    >
      <template #header>
        <div class="g-th" :style="{ width: gridColumns[0] + 'px' }">名称</div>
        <div class="g-th" :style="{ width: gridColumns[1] + 'px' }">分数</div>
        <div class="g-th" :style="{ width: gridColumns[2] + 'px' }">操作</div>
      </template>
      <template #cell="{ item, column }">
        <span v-if="column === 0" class="g-name">#{{ item.id }} {{ item.name }}</span>
        <span v-else-if="column === 1" class="g-score">{{ item.score }}</span>
        <button v-else class="g-op">编辑</button>
      </template>
      <template #loading>
        <div class="list-loading">加载中…</div>
      </template>
      <template #empty>
        <div class="list-empty">没有数据</div>
      </template>
    </VGrid>
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
.demo-grid {
  border: 1px solid #e2e2e2;
  border-radius: 8px;
  background: #fff;
}
.g-th {
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #666;
  background: #fafafa;
  border-bottom: 1px solid #eee;
  box-sizing: border-box;
}
.g-name,
.g-score {
  padding: 0 16px;
  font-size: 13px;
  line-height: 44px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  box-sizing: border-box;
}
.g-score {
  color: #42b883;
  font-variant-numeric: tabular-nums;
}
.g-op {
  margin-left: 16px;
  padding: 4px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}
</style>