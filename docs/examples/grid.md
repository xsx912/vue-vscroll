# 虚拟表格

10 万行 × 3 列的虚拟表格（行虚拟化 + sticky 表头 + 触底加载）：

<script setup lang="ts">
import { ref } from 'vue'
import VGrid from '../../src/vscroll/VGrid.vue'

const columns = [240, 160, 120]
const rows = ref(Array.from({ length: 100_000 }, (_, i) => ({
  id: i,
  name: `名称 ${i}`,
  score: (i * 7) % 100,
})))
const loading = ref(false)

function loadMore() {
  if (loading.value) return
  loading.value = true
  setTimeout(() => {
    const base = rows.value.length
    rows.value.push(
      ...Array.from({ length: 100 }, (_, i) => ({
        id: base + i,
        name: `名称 ${base + i}`,
        score: ((base + i) * 7) % 100,
      })),
    )
    loading.value = false
  }, 500)
}
</script>

<div class="vp-demo">
  <VGrid
    class="vp-grid"
    :rows="rows"
    :columns="columns"
    :row-size="44"
    :height="360"
    :overscan="4"
    :loading="loading"
    @load-more="loadMore"
  >
    <template #header>
      <div class="th" :style="{ width: columns[0] + 'px' }">名称</div>
      <div class="th" :style="{ width: columns[1] + 'px' }">分数</div>
      <div class="th" :style="{ width: columns[2] + 'px' }">操作</div>
    </template>
    <template #cell="{ item, column }">
      <span v-if="column === 0" class="name">{{ item.name }}</span>
      <span v-else-if="column === 1" class="score">{{ item.score }}</span>
      <button v-else class="op">编辑</button>
    </template>
    <template #loading>
      <div class="vp-loading">加载中…</div>
    </template>
    <template #empty>没有数据</template>
  </VGrid>
</div>

<style scoped>
.vp-demo {
  border: 1px solid #e2e2e2;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}
.vp-grid :deep(.th) {
  padding: 10px 16px;
  font-size: 13px;
  font-weight: 600;
  color: #666;
  background: #fafafa;
  border-bottom: 1px solid #eee;
  box-sizing: border-box;
}
.name,
.score {
  padding: 0 16px;
  font-size: 13px;
  line-height: 44px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
  box-sizing: border-box;
}
.score {
  color: #42b883;
  font-variant-numeric: tabular-nums;
}
.op {
  margin-left: 16px;
  padding: 4px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}
.vp-loading {
  padding: 8px;
  text-align: center;
  color: #999;
  font-size: 13px;
}
</style>
