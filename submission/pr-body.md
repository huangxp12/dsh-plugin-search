<!-- Thanks for contributing! Quick checklist / 提交前快速自查 -->

- [x] I added **one file** at `data/plugins/huangxp12__dsh-plugin-search.yml` — that single file is the whole submission. The READMEs are regenerated on `main` after merge: don't edit them by hand, and you don't need to commit them either / 我新增了**唯一一个** `data/plugins/huangxp12__dsh-plugin-search.yml` 文件——**这一个文件就是全部投稿**。README 会在合并后由 `main` 自动重新生成：不要手工编辑，也不需要提交
- [x] My repo's `package.json` declares **`dsh.bundle`** (not just `dsh.client`) — [example](../blob/main/contributing.md) / 仓库 `package.json` 已声明 `dsh.bundle`（只有 `dsh.client` 无法安装）
- [x] My repo is at least **1 day old** / 仓库创建满 1 天
- [x] `category` is one of `agi ui usage theme model identity session memory tools wsl browser vision voice docs skill workflow git notify dev security remote market fun` ([full list with descriptions](../blob/main/contributing.md)), and themes/skins go under `theme` / `category` 取值正确（完整清单见 contributing.md），主题/皮肤类请用 `theme`
- [x] Description states what the plugin does, no superlatives / 描述只说功能，不带营销词
- [x] My repo has the `dsh-plugin` topic / 仓库已打 `dsh-plugin` topic

**Recommended (not required) / 推荐但不强制：**

- [x] 🔗 Declare official `@deepseek-ai/*` packages as `peerDependencies` (not `dependencies`) — [as done here](https://github.com/huangxp12/dsh-plugin-search/blob/main/package.json)
- [x] 🖼️ Screenshots declared in my own repository via [`screenshots.json`](https://github.com/huangxp12/dsh-plugin-search/blob/main/screenshots.json)

---

## What it does

Adds a keyword search field to the **Plugins** page (`ui-plugin-manager`). Type and the
installed/official plugin cards filter as you go.

The claim in the entry is deliberately narrow, so here is exactly what the code does:

- **Match scope** — for each card, `card.textContent` plus the `data-plugin-package` /
  `data-plugin-item` value behind it. That is the visible title, description and
  "Experimental" tag, plus the package name or registration id.
- **Matching** — case-insensitive substring; space-separated terms are AND, so every term
  must appear. ([`splitQuery`](https://github.com/huangxp12/dsh-plugin-search/blob/main/lib/client.js) / `matchesQuery`)
- A group left with no hits is hidden along with its heading and count; the field shows
  `shown / total`.

The host half's `apply()` is empty — it exists so the package is an enabled Loader entry,
which is what makes a client bundle discoverable.

## Why DOM injection rather than a slot

`ui-plugin-manager` declares four extension points: `plugins.item`,
`plugins.bundle.config`, `plugins.row.config`, `plugins.detail.{actions,badge,section}`.
None is a list-level toolbar, and the page's `main` slot is keyed with `"plugins"` already
taken by the page itself. The slot route would mean shadowing shipped UI, so instead this
targets the `data-*` attributes the page writes in its own JSX
(`data-plugin-panel`, `data-plugin-group`, `data-plugin-package`, `data-plugin-item`) and
uses **no** hashed CSS-module class names. If the shell changes, the worst case is a
missing search field rather than a broken page.

## Verification

Four suites, all run locally against this repository:

| Suite | Result |
| --- | --- |
| `test/unit.test.mjs` — query splitting, matching, copy, loading contract | 41/41 |
| `test/dom.test.mjs` — jsdom, fixture copied from `ui-plugin-manager`'s real structure | 47/47 |
| `test/dom-harness.html` — the same fixture, run in Chrome | 43/43 |
| `tools/verify-live.mjs` — end-to-end against a running host | 17/17 |

The end-to-end suite confirms a running DSH reports the package in its boot graph, serves
its bundle byte-identically to the file in the repo, and that `/` and `/api` auth are
unchanged (`/plugins/**` is deliberately unauthenticated in DSH, identically for an
existing plugin — checked as a control).

## Notes

- No dependencies at all: the browser half is a hand-written bundle, since a DSH client
  artifact is a `window.__ModuleLoader__.load({id, factory})` wrapper and this plugin
  needs no React.
- No network requests, no session-log access, no changes to plugin enablement or
  configuration. With an empty query the page's DOM is exactly what the shell rendered.
