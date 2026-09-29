# 动态高度（测量）

不传 `itemSize`：先按估算高度渲染，行进入 DOM 后由 ResizeObserver 测出真实高度。每条消息 1–4 行文本，行高完全由内容决定：

<script setup>
import { ref } from 'vue'
import VScroll from '../../src/vscroll/VScroll.vue'

const items = ref(
  Array.from({ length: 10_000 }, (_, i) => ({
    id: i,
    // 确定性的 1–4 行文本，模拟真实内容高度分布
    lines: 1 + ((i * 2654435761) % 4),
    label: `消息 ${i}`,
  })),
)
</script>

<div class="vp-demo">
  <VScroll :items="items" :estimated-item-size="40" :height="360" :overscan="4">
    <template #item="{ item }">
      <div class="msg">
        <p v-for="n in item.lines" :key="n">{{ item.label }} · 第 {{ n }} 行内容</p>
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
.msg {
  padding: 8px 16px;
  border-bottom: 1px solid #f0f0f0;
}
.msg p {
  margin: 0 0 4px;
  font-size: 13px;
  line-height: 20px;
  color: #333;
}
</style>
