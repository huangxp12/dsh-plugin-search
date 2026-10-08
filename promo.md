# dsh-plugin-search 推广词

按平台分四版，**字数都是脚本实测值**（`node tools/count-promo.mjs`），口径为
「字数 = 中文字 + 英文/数字词」，标点与 emoji 不计。

## 安装命令（四版通用）

```
dsh plugin --profile web add github:huangxp12/dsh-plugin-search
```

| 要点 | 说明 |
| --- | --- |
| `--profile web` **不能省** | `dsh plugin` 把它声明为必需项，省略会直接报 `error: required option '--profile <name>' not specified`。官方市场文档、`dsh web` 用的都是 `web` 这个 profile 名 |
| `github:` 前缀 | 本插件没有发 npm 包，装的是仓库 |
| 装完刷新页面 | 前端插件，无需重启 |

---

## 即刻 · 三句话

DSH 的插件页没有搜索框：装到二十几个，想找一个只能一行行用眼睛扫。

我给它补了一条 —— 输入就实时筛卡片，标题、描述、包名都参与匹配，多个关键词叠加生效。

一行装好：`dsh plugin --profile web add github:huangxp12/dsh-plugin-search`

> 正文 74 字（含标点 95）· 3 句

---

## 约 100 字版 · 知乎

**标题**：DSH 的插件页没有搜索，我给它补了一个

DSH 的插件页没有搜索。装到几十个，找一个只能靠眼睛扫。

补了个搜索框：输入即筛，标题、描述、包名都参与匹配，空格分隔的多个词是 AND；某组一条都没命中时，连组标题一起收起。

它只改显示：不发请求、零依赖、不动插件开关。

```
dsh plugin --profile web add github:huangxp12/dsh-plugin-search
```

> 正文 89 字（含标点 107）· 标题与命令另计

---

## 小红书

**标题**：DSH 插件多到找不到？我给它加了个搜索框

🔍 DSH 插件装多了是真的难找
插件页几十张卡片，想找一个只能一行行扫👀

我给它加了个搜索框：
打字就实时筛，标题、描述、包名都能命中
整组没命中会自己藏起来，不留「官方 0」那种空壳
不发请求、零依赖、不碰插件开关✅

👉 `dsh plugin --profile web add github:huangxp12/dsh-plugin-search`

#DeepSeekHarness #DSH #AI工具 #程序员 #效率工具 #开源

> 正文 93 字（含标点 113）· 配图建议用仓库里的 `assets/screenshot-1.png`

---

## B 站（动态 / 视频简介）

**标题**：给 DSH 插件页加了个搜索框

DSH 插件页居然没有搜索😭 装到几十个全靠眼睛扫

给整了个搜索框：打字就实时筛，标题、描述、包名都能命中

不发请求、零依赖，装完刷新就能用✨

👉 `dsh plugin --profile web add github:huangxp12/dsh-plugin-search`

#DeepSeekHarness #DSH #程序员 #开源

> 正文 63 字（含标点 79）· 适合放动态，也是视频前 30 秒的口播底稿

---

## 备用 · 一句话（评论区 / 回复用）

DSH 插件页没搜索，装多了找不动，我给它加了个搜索框，一行命令装上：`dsh plugin --profile web add github:huangxp12/dsh-plugin-search`

---

## 备用 · 五句话版（即刻评论区展开 / 群分享）

1. DSH 的插件页没有搜索框 —— 装到二十几个，想找一个只能一行行扫。
2. 我给它补了一条：输入就实时筛卡片。
3. 标题、描述、包名都参与匹配，空格分隔的多个关键词叠加生效。
4. 某组一条都没命中时，连组标题和计数一起收起，不留空壳。
5. 不发请求、零依赖、不改插件开关；装完刷新即用。

```
dsh plugin --profile web add github:huangxp12/dsh-plugin-search
```

> 正文 114 字（含标点 139）· 5 句

---

## 诚实性备注（发之前请过一眼）

以下每条都按代码与实测核对过，**边界也一并写明** —— 推广词里别说得比这更满：

- **「零依赖」指运行时**：插件本体不 `require` 任何东西（`lib/client.js` 里连 react 都不用）。
  但仓库 `devDependencies` 里有 jsdom 与 cordis，仅测试用。说「零依赖」没问题，别延伸成
  「仓库里没有依赖文件」。
- **「不发请求」准确**：不做任何网络请求，也不读写会话日志。已作为断言写进单元测试。
- **「不动插件开关」准确**：只改「显示哪几张卡片」并挂一条搜索条，不碰 Loader 的启用状态。
- **「只改显示」的准确说法**：它确实会给卡片加/去一个 `data-dsh-plugin-search-hidden`
  属性来隐藏。**搜索框为空时所有标记都会摘掉、DOM 与外壳原样一致** —— 用这句最准，
  不要写成「完全不碰 DOM」。
- **别承诺「中文分词」**：匹配是子串匹配，`看板` 命中是因为它本身就是连续子串。
  中文完全可用，但不要写成「智能分词」。
- **数字经得起查**：41（单元）/ 47（jsdom）/ 43（真实浏览器）/ 17（端到端）均为实测值。
