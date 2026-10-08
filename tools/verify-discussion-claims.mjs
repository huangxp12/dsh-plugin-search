/**
 * 发 Discussion 前，把帖子里的每条事实断言拿源码/接口复核一遍。
 *
 * 为什么值得写这个：这条建议的说服力全在「精确」二字上 —— 它主动澄清了「这一页
 * 并非完全没有搜索」，如果澄清本身有一处说错，整条建议就失去可信度。所以每条断言
 * 都对着**真实产物**验：app.asar 里 shell 的 client.js、以及 GitHub 上的讨论。
 *
 * 用法：node tools/verify-discussion-claims.mjs
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'

const ASAR = 'C:/Users/huang/AppData/Local/Programs/DeepSeek Harness/resources/app.asar'
const EXTRACT = 'C:/Users/huang/Projects/plugin-search/tools/asar-extract.mjs'
const CACHE = 'C:/Users/huang/Projects/plugin-search/tools/ref'
const NODE = process.execPath

const results = []
const check = (claim, ok, detail) => results.push({ claim, ok: Boolean(ok), detail })

/** 从 asar 取一个 shell 包文件（首次提取后缓存到 tools/ref）。 */
function shellFile(pkgPath, cacheName) {
  const cached = `${CACHE}/${cacheName}`
  if (existsSync(cached)) return readFileSync(cached, 'utf8')
  return execSync(`"${NODE}" "${EXTRACT}" "${ASAR}" get "${pkgPath}"`, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
}

const pm = shellFile(
  'dsh/node_modules/@deepseek-ai/dsh-client-ui-plugin-manager/lib/client.js',
  '.plugin-manager-client.js',
)
const inv = shellFile(
  'dsh/node_modules/@deepseek-ai/dsh-client-ui-settings-plugin-inventory/lib/client.js',
  '.inventory-client.js',
)

// ── 1. plugin-manager 的确实有一个 search input ──────────────────────────────
check('ui-plugin-manager 存在 type: "search" 输入框', pm.includes('type: "search"'))

// ── 2. 但它在「bundle 详情页」内部、过滤「该 bundle 自身的行」──────────────
// 证据：同一个组件里同时出现 data-plugin-rows 与该 search input
const rowsSectionStart = pm.indexOf('"data-plugin-rows"')
const searchIdx = pm.indexOf('type: "search"')
check(
  '该搜索框与 data-plugin-rows 同处一个「详情页行列表」组件',
  rowsSectionStart >= 0 && searchIdx >= 0 && Math.abs(searchIdx - rowsSectionStart) < 3000,
  `data-plugin-rows@${rowsSectionStart}, search@${searchIdx}`,
)
check(
  '它匹配 rowId 与 moduleName（而非插件名）',
  /row\.rowId,\s*\n\s*row\.moduleName/.test(pm),
)

// ── 3. 阈值 = 10，且是条件渲染 ──────────────────────────────────────────────
const threshold = /ROW_FILTER_THRESHOLD = (\d+)/.exec(pm)
check('ROW_FILTER_THRESHOLD = 10', threshold?.[1] === '10', threshold?.[0])
check(
  '该输入框受 rows.length > ROW_FILTER_THRESHOLD 条件约束',
  /rows\.length > ROW_FILTER_THRESHOLD \?/.test(pm),
)

// ── 4. 它的文案量词是「组件」而非插件 ──────────────────────────────────────
check('文案为「筛选组件」', pm.includes('partsFilter: "筛选组件"'))
check('空状态为「没有匹配的组件。」', pm.includes('partsFilterEmpty: "没有匹配的组件。"'))

// ── 5. 列表层没有搜索：data-plugin-panel 那一层未渲染 search ────────────────
// 证据：页面根节点 data-plugin-panel 所在组件的 children 里没有 type:"search"
const panelIdx = pm.indexOf('"data-plugin-panel"')
const headerIdx = pm.indexOf('"data-window-drag"', panelIdx)
check('页面根 data-plugin-panel 存在', panelIdx >= 0)
check(
  '列表态页头（data-plugin-panel 之后）内部没有 search 输入框',
  panelIdx >= 0 && !pm.slice(panelIdx, panelIdx + 9000).includes('type: "search"'),
)

// ── 6. 设置页确实已有一份完整搜索 ──────────────────────────────────────────
check('设置页有 type: "search"', inv.includes('type: "search"'))
const matchesFn = /function matches\(row, normalizedQuery, resolveText\) \{[\s\S]{0,400}?\n\t\t\}/.exec(inv)
check('设置页 matches() 存在', matchesFn !== null)
const scope = matchesFn?.[0] ?? ''
for (const field of ['row.moduleName', 'row.entryId', 'title', 'description']) {
  check(`设置页 matches() 覆盖 ${field}`, scope.includes(field))
}
check('设置页有空状态 emptySearch', inv.includes('emptySearch'))
check('设置页搜索带本地化文案', /placeholder: t\("search"\)/.test(inv))

// ── 7. 我的插件确实依赖那 4 个 data-* 契约 ─────────────────────────────────
const mine = readFileSync('C:/Users/huang/Projects/plugin-search/lib/client.js', 'utf8')
for (const attr of ['data-plugin-panel', 'data-plugin-group', 'data-plugin-package', 'data-plugin-item']) {
  check(`我的插件使用 ${attr}`, mine.includes(attr))
}
check('我的插件使用 MutationObserver 跟随重挂', mine.includes('new MutationObserver('))

// ── 8. 官方仓库 Issues 关闭、不接受外部 PR（决定该发 Discussions）─────────
const token = execSync('gh auth token', { encoding: 'utf8' }).trim()
const gql = async (query) => {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'v' },
    body: JSON.stringify({ query }),
  })
  const j = await r.json()
  if (j.errors) throw new Error(JSON.stringify(j.errors))
  return j.data
}
const d = await gql(`{ repository(owner:"deepseek-ai", name:"deepseek-harness") {
  hasIssuesEnabled hasDiscussionsEnabled
  discussionCategories(first:20){ nodes { slug } }
} }`)
check('官方 Issues 关闭（has_issues=false）', d.repository.hasIssuesEnabled === false,
  `hasIssuesEnabled=${d.repository.hasIssuesEnabled}`)
