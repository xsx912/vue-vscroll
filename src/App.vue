<script setup lang="ts">
import { computed, ref } from 'vue'
import BenchPage from './bench/BenchPage.vue'
import DemoPage from './demo/DemoPage.vue'

const hash = ref(window.location.hash)
window.addEventListener('hashchange', () => {
  hash.value = window.location.hash
})
const route = computed(() => (hash.value === '#bench' ? 'bench' : 'demo'))
</script>

<template>
  <div class="shell">
    <nav class="nav">
      <a href="#" :class="{ active: route === 'demo' }">示例</a>
      <a href="#bench" :class="{ active: route === 'bench' }">基准页</a>
    </nav>
    <BenchPage v-if="route === 'bench'" />
    <DemoPage v-else />
  </div>
</template>

<style>
body {
  margin: 0;
  background: #f5f5f5;
  font-family:
    system-ui,
    -apple-system,
    'Segoe UI',
    Roboto,
    'PingFang SC',
    'Microsoft YaHei',
    sans-serif;
}
</style>

<style scoped>
.nav {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #eee;
}
.nav a {
  padding: 4px 12px;
  border-radius: 6px;
  color: #555;
  text-decoration: none;
  font-size: 14px;
}
.nav a.active {
  background: #42b883;
  color: #fff;
}
</style>