# 基础用法

下面直接渲染仓库内的真实组件（1 万条数据，只渲染可视窗口）：

<script setup>
import { ref } from 'vue'
import VScroll from '../../src/vscroll/VScroll.vue'

const items = ref(Array.from({ length: 10_000 }, (_, i) => ({ id: i, label: `Row ${i}` })))
</script>

<div class="vp-demo">
  <VScroll :items="items" :item-size="50" :height="360" :overscan="5">
    <template #item="{ item, index }">
      <div class="row">
        <span class="idx">#{{ index }}</span>
        <span>{{ item.label }}</span>
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
.row {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 50px;
  padding: 0 16px;
  box-sizing: border-box;
  border-bottom: 1px solid #f0f0f0;
}
.idx {
  color: #999;
  font-size: 12px;
  width: 48px;
}
</style>