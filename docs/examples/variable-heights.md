# 已知变高

行高由函数同步给出（业务卡片高度 40–140px 随索引分布），无需测量，偏移数组直接算准：

<script setup lang="ts">
import { ref } from 'vue'
import VScroll from '../../src/vscroll/VScroll.vue'

const items = ref(
  Array.from({ length: 10_000 }, (_, i) => ({
    id: i,
    label: `卡片 ${i}`,
    score: (i * 37) % 100,
  })),
)
// 高度由业务数据推导：score 分档 → 40/70/100/130px
const rowHeight = (index: number) => 40 + Math.floor(items.value[index].score / 26) * 30
</script>

<div class="vp-demo">
  <VScroll :items="items" :item-size="rowHeight" :height="360" :overscan="4">
    <template #item="{ item, index }">
      <div class="card">
        <strong>{{ item.label }}</strong>
        <p>score = {{ item.score }} → 行高 {{ rowHeight(index) }}px</p>
      </div>
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
.card {
  padding: 8px 16px;
  box-sizing: border-box;
  border-bottom: 1px solid #f0f0f0;
  overflow: hidden;
}
.card p {
  margin: 0;
  color: #666;
  font-size: 13px;
}
</style>
