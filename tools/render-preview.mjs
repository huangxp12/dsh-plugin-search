/**
 * 生成搜索结果预览图（开发用，不属于插件本体）。
 *
 * 用 jsdom 跑一遍真实的 lib/client.js，把「输入关键词后」的 DOM 快照量出来，
 * 再用它拼一张 SVG —— 这样预览图反映的是插件的真实行为（真实几何由 CSS 决定，
 * 这里只画出行布局与文案），而不是手绘的示意图。
 *
 * 用法：node tools/render-preview.mjs > docs/preview.svg
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { JSDOM } from 'jsdom'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const bundleSource = readFileSync(join(root, 'lib', 'client.js'), 'utf8')

// 与 dom.test.mjs 同构的最小页面：够跑出「搜索后的可见卡片」。
const CARDS = {
  official: [
    ['@deepseek-ai/dsh-experimental-agent-team-profile', '智能体团队', '启用团队协作、团队工具、成员列表和共享任务看板。'],
    ['@deepseek-ai/dsh-experimental-auto-review', '自动授权审查', '提供自动审查权限模式，由模型在每次工具调用前判断是否授权。'],
    ['@deepseek-ai/dsh-experimental-schedule-bundle', '自动化任务', '按设定的时间或周期，在会话中自动执行任务。'],
    ['@deepseek-ai/dsh-experimental-voice-input-bundle', '语音输入', '在本机使用 SenseVoice 转写录音，首次使用需安装依赖。'],
  ],
  bundles: [
    ['@michengai/dsh-agency-agents', '@michengai/dsh-agency-agents', 'DSH Agency Agents — 为 DeepSeek Harness 提供 321 名可召唤的专业智能体'],
    ['@nanmicoder/dsh-agent-teams', '@nanmicoder/dsh-agent-teams', 'AgentTeams for DeepSeek Harness: multi-agent team collaboration'],
    ['dsh-better-sidebar', 'Better Sidebar', '更好用的右侧边栏——文件树、编辑器、文件变动、任务和侧边对话都收在这一栏里。'],
    ['dsh-taskboard', 'dsh-taskboard', 'DSH 任务看板：人在 Web GUI 看板上实时看到同样数据。'],
    ['dsh-thoughtdag', 'dsh-thoughtdag', 'why layer: evidence from session logs about past agent conversations.'],
  ],
}

const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>',
  { url: 'http://localhost/', pretendToBeVisual: true, runScripts: 'outside-only' })
const { window } = dom
const { document } = window
const registered = {}
window.__ModuleLoader__ = { load(row) { registered[row.id] = row } }
window.eval(bundleSource)

function card([name, title, desc]) {
  const li = document.createElement('li')
  li.setAttribute('data-plugin-package', name)
  li.setAttribute('data-plugin-status', 'on')
  const head = document.createElement('div')
  const titleEl = document.createElement('button')
  titleEl.className = 'cardTitle'
  titleEl.textContent = title
  const descEl = document.createElement('span')
  descEl.className = 'cardDesc'
  descEl.textContent = desc
  head.appendChild(titleEl)
  head.appendChild(descEl)
  li.appendChild(head)
  return li
}

const panel = document.createElement('section')
panel.setAttribute('data-plugin-panel', '')
const header = document.createElement('header')
const lead = document.createElement('div')
const h1 = document.createElement('h1')
h1.textContent = '插件'
lead.appendChild(h1)
header.appendChild(lead)
header.appendChild(document.createElement('div'))
panel.appendChild(header)
for (const id of ['official', 'bundles']) {
  const g = document.createElement('section')
  g.setAttribute('data-plugin-group', id)
  g.appendChild(document.createElement('div'))
  const ul = document.createElement('ul')
  for (const c of CARDS[id]) ul.appendChild(card(c))
  g.appendChild(ul)
  panel.appendChild(g)
}
document.getElementById('app').appendChild(panel)

const row = registered['dsh-plugin-search']
const mod = row.factory(() => { throw new Error('no requires') })
let teardown = null
mod.apply({
  effect(cb) { teardown = cb() },
  locale: { getSnapshot: () => ({ active: 'zh-CN' }), subscribe: () => () => {} },
})
await new Promise((r) => setTimeout(r, 0))

// 打一个关键词，让预览图显示「过滤后」的样子。
// 默认用「看板」：它同时命中一个官方插件（描述里提到看板）和一个已安装插件，
// 正好把「两个分组都留下、其余卡片被滤掉」这件事画出来。
const QUERY = process.argv[2] ?? '看板'
const input = document.querySelector('[data-dsh-plugin-search-bar] input')
input.value = QUERY
input.dispatchEvent(new window.Event('input', { bubbles: true }))
await new Promise((r) => setTimeout(r, 0))

const HID = 'data-dsh-plugin-search-hidden'
const visible = [...document.querySelectorAll('[data-plugin-package],[data-plugin-item]')]
  .filter((c) => !c.hasAttribute(HID))
const groups = [...document.querySelectorAll('[data-plugin-group]')]
  .filter((g) => !g.hasAttribute(HID))
const status = document.querySelector('.dps-status')?.textContent ?? ''

// ── 画 SVG ─────────────────────────────────────────────────────────────────
// 样式一律写成**呈现属性**（font-size / fill 直接落在元素上），不靠 <style> 里的
// 类选择器：SVG 当图片被引用时（<img src>、各种预览器）普遍不执行 CSS，
// 用类名会渲染成一堆默认黑色的字。
const W = 760
const PAD = 26
const rows = []
const GROUP_TITLES = { official: '官方', bundles: '已安装' }
let y = 0
/** 所有行里最靠下的那个底边；总高由它推出，避免手算漏掉一行就把内容裁掉。 */
let contentBottom = 0

