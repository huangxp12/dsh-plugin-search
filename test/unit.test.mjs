/**
 * 纯逻辑单元测试（不需要 DOM）。
 *
 * lib/client.js 是 `window.__ModuleLoader__.load({id, factory})` 形式的手写 bundle：
 * 先造一个最小的加载器把 factory 抓下来，再调用它的 __internals 做断言。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const bundlePath = join(here, '..', 'lib', 'client.js')
const source = readFileSync(bundlePath, 'utf8')

// ── 迷你 __ModuleLoader__：记录 load() 收到的那一行 ──────────────────────────
let registered = null
globalThis.window = {
  __ModuleLoader__: {
    load(row) {
      registered = row
    },
  },
}

// 直接求值 bundle：它只在顶部调一次 load()。
// eslint-disable-next-line no-new-func
new Function(source)()

const results = []
function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  results.push({ name, ok, actual, expected })
}
function ok(name, condition, detail) {
  results.push({ name, ok: Boolean(condition), detail })
}

// ── 加载契约 ────────────────────────────────────────────────────────────────
ok('bundle registers a row', registered !== null)
check('bundle id', registered?.id, 'dsh-plugin-search')
ok('bundle exposes a factory', typeof registered?.factory === 'function')

const mod = registered.factory(() => {
  throw new Error('this bundle must not require anything')
})
ok('factory returns exports with apply', typeof mod.apply === 'function')
ok('exports expose __internals', typeof mod.__internals === 'object' && mod.__internals !== null)

const { splitQuery, matchesQuery, pickDict, format, DICT, SELECTORS, CSS } = mod.__internals

// ── splitQuery ─────────────────────────────────────────────────────────────
check('splitQuery: empty string', splitQuery(''), [])
check('splitQuery: whitespace only', splitQuery('   \t '), [])
check('splitQuery: null/undefined', splitQuery(null), splitQuery(undefined))
check('splitQuery: lowercases', splitQuery('TaskBoard'), ['taskboard'])
check('splitQuery: splits on whitespace', splitQuery('task board'), ['task', 'board'])
check('splitQuery: collapses runs of whitespace', splitQuery('  task   board  '), ['task', 'board'])
check('splitQuery: keeps CJK intact', splitQuery('看板'), ['看板'])
check('splitQuery: mixed CJK and latin', splitQuery('task 看板'), ['task', '看板'])

// ── matchesQuery：AND 语义、大小写不敏感、子串 ──────────────────────────────
ok('matchesQuery: empty terms matches everything', matchesQuery('anything', []) === true)
ok('matchesQuery: substring hit', matchesQuery('Plugin Manager', ['manager']) === true)
ok('matchesQuery: case-insensitive haystack', matchesQuery('Plugin Manager', ['PLUGIN']) === true)
ok('matchesQuery: case-insensitive term', matchesQuery('plugin manager', ['MaNaGeR']) === true)
ok('matchesQuery: miss', matchesQuery('Plugin Manager', ['sidebar']) === false)
ok('matchesQuery: AND requires every term', matchesQuery('plugin manager', ['plugin', 'manager']) === true)
ok('matchesQuery: AND fails on one missing term', matchesQuery('plugin manager', ['plugin', 'sidebar']) === false)
ok('matchesQuery: CJK substring', matchesQuery('搜索插件 · 看板', ['插件']) === true)
ok('matchesQuery: null haystack is safe', matchesQuery(null, ['x']) === false)
ok('matchesQuery: undefined haystack with no terms', matchesQuery(undefined, []) === true)

// ── 语言与文案 ─────────────────────────────────────────────────────────────
check('pickDict: zh-CN', pickDict('zh-CN') === DICT.zh, true)
check('pickDict: zh', pickDict('zh') === DICT.zh, true)
check('pickDict: ZH-Hans', pickDict('ZH-Hans') === DICT.zh, true)
check('pickDict: en falls back to en', pickDict('en-US') === DICT.en, true)
check('pickDict: unknown falls back to en', pickDict('de') === DICT.en, true)
check('pickDict: undefined falls back to en', pickDict(undefined) === DICT.en, true)

check('format: substitutes', format('{shown} / {total}', { shown: 3, total: 9 }), '3 / 9')
check('format: repeats are all replaced', format('{a}-{a}', { a: 'x' }), 'x-x')
check('format: missing key stays literal', format('{a}/{b}', { a: 1 }), '1/{b}')
check('format: no params is identity', format('plain', undefined), 'plain')

// ── 选择器契约（必须与 ui-plugin-manager 写在 JSX 上的 data-* 一致） ────────
check('panel selector', SELECTORS.panel, '[data-plugin-panel]')
check(
  'card selector covers packages and official items',
  SELECTORS.card,
  '[data-plugin-package], [data-plugin-item]',
)
check('group selector', SELECTORS.group, '[data-plugin-group]')
ok('group selector ignores the loading skeleton', SELECTORS.group.indexOf('loading') === -1)

// ── 样式：只用主题 token，且隐藏规则存在 ────────────────────────────────────
ok('CSS hides the hidden marker', CSS.includes('[data-dsh-plugin-search-hidden]'))
ok('CSS only uses dsw tokens for colors', !/#[0-9a-fA-F]{3,8}\b/.test(CSS.replace(/currentColor/g, '')))
ok('CSS keeps the search bar out of the window drag region', CSS.includes('-webkit-app-region: no-drag'))

// ── 宿主半：零副作用 ───────────────────────────────────────────────────────
const hostSource = readFileSync(join(here, '..', 'lib', 'index.js'), 'utf8')
ok('host apply is empty', /function apply\(\) \{\}/.test(hostSource))

// ── 输出 ───────────────────────────────────────────────────────────────────
const failed = results.filter((r) => !r.ok)
for (const r of results) {
  if (!r.ok) console.log(`FAIL  ${r.name}\n      actual:   ${JSON.stringify(r.actual ?? r.detail)}\n      expected: ${JSON.stringify(r.expected)}`)
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
if (failed.length > 0) process.exit(1)
