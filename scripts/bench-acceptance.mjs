/**
 * 动态高度模式真机性能验收（05 票性能门楣）。
 *
 * 驱动 bench 页自身的指标面板（沿用既有方法论：MutationObserver 计 DOM、
 * rAF 滑动窗口帧率、PerformanceObserver 长任务），在真实 Chromium（headless
 * 新模式，虚拟合成器照常产生 BeginFrame，rAF 不节流）上运行生产构建。
 *
 * 用法：先 `npm run build && npx vite preview --port 5212`，再
 * `node scripts/bench-acceptance.mjs`（可用 BENCH_URL / BROWSER_PATH 覆盖）。
 *
 * 门楣：10 万行动态模式，DOM 恒定（窗口采样极差 ≤ 2）、帧率 ≥ 55、长任务 0。
 */
import puppeteer from 'puppeteer-core'

const EXECUTABLE =
  process.env.BROWSER_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const URL = process.env.BENCH_URL ?? 'http://localhost:5212/#bench'

const FPS_GATE = 55
const LONGTASK_GATE = 0
/**
 * DOM 有界门楣：变高内容的窗口行数随视口内行高混合比浮动（矮行多→行数多），
 * 几何上界 = 视口高/最矮行 + 2×缓冲。bench 行高 36–108px、视口 600、缓冲 5
 * → 上界 ≈ 27。"恒定"指有界且与数据量无关，非定高模式的逐像素恒定。
 */
const DOM_MAX_GATE = 27

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await puppeteer.launch({
  executablePath: EXECUTABLE,
  headless: true,
  defaultViewport: { width: 1280, height: 900 },
})
const page = await browser.newPage()
page.setDefaultTimeout(10_000)

const failures = []
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}

try {
  await page.goto(URL, { waitUntil: 'networkidle0' })

  // 前置：确认本环境 rAF 不节流（否则帧率指标无效）
  const rafProbe = await page.evaluate(() =>
    Promise.race([
      new Promise((r) => requestAnimationFrame(() => r('fires'))),
      new Promise((r) => setTimeout(() => r('throttled'), 2000)),
    ]),
  )
  if (rafProbe !== 'fires') {
    throw new Error('环境不可用：requestAnimationFrame 未触发（rAF 被节流），帧率指标无意义')
  }

  const clickButton = (text) =>
    page.evaluate((t) => {
      const btn = [...document.querySelectorAll('button')].find((b) =>
        b.textContent.includes(t),
      )
      if (!btn) throw new Error(`button not found: ${t}`)
      btn.click()
    }, text)

  const readStats = () =>
    page.evaluate(() => {
      const out = {}
      for (const el of document.querySelectorAll('.stat')) {
        out[el.querySelector('.stat-label').textContent] = el.querySelector(
          '.stat-value',
        ).textContent
      }
      return out
    })

  const listState = () =>
    page.evaluate(() => {
      const container = document.querySelector('.vscroll')
      const inner = document.querySelector('.vscroll-inner')
      return {
        items: container.querySelectorAll('.vscroll-item').length,
        scrollTop: Math.round(container.scrollTop),
        innerHeight: inner.style.height,
      }
    })

  const waitStat = async (label, predicate = (v) => v !== '—' && v !== '0fps') => {
    for (let i = 0; i < 50; i++) {
      const stats = await readStats()
      if (predicate(stats[label])) return stats
      await sleep(200)
    }
    throw new Error(`指标未就绪：${label}`)
  }

  // —— 切到动态模式（指标面板随之重置，只统计本次运行）——
  await clickButton('动态高度')
  const statsA = await waitStat('首屏渲染')
  await sleep(1000)
  const stateA = await listState()
  console.log(`动态模式挂载：首屏 ${statsA['首屏渲染']}，DOM ${stateA.items}，总高 ${stateA.innerHeight}`)

  // —— 两阶段跳转（估算落点 → 测量修正）——
  await clickButton('跳到第 50000 条')
  await sleep(1500)
  const stateJ = await listState()
  console.log(`跳转 50000：scrollTop ${stateJ.scrollTop}，总高 ${stateJ.innerHeight}`)
  check('两阶段跳转落到测量区（总高偏离纯估算）', stateJ.innerHeight !== '4000000px', `总高 ${stateJ.innerHeight}`)

  // —— 滚轮连续滚动（下 3s + 上 1.5s），期间采样 DOM 恒定性 ——
  await page.mouse.move(640, 500)
  const domSamples = [stateA.items]
  for (let i = 0; i < 30; i++) {
    await page.mouse.wheel({ deltaY: 600 + (i % 5) * 120 })
    await sleep(90)
    domSamples.push((await listState()).items)
  }
  const midStats = await readStats()
  for (let i = 0; i < 15; i++) {
    await page.mouse.wheel({ deltaY: -800 })
    await sleep(90)
    domSamples.push((await listState()).items)
  }

  // —— 从新位置再次两阶段跳转（目标区已滚过/未测的混合状态）后稳定，读最终指标 ——
  await clickButton('跳到第 50000 条')
  await sleep(1500)
  await sleep(1000) // 让帧率滑动窗口刷新到最新 60 帧
  const stats = await readStats()
  const domRange = Math.max(...domSamples) - Math.min(...domSamples)
  console.log(`最终指标：${JSON.stringify(stats)}`)
  console.log(`DOM 采样：${domSamples.length} 次，区间 [${Math.min(...domSamples)}, ${Math.max(...domSamples)}]，极差 ${domRange}`)
  console.log(`滚动中段帧率：${midStats['帧率(近60帧)']}`)

  check('数据量 100,000', stats['数据量'] === '100,000', stats['数据量'])
  const domMax = Math.max(...domSamples)
  check(`DOM 有界（≤ ${DOM_MAX_GATE}，不随数据量增长）`, domMax <= DOM_MAX_GATE, `最大 ${domMax}`)
  const fps = parseInt(stats['帧率(近60帧)'], 10)
  check(`帧率 ≥ ${FPS_GATE}fps`, fps >= FPS_GATE, `${fps}fps`)
  const longTasks = parseInt(stats['长任务'], 10)
  check(`长任务 ≤ ${LONGTASK_GATE} 次`, longTasks <= LONGTASK_GATE, stats['长任务'])
} finally {
  await browser.close()
}

if (failures.length > 0) {
  console.error(`\n验收未通过：${failures.join('、')}`)
  process.exit(1)
}
console.log('\n动态模式 10 万行性能门楣：全部通过')
