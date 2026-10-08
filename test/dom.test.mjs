/**
 * DOM 行为测试（jsdom）。
 *
 * 目的：在**不启动 GUI** 的前提下，验证 lib/client.js 对「插件」页真实 DOM 结构的
 * 行为 —— 搜索条落位、关键词过滤、分组隐藏、React 重挂后重算、切详情页撤走、
 * 卸载清理。
 *
 * 夹具的层级与 data-* 属性全部照抄 @deepseek-ai/dsh-client-ui-plugin-manager 的
 * JSX（PackageCard / ItemCard / renderGroup / PluginManagerPage）。**这些属性就是被测
 * 代码赖以定位的契约**，所以夹具必须与它一致：夹具改了、代码没跟上，测试就该红。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { JSDOM } from 'jsdom'

const here = dirname(fileURLToPath(import.meta.url))
const bundlePath = join(here, '..', 'lib', 'client.js')
const bundleSource = readFileSync(bundlePath, 'utf8')

// ── 结果收集 ────────────────────────────────────────────────────────────────
const results = []
function rec(name, ok, detail) {
  results.push({ name, ok: Boolean(ok), detail: detail === undefined ? undefined : String(detail) })
}

// ── 夹具：一张卡片（与 PackageCard / ItemCard 输出的结构一致） ──────────────
const CARDS = {
  official: [
    { name: '@deepseek-ai/dsh-experimental-agent-team-profile', status: 'off', title: '智能体团队', beta: true,
      desc: '启用团队协作、团队工具、成员列表和共享任务看板。' },
    { name: '@deepseek-ai/dsh-experimental-auto-review', status: 'off', title: '自动授权审查', beta: true,
      desc: '提供自动审查权限模式，由模型在每次工具调用前判断是否授权。' },
    { name: '@deepseek-ai/dsh-experimental-schedule-bundle', status: 'off', title: '自动化任务', beta: true,
      desc: '按设定的时间或周期，在会话中自动执行任务。' },
    { name: '@deepseek-ai/dsh-experimental-voice-input-bundle', status: 'off', title: '语音输入', beta: true,
      desc: '在本机使用 SenseVoice 转写录音，首次使用需安装依赖。' },
  ],
  bundles: [
    { name: '@michengai/dsh-agency-agents', status: 'on', title: '@michengai/dsh-agency-agents',
      desc: 'DSH Agency Agents — 为 DeepSeek Harness 提供 321 名可召唤的专业智能体' },
    { name: '@nanmicoder/dsh-agent-teams', status: 'on', title: '@nanmicoder/dsh-agent-teams',
      desc: 'AgentTeams for DeepSeek Harness: multi-agent team collaboration' },
    { name: 'dsh-better-sidebar', status: 'on', title: 'Better Sidebar',
      desc: '更好用的右侧边栏——文件树、编辑器、文件变动、任务和侧边对话都收在这一栏里。' },
    { name: 'dsh-taskboard', status: 'on', title: 'dsh-taskboard',
      desc: 'DSH 任务看板：人在 Web GUI 看板上实时看到同样数据。' },
    { name: 'dsh-thoughtdag', status: 'on', title: 'dsh-thoughtdag',
      desc: 'why layer: evidence from session logs about past agent conversations.' },
  ],
}
const TOTAL = CARDS.official.length + CARDS.bundles.length

function buildPage(doc) {
  const panel = doc.createElement('section')
  panel.className = 'page'
  panel.setAttribute('data-plugin-panel', '')

  const header = doc.createElement('header')
  header.className = 'pageHead'
  header.setAttribute('data-window-drag', '')
  const lead = doc.createElement('div')
  const h1 = doc.createElement('h1')
  h1.className = 'pageTitle'
  h1.textContent = '插件'
  const intro = doc.createElement('div')
  intro.className = 'pageIntro'
  const introSpan = doc.createElement('span')
  introSpan.textContent = '安装、启用和配置插件'
  intro.appendChild(introSpan)
  lead.appendChild(h1)
  lead.appendChild(intro)
  const toolbar = doc.createElement('div')
  toolbar.className = 'toolbar'
  const refresh = doc.createElement('button')
  refresh.type = 'button'
  refresh.className = 'iconButton'
  refresh.setAttribute('aria-label', '刷新')
  const add = doc.createElement('button')
  add.type = 'button'
  add.className = 'addButton'
  add.textContent = '添加插件'
  toolbar.appendChild(refresh)
  toolbar.appendChild(add)
  header.appendChild(lead)
  header.appendChild(toolbar)
  panel.appendChild(header)

  for (const id of ['official', 'bundles']) {
    const group = doc.createElement('section')
    group.className = 'group'
    group.setAttribute('data-plugin-scope', 'global')
    group.setAttribute('data-plugin-group', id)
    const head = doc.createElement('div')
    head.className = 'groupHead'
    const h3 = doc.createElement('h3')
    h3.className = 'groupTitle'
    h3.textContent = id === 'official' ? '官方' : '已安装'
    const count = doc.createElement('span')
    count.className = 'count'
    count.setAttribute('data-plugin-count', String(CARDS[id].length))
    count.textContent = String(CARDS[id].length)
    head.appendChild(h3)
    head.appendChild(count)
    group.appendChild(head)
    group.appendChild(buildList(doc, id))
    panel.appendChild(group)
  }
  return panel
}

function buildList(doc, id) {
  const ul = doc.createElement('ul')
  ul.className = 'cards'
  for (const c of CARDS[id]) ul.appendChild(buildCard(doc, c))
  return ul
}

function buildCard(doc, c) {
  const li = doc.createElement('li')
  li.className = 'card cardLink'
  li.setAttribute('data-plugin-package', c.name)
  li.setAttribute('data-plugin-status', c.status)
  const head = doc.createElement('div')
  head.className = 'cardHead'
  const icon = doc.createElement('span')
  icon.className = 'cardIcon'
  icon.setAttribute('aria-hidden', 'true')
  const main = doc.createElement('div')
  main.className = 'cardMain'
  const titleRow = doc.createElement('div')
  titleRow.className = 'titleRow'
  const title = doc.createElement('button')
  title.type = 'button'
  title.className = 'cardTitle cardOpen'
  title.textContent = c.title
  titleRow.appendChild(title)
  if (c.beta) {
    const tag = doc.createElement('span')
    tag.className = 'statusTag'
    tag.textContent = '实验性'
    titleRow.appendChild(tag)
  }
  const desc = doc.createElement('span')
  desc.className = 'cardDesc'
  desc.textContent = c.desc
  main.appendChild(titleRow)
  main.appendChild(desc)
  head.appendChild(icon)
  head.appendChild(main)
  li.appendChild(head)
  return li
}

// ── 测试主体 ────────────────────────────────────────────────────────────────
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
  runScripts: 'outside-only',
})
const { window } = dom
const { document } = window

// 迷你 __ModuleLoader__：把 bundle 注册的那一行抓下来。
const registered = {}
window.__ModuleLoader__ = { load(row) { registered[row.id] = row } }

// jsdom 里 MutationObserver 是异步的；用 runScripts: 'outside-only' 时全局变量仍
// 需要手动挂上去，bundle 求值才能看到 __ModuleLoader__。
window.eval(bundleSource)

const row = registered['dsh-plugin-search']
rec('bundle registered a row', row !== null && row !== undefined)
rec('bundle id is the package name', row && row.id === 'dsh-plugin-search')
rec('bundle exposes a factory', row && typeof row.factory === 'function')

const mod = row.factory(() => { throw new Error('this bundle must not require anything') })
rec('factory needs no requires', typeof mod.apply === 'function')

// 假的 client ctx：effect 立即执行并记住 disposer；locale 可控。
let teardown = null
const localeListeners = new Set()
let activeLocale = 'zh-CN'
const ctx = {
  effect(cb) { teardown = cb() },
  locale: {
    getSnapshot: () => ({ active: activeLocale }),
    subscribe(fn) { localeListeners.add(fn); return () => localeListeners.delete(fn) },
  },
}

document.getElementById('app').appendChild(buildPage(document))

let applyError = null
try {
  mod.apply(ctx)
} catch (error) {
  applyError = error
}
rec('apply() did not throw', applyError === null, applyError && applyError.stack)

// ── 辅助 ────────────────────────────────────────────────────────────────────
const BAR = '[data-dsh-plugin-search-bar]'
const HID = 'data-dsh-plugin-search-hidden'
const settle = () => new Promise((resolve) => setTimeout(resolve, 0))
const q = (sel) => document.querySelector(sel)
const qa = (sel) => [...document.querySelectorAll(sel)]
const visibleCards = () => qa('[data-plugin-package], [data-plugin-item]').filter((c) => !c.hasAttribute(HID))
const hiddenCount = () => qa(`[${HID}]`).length
const visibleGroups = () => qa('[data-plugin-group]').filter((g) => !g.hasAttribute(HID))
const visibleTitles = () => visibleCards().map((c) => c.querySelector('.cardTitle').textContent)

const bar = q(BAR)
const input = bar && bar.querySelector('input')
const clearBtn = bar && bar.querySelector('.dps-clear')
const status = bar && bar.querySelector('.dps-status')

function type(text) {
  input.value = text
  input.dispatchEvent(new window.Event('input', { bubbles: true }))
}

// ══ 1. 搜索条落位 ═══════════════════════════════════════════════════════════
await settle()
rec('search bar mounted', bar !== null)
rec('input is type=search', input !== null && input.type === 'search')
rec('bar sits in the header lead block', bar && bar.parentNode === q('header').firstElementChild)
rec('placeholder localized to zh', input && input.placeholder === '搜索插件…', input && input.placeholder)
rec('style tag injected', document.getElementById('dsh-plugin-search-style') !== null)
rec('nothing hidden while query is empty', hiddenCount() === 0, hiddenCount())
rec('clear button hidden while empty', clearBtn && clearBtn.hidden === true)
rec('status empty while query is empty', status && status.textContent === '', status && status.textContent)

// ══ 2. 关键词过滤 ═══════════════════════════════════════════════════════════
type('sidebar')
await settle()
rec('"sidebar" leaves exactly one card', visibleCards().length === 1, visibleTitles().join(' | '))
rec('"sidebar" picks the right card', visibleTitles()[0] === 'Better Sidebar', visibleTitles()[0])
rec('a group with no hit is hidden', !visibleGroups().some((g) => g.getAttribute('data-plugin-group') === 'official'),
  visibleGroups().map((g) => g.getAttribute('data-plugin-group')).join(' | '))
rec('a group with a hit stays visible', visibleGroups().some((g) => g.getAttribute('data-plugin-group') === 'bundles'))
rec('status shows shown/total', status.textContent === '1 / ' + TOTAL, status.textContent)
rec('clear button appears once typed', clearBtn.hidden === false)

// ══ 3. 描述文字也在命中范围 ═════════════════════════════════════════════════
type('看板')
await settle()
rec('matches by description text',
  visibleTitles().includes('智能体团队') && visibleTitles().includes('dsh-taskboard'),
  visibleTitles().join(' | '))

// ══ 4. 大小写不敏感 + 包名命中 ══════════════════════════════════════════════
type('AGENC')
await settle()
rec('uppercase query matches', visibleTitles().length === 1 && visibleTitles()[0].includes('agency'),
  visibleTitles().join(' | '))

type('michengai')
await settle()
rec('npm scope in the package name matches', visibleTitles().length === 1, visibleTitles().join(' | '))

// ══ 5. 多关键词 = AND ═══════════════════════════════════════════════════════
type('dsh 团队')
await settle()
rec('multi-term AND narrows to one', visibleCards().length === 1, visibleTitles().join(' | '))

type('sidebar agency')
await settle()
rec('multi-term AND with no overlap yields nothing', visibleCards().length === 0, visibleTitles().join(' | '))

// ══ 6. 无命中 ═══════════════════════════════════════════════════════════════
type('zzz-no-such-plugin')
await settle()
rec('no match hides every card', visibleCards().length === 0)
rec('no match hides every group', visibleGroups().length === 0)
rec('no match shows the empty hint', status.textContent === '没有匹配的插件', status.textContent)

// ══ 7. 清空恢复 ═════════════════════════════════════════════════════════════
type('')
await settle()
rec('clearing restores every card', visibleCards().length === TOTAL, visibleCards().length)
rec('clearing restores every group', visibleGroups().length === 2, visibleGroups().length)
rec('clearing removes every hidden marker', hiddenCount() === 0, hiddenCount())

// ══ 8. 清除按钮 ═════════════════════════════════════════════════════════════
type('taskboard')
await settle()
rec('filter applied before clear', visibleCards().length === 1)
clearBtn.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
await settle()
rec('clear button empties the input', input.value === '')
rec('clear button restores every card', visibleCards().length === TOTAL, visibleCards().length)

// ══ 9. Esc 清空且不冒泡 ═════════════════════════════════════════════════════
type('thoughtdag')
await settle()
let bubbled = false
const spy = () => { bubbled = true }
document.addEventListener('keydown', spy)
input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
await settle()
rec('Escape clears the query', input.value === '' && visibleCards().length === TOTAL, visibleCards().length)
rec('Escape does not bubble to the shell', bubbled === false)
document.removeEventListener('keydown', spy)

// ══ 10. 语言切换保留输入 ════════════════════════════════════════════════════
type('sidebar')
await settle()
activeLocale = 'en-US'
for (const fn of localeListeners) fn()
await settle()
rec('locale switch relabels the placeholder', input.placeholder === 'Search plugins…', input.placeholder)
rec('locale switch keeps the typed query', input.value === 'sidebar')
rec('locale switch keeps the filter applied', visibleCards().length === 1, visibleCards().length)
rec('locale switch relabels the status', status.textContent === '1 / ' + TOTAL, status.textContent)
activeLocale = 'zh-CN'
for (const fn of localeListeners) fn()
await settle()

// ══ 11. React 重挂卡片后自动重算 ═══════════════════════════════════════════
type('sidebar')
await settle()
const group = q('[data-plugin-group="bundles"]')
group.querySelector('ul').remove()
group.appendChild(buildList(document, 'bundles'))
await settle()
await settle()
rec('filter re-applied after a React remount', visibleCards().length === 1, visibleTitles().join(' | '))
rec('bar survived the remount', q(BAR) === bar)

// ══ 12. 切到详情页（没有 header）时撤走 ═════════════════════════════════════
const app = document.getElementById('app')
const listPanel = q('[data-plugin-panel]')
listPanel.remove()
const detail = document.createElement('section')
detail.setAttribute('data-plugin-panel', '')
const detailTop = document.createElement('div')
detailTop.textContent = '详情页'
detail.appendChild(detailTop)
app.appendChild(detail)
await settle()
await settle()
rec('bar detached on the detail view', q(BAR) === null)
rec('no stale hidden markers on the detail view', hiddenCount() === 0, hiddenCount())
detail.remove()
app.appendChild(listPanel)
await settle()
await settle()
rec('bar returns on the list view', q(BAR) !== null)

// ══ 13. 卸载清理 ════════════════════════════════════════════════════════════
if (typeof teardown === 'function') teardown()
await settle()
rec('teardown removes the bar', q(BAR) === null)
rec('teardown removes the style tag', document.getElementById('dsh-plugin-search-style') === null)
rec('teardown leaves no hidden markers', hiddenCount() === 0, hiddenCount())

// ── 输出 ────────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok)
for (const r of failed) {
  console.log(`FAIL  ${r.name}${r.detail === undefined ? '' : `\n      detail: ${r.detail}`}`)
}
console.log(`\n${results.length - failed.length}/${results.length} DOM checks passed`)
dom.window.close()
if (failed.length > 0) process.exit(1)
