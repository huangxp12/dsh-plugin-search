/**
 * 在官方仓库的 Discussions 里查重（提重复内容会浪费小团队的注意力）。
 *
 * 用法：node tools/search-discussions.mjs "关键词1" "关键词2" ...
 */
import { execSync } from 'node:child_process'

const QUERIES = process.argv.slice(2)
if (QUERIES.length === 0) {
  console.error('usage: node tools/search-discussions.mjs "term" ["term"...]')
  process.exit(2)
}

const token = execSync('gh auth token', { encoding: 'utf8' }).trim()

async function graphql(query) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'discussion-search',
    },
    body: JSON.stringify({ query }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2))
  return json.data
}

const seen = new Map()
for (const term of QUERIES) {
  // 查询串整体作为 GraphQL 字符串参数传，避免 shell 引号把关键词拆开
  const q = `repo:deepseek-ai/deepseek-harness ${term} in:title`
  const data = await graphql(`{
    search(query: ${JSON.stringify(q)}, type: DISCUSSION, first: 10) {
      discussionCount
      nodes { ... on Discussion { number title url category { name } updatedAt comments { totalCount } } }
    }
  }`)
  const nodes = data.search.nodes ?? []
  console.log(`\n=== "${term}"  (命中 ${data.search.discussionCount}) ===`)
  if (nodes.length === 0) {
    console.log('  （无）')
    continue
  }
  for (const n of nodes) {
    if (seen.has(n.number)) continue
    seen.set(n.number, n)
    console.log(`  #${n.number} [${n.category?.name}] ${n.title}`)
    console.log(`        ${n.url}  评论 ${n.comments?.totalCount ?? 0}`)
  }
}

console.log(`\n去重后共 ${seen.size} 条相关讨论。`)
