# 触底加载

滚动到底部自动追加 50 条（`loadMore` 事件 + IntersectionObserver 哨兵）：

<script setup>
import { ref } from 'vue'
import VScroll from '../../src/vscroll/VScroll.vue'

let tail = 300
const items = ref(Array.from({ length: 300 }, (_, i) => ({ id: i, label: `消息 ${i}` })))
const loading = ref(false)

function loadMore() {
  if (loading.value) return
  loading.value = true
  setTimeout(() => {
    const next = Array.from({ length: 50 }, (_, i) => ({
      id: tail + i,
      label: `消息 ${tail + i}`,
    }))
    tail += 50
    items.value.push(...next)
    loading.value = false
  }, 600)
}
</script>

<div class="vp-demo">
  <VScroll :items="items" :item-size="64" :height="360" :overscan="5" :loading="loading" @load-more="loadMore">
    <template #header>
      <div class="head">共 {{ items.length }} 条 · 滚动到底自动加载</div>
    </template>
    <template #item="{ item, index }">
      <div class="row">
        <span class="idx">#{{ index }}</span>
        <span>{{ item.label }}</span>
      </div>
    </template>
    <template #loading>
      <div class="loading">加载中…</div>
    </template>
  </VScroll>
</div>

<style scoped>
.vp-demo {
  border: 1px solid #e2e2e2;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}
.head {
  padding: 8px 16px;
  background: #f7f7f7;
  color: #666;
  font-size: 13px;
}
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 64px;
  padding: 0 16px;
  box-sizing: border-box;
  border-bottom: 1px solid #f0f0f0;
}
.idx {
  color: #999;
  font-size: 12px;
  width: 48px;
}
.loading {
  padding: 8px 16px;
  text-align: center;
  color: #999;
  font-size: 13px;
}
</style>