check('官方 Discussions 开启', d.repository.hasDiscussionsEnabled === true)
check('存在 ideas 分类', d.repository.discussionCategories.nodes.some((c) => c.slug === 'ideas'))

const contrib = execSync(
  `gh api repos/deepseek-ai/deepseek-harness/contents/CONTRIBUTING.md --jq .content`,
  { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
)
const contribText = Buffer.from(contrib.replace(/\s/g, ''), 'base64').toString('utf8')
check('CONTRIBUTING 明确不接受外部 PR',
  /cannot accept external pull requests/i.test(contribText))

// ── 9. 引用的讨论号真实存在，且不被误述 ────────────────────────────────────
const cited = [1017, 4810, 1857, 1760]
const disc = await gql(`{ repository(owner:"deepseek-ai", name:"deepseek-harness") {
  ${cited.map((n) => `d${n}: discussion(number:${n}) { number title category { name } }`).join('\n')}
} }`)
for (const n of cited) {
  const x = disc.repository[`d${n}`]
  check(`引用的 #${n} 存在`, x != null, x ? `[${x.category.name}] ${x.title}` : 'missing')
}
// #1017 / #4810 必须是 Ideas 且确实提到「与搜索叠加」
const d1017 = await gql(`{ repository(owner:"deepseek-ai", name:"deepseek-harness") {
  discussion(number:1017) { category{name} body } } }`)
check('#1017 属 Ideas', d1017.repository.discussion.category.name === 'Ideas')
check('#1017 原文确含「与搜索叠加生效」',
  d1017.repository.discussion.body.includes('与搜索叠加生效'))
const d4810 = await gql(`{ repository(owner:"deepseek-ai", name:"deepseek-harness") {
  discussion(number:4810) { body } } }`)
check('#4810 原文确含 compose with the existing search',
  /compose with the existing name\/entry-ID search/i.test(d4810.repository.discussion.body))

// ── 10. 没有重复建议：确认没人就「插件页列表搜索」提过 ─────────────────────
const dup = await gql(`{ search(query:"repo:deepseek-ai/deepseek-harness 插件页 列表 搜索 in:title", type:DISCUSSION, first:10) {
  discussionCount nodes { ... on Discussion { number title } } } }`)
const dupTitles = dup.search.nodes.map((n) => `#${n.number} ${n.title}`)
check('没有人提过同一件事（无同标题讨论）', dup.search.discussionCount === 0,
  dupTitles.join(' | ') || 'none')

// ── 输出 ────────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok)
for (const r of results) {
  const mark = r.ok ? '✅' : '❌'
  console.log(`${mark} ${r.claim}${r.detail ? `\n     ${r.detail}` : ''}`)
}
console.log(`\n${results.length - failed.length}/${results.length} 条断言通过`)
if (failed.length) process.exit(1)
