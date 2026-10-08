/**
 * 统计 promo.md 里每一版文案的正文字数。
 *
 * 口径（promo.md 开头也这么写）：**字数 = 中文字数 + 英文/数字词数**，
 * 即 Word / 一般平台的「字数」口径（CJK 每字算 1，连续的拉丁串算 1 词）。
 * 标点、空格、emoji 都不计。
 *
 * 不计入正文的：标题行、话题 tag、代码块里的安装命令、我自己的标注行（`>` 开头）。
 *
 * 同时把「含标点」的宽松口径也报出来，方便对照平台上限。
 *
 * 用法：node tools/count-promo.mjs [promo.md]
 */
import { readFileSync } from 'node:fs'

const file = process.argv[2] ?? 'promo.md'
const text = readFileSync(file, 'utf8')

// 按二级标题切段；每段里的 "> 正文 ..." 引用行带上标注值
const sections = []
let current = null
for (const line of text.split('\n')) {
  if (/^## /.test(line)) {
    current = { title: line.replace(/^## /, '').trim(), lines: [] }
    sections.push(current)
    continue
  }
  if (current) current.lines.push(line)
}

// emoji 与「零宽连接符序列」整体去掉（它们不是「字」）
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu

function stripNoise(lines) {
  const kept = []
  let inFence = false
  for (const raw of lines) {
    const line = raw.trim()
    if (/^```/.test(line)) { inFence = !inFence; continue }
    if (inFence) continue                       // 安装命令
    if (!line) continue
    if (/^>/.test(line)) continue               // 我自己写的标注行
    if (/^#{1,6} /.test(line)) continue         // 小标题
    if (/^\*\*标题\*\*/.test(line)) continue     // 平台标题行（文里已注明「标题另计」）
    if (/^#\S/.test(line) || /^#[\w\u4e00-\u9fff]/.test(line)) continue // 话题 tag
    if (/^\*\*.*\*\*$/.test(line)) continue     // 独立成行的加粗小标
    if (/^\|/.test(line)) continue              // 表格
    kept.push(line)
  }
  return kept.join('\n')
}

function count(s) {
  const clean = s.replace(EMOJI, '')
  const cjk = (clean.match(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) ?? []).length
  // 去掉 CJK 后，把连续的拉丁字母/数字算作一个词
  const words = (clean.replace(/[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, ' ')
    .match(/[A-Za-z0-9][A-Za-z0-9._:\/+-]*/g) ?? []).length
  const punct = (clean.match(/[，。！？、：；「」（）…—,.!?;:()"'`~\-]/g) ?? []).length
  return { total: cjk + words, cjk, words, punct }
}

console.log(`文件：${file}`)
console.log('口径：字数 = 中文字 + 英文/数字词（标点、emoji、安装命令、标题均不计）\n')
for (const s of sections) {
  if (!/即刻|100 字|小红书|B 站|五句话/.test(s.title)) continue
  const body = stripNoise(s.lines)
  if (!body.trim()) continue
  const c = count(body)
  console.log(`── ${s.title}`)
  console.log(`   字数 ${c.total}   （中文 ${c.cjk} + 词 ${c.words}）；含标点则 ${c.total + c.punct}`)
  // 把标注行里的声明值抓出来对比
  const claim = s.lines.join('\n').match(/正文\s*(\d+)\s*字/)
  if (claim) {
    const said = Number(claim[1])
    const delta = c.total - said
    const verdict = delta === 0 ? '✅ 与标注一致' : `⚠️  标注写 ${said}，实测 ${c.total}（差 ${delta > 0 ? '+' : ''}${delta}）`
    console.log(`   标注：${said} 字  →  ${verdict}`)
  }
  console.log('')
}