const FONT = "-apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif"
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function pushRow(html, height) {
  rows.push({ html, y, height })
  y += height
  contentBottom = Math.max(contentBottom, y)
}

// 页头：标题 + 说明 + 搜索条
pushRow(`<text x="${PAD}" y="${y + 30}" font-size="20" font-weight="500" fill="#1a1a1a">插件</text>`, 40)
pushRow(`<text x="${PAD}" y="${y + 16}" font-size="13" fill="#6b6b6b">安装、启用和配置插件</text>`, 26)
pushRow(`
  <rect x="${PAD}" y="${y}" width="300" height="32" rx="8" fill="#ffffff" stroke="#d8d8d8" stroke-width="1"/>
  <circle cx="${PAD + 18}" cy="${y + 15}" r="5" fill="none" stroke="#9a9a9a" stroke-width="1.4"/>
  <path d="M${PAD + 21.5} ${y + 18.5} L${PAD + 26} ${y + 23}" stroke="#9a9a9a" stroke-width="1.4" stroke-linecap="round"/>
  <text x="${PAD + 34}" y="${y + 20}" font-size="14" fill="#1a1a1a">${esc(QUERY)}</text>
  <text x="${PAD + 312}" y="${y + 20}" font-size="13" fill="#9a9a9a">${esc(status)}</text>
`, 46)

for (const id of ['official', 'bundles']) {
  if (!groups.some((g) => g.getAttribute('data-plugin-group') === id)) continue
  const cards = visible.filter((c) => {
    let p = c.parentNode
    while (p) { if (p.getAttribute && p.getAttribute('data-plugin-group') === id) return true; p = p.parentNode }
    return false
  })
  pushRow(`<text x="${PAD}" y="${y + 14}" font-size="14" font-weight="500" fill="#1a1a1a">${GROUP_TITLES[id]}</text>
           <text x="${PAD + 42}" y="${y + 14}" font-size="13" fill="#a8a8a8">${cards.length}</text>`, 30)
  for (const c of cards) {
    const title = c.querySelector('.cardTitle')?.textContent ?? ''
    const desc = c.querySelector('.cardDesc')?.textContent ?? ''
    const cut = desc.length > 62 ? desc.slice(0, 61) + '…' : desc
    pushRow(`
      <rect x="${PAD}" y="${y}" width="${W - PAD * 2}" height="62" rx="10" fill="#fafafa" stroke="#ececec" stroke-width="1"/>
      <rect x="${PAD + 14}" y="${y + 14}" width="34" height="34" rx="9" fill="#e8eef7"/>
      <text x="${PAD + 62}" y="${y + 28}" font-size="14" fill="#1a1a1a">${esc(title)}</text>
      <text x="${PAD + 62}" y="${y + 46}" font-size="12" fill="#8a8a8a">${esc(cut)}</text>
      <rect x="${W - PAD - 46}" y="${y + 20}" width="32" height="18" rx="9" fill="#2b7fff"/>
      <circle cx="${W - PAD - 20}" cy="${y + 29}" r="7" fill="#ffffff"/>
    `, 70)
  }
  y += 6
}

const H = contentBottom + PAD
// 注意：每行 html 里的 y 已经是绝对坐标，所以这里**不能**再套 <g transform> 平移 ——
// 那样会把行位置叠加第二次，最后几行会被推出画布（表现为预览被裁掉）。
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">
<rect width="${W}" height="${H}" fill="#ffffff"/>
${rows.map((r) => r.html).join('\n')}
</svg>
`

const outDir = join(root, 'docs')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'preview.svg'), svg, 'utf8')
console.log(`wrote docs/preview.svg (${W}x${H}) — query "${QUERY}" → ${visible.length}/${CARDS.official.length + CARDS.bundles.length} card(s), status "${status}"`)
dom.window.close()
