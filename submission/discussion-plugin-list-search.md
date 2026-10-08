## 问题

**侧栏 → 插件**（`ui-plugin-manager`）这一页没有列表级搜索。这一页有两种分组：**官方**（装机自带、可开关的 bundle 与注册了配置页的官方插件）和**已安装**（profile 里的 bundle）。我这边两组合计 20 多张卡片，想找其中一个只能从上到下用眼睛扫。卡片是按名字排的，所以能靠记忆定位——但前提是你还记得名字。

## 澄清一个前提

这一页**并非完全没有搜索**，说法要精确，否则不成立：

- `ui-plugin-manager` 里确实有一个 `type: "search"` 的输入框，但它在**bundle 详情页**内部，过滤的是**该 bundle 自身的插件行**，而且只在 `ROW_FILTER_THRESHOLD = 10`（行数超过 10）时才条件渲染。它匹配 `rowId` 与 `moduleName`，文案是「筛选组件 / 没有匹配的组件。」——量词是**组件**，不是插件。
- 设置页 **设置 → 插件 → 插件清单**（`ui-settings-plugin-inventory`）**已经有**一套完整的搜索：`matches()` 匹配 `moduleName`、`entryId`、`title`、`description`，带 `emptySearch` 空状态与本地化文案。

所以缺的不是「搜索这个能力」，而是**把它用在插件页的列表层**。这也正是我建议的落点：设置页那份实现已经是现成的模式，包括匹配范围（技术身份 + 本地化文案）与空状态文案。

## 建议

在插件页列表层加一条搜索框，与两个分组叠加：

- **匹配范围**：沿用设置页的口径 —— bundle 的包名 / Loader 条目 id，加上卡片上显示的标题与描述（描述目前已经渲染在卡片上，所以不需要新数据）。
- **整组隐藏**：某组一条都没命中时，连组标题与计数一起收起，而不是留下「官方 0」。「官方」是装机自带的固定集合，长期为空会让这一页看起来像坏了一半。
- **空状态**：区分「搜索无命中」与「真的没有插件」——两个不同的句子，设置页的 `emptySearch` 已经是这个区分。
- **不改数据**：只影响当前视图的显示，不触发额外的 Remote 请求，不落盘偏好，也不改变任何插件的启用状态。

## 参考实现

我写了一个第三方插件，走 DOM 注入实现同一件事。它不是提交，只是一个**可参考的行为样例**：

- https://github.com/huangxp12/dsh-plugin-search

它依赖 `[data-plugin-panel]` / `[data-plugin-group]` / `[data-plugin-package]` / `[data-plugin-item]` 这组 `data-*` 契约注入搜索框，并用 `MutationObserver` 跟随 React 重挂。**这正是不该由第三方长期承担这件事的理由**：DOM 契约不是稳定接口，外壳改版就可能失效——而搜索本来就该由拥有这一页的人渲染出来。

## 为什么发在这里

[CONTRIBUTING.md](https://github.com/deepseek-ai/deepseek-harness/blob/master/CONTRIBUTING.md) 写明目前不接受外部 PR，Issues 也是关闭的，所以按指引发到 Discussions。如果这条收到足够多的赞、团队愿意采纳，我很乐意把它整理成符合仓库规范的实现（双语文案、组件测试、settings-chrome 快照那一套），随 PR 开放时提交。

## 相关但不重复

- [#1017](https://github.com/deepseek-ai/deepseek-harness/discussions/1017) 与 [#4810](https://github.com/deepseek-ai/deepseek-harness/discussions/4810) 都是**设置页插件清单**的分类/启用状态筛选，且都写着「与搜索叠加生效」——它们的前提正是设置页已有搜索。这里说的是**另一个页面**：侧栏插件页的列表层。
- [#1857](https://github.com/deepseek-ai/deepseek-harness/discussions/1857) 提到设置页插件列表没显示描述，与人眼定位有关，但同样不是这一页。

---

## English

**Problem.** The sidebar **Plugins** page (`ui-plugin-manager`) has no list-level search. It renders two groups — **Official** (shipped bundles plus official plugins that registered a config page) and **Installed** — and with 20+ cards across them, finding one means scanning the whole list by eye.

**One clarification, so the claim is exact.** The page is not entirely without search, and saying otherwise would be wrong:

- `ui-plugin-manager` has a `type: "search"` input, but it lives **inside a bundle's detail page**, filters **that bundle's own rows**, and only renders when `ROW_FILTER_THRESHOLD = 10` is exceeded. It matches `rowId` / `moduleName`, and its copy says 组件 (component), not plugin.
- Settings → Plugins → Plugin list (`ui-settings-plugin-inventory`) **already has** a complete one: `matches()` covers `moduleName`, `entryId`, `title`, `description`, with an `emptySearch` state and localized copy.

What is missing is not the capability but **applying it at the Plugins page's list level** — which is what makes this a small request: the settings page is the pattern to follow, matching scope and empty-state copy included.

**Proposal.** A search field on the list level, composing with both groups: match the settings page's scope (package name / Loader entry id, plus the title and description already rendered on the card, so no new data is needed); hide a group together with its heading and count when nothing in it matches, rather than leaving an empty "Official 0"; distinguish "no match" from "no plugins"; and touch no state — no extra Remote request, no persisted preference, no change to enablement.

**Reference implementation.** I built a third-party plugin that does this by DOM injection, at https://github.com/huangxp12/dsh-plugin-search — a behaviour sample, not a submission. It targets `[data-plugin-panel]` / `[data-plugin-group]` / `[data-plugin-package]` / `[data-plugin-item]` and follows React remounts with a `MutationObserver`. That is precisely why it should not be a third party's job long-term: those `data-*` attributes are not a stable interface, and the page's owner can render this natively.

**Why here.** CONTRIBUTING.md states external PRs are not accepted at the moment and Issues are disabled, so this follows the documented route. If it gathers enough support, I am happy to prepare it to the repository's standards (filter composition, bilingual copy, component tests, settings-chrome snapshot) for a PR once those open.

**Related but not duplicates.** #1017 and #4810 both concern the **settings** plugin list, and both say their filter composes with search — presupposing the search that page already has. #1857 is about descriptions in that same list. This is a different page: the sidebar Plugins page's list level.
