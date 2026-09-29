# 钉底（聊天场景）

动态测量 + 钉底联动：贴底时新消息追加仍贴底（追加行测出真实高度后继续贴新底）；上滚读历史不打扰，滚回底部后恢复。挂载时列表非空则初始定位到底部。

<script setup lang="ts">
import { ref } from 'vue'
import VScroll from '../../src/vscroll/VScroll.vue'

const chatItems = ref(
  Array.from({ length: 60 }, (_, i) => ({
    id: i,
    self: i % 3 === 0,
    lines: 1 + ((i * 7) % 3),
    text: `消息 ${i}`,
  })),
)
let chatTail = 60
function receiveMessage() {
  const n = chatTail++
  chatItems.value.push({ id: n, self: n % 3 === 0, lines: 1 + ((n * 7) % 3), text: `消息 ${n}` })
}
</script>

<div class="vp-actions">
  <button @click="receiveMessage">收到新消息</button>
</div>

<div class="vp-demo">
  <VScroll
    class="chat-list"
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

<style scoped>
.vp-actions {
  margin-bottom: 12px;
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
