/**
 * 把帖子发到官方仓库的 Discussions。
 *
 * 为什么是 Discussions 而不是 issue / PR（写进代码里，免得日后有人「顺手」改错）：
 *   - deepseek-ai/deepseek-harness 的 Issues 是**关闭**的（hasIssuesEnabled=false），
 *     根本提不了 issue；
 *   - CONTRIBUTING.md 明确写着「我们目前无法接受外部 PR」；
 *   - 官方给出的渠道就是 GitHub Discussions，且分类里有 `ideas`。
 *
 * 用法：node tools/post-discussion.mjs <titleFile|--title "标题"> <bodyFile> [--dry-run]
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const args = process.argv.slice(2)
const DRY = args.includes('--dry-run')
let title = null
let bodyFile = null
for (let i = 0; i < args.length; i += 1) {
  if (args[i] === '--title') title = args[++i]
  else if (args[i] === '--dry-run') continue
  else if (!bodyFile) bodyFile = args[i]
}
if (!title || !bodyFile) {
  console.error('usage: node tools/post-discussion.mjs --title "..." <bodyFile> [--dry-run]')
  process.exit(2)
}

const body = readFileSync(bodyFile, 'utf8')
console.log(`标题: ${title}`)
console.log(`正文: ${body.length} 字符, ${body.split('\n').length} 行`)
if (DRY) {
  console.log('\n(--dry-run：未发布)')
  process.exit(0)
}

const token = execSync('gh auth token', { encoding: 'utf8' }).trim()
const gql = async (query, variables) => {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'post-discussion' },
    body: JSON.stringify({ query, variables }),
  })
  const j = await r.json()
  if (j.errors) throw new Error(JSON.stringify(j.errors, null, 2))
  return j.data
}

// 取 repoId 与 ideas 分类 id（不写死，避免仓库迁移后失效）
const meta = await gql(`{
  repository(owner:"deepseek-ai", name:"deepseek-harness") {
    id
    discussionCategories(first: 20) { nodes { id slug } }
  }
}`)
const repoId = meta.repository.id
const ideas = meta.repository.discussionCategories.nodes.find((c) => c.slug === 'ideas')
if (!repoId || !ideas) throw new Error('cannot resolve repoId / ideas category')

const created = await gql(
  `mutation($repoId: ID!, $catId: ID!, $title: String!, $body: String!) {
    createDiscussion(input: { repositoryId: $repoId, categoryId: $catId, title: $title, body: $body }) {
      discussion { number url title category { name } createdAt }
    }
  }`,
  { repoId, catId: ideas.id, title, body },
)

const d = created.createDiscussion.discussion
console.log(`\n已发布: #${d.number}  [${d.category.name}]  ${d.title}`)
console.log(d.url)
