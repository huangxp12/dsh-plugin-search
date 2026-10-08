/**
 * 读一条 Discussion 的正文与全部评论（查重、引用时用）。
 *
 * 用法：node tools/read-discussion.mjs <number>
 */
import { execSync } from 'node:child_process'

const number = Number(process.argv[2])
if (!number) {
  console.error('usage: node tools/read-discussion.mjs <number>')
  process.exit(2)
}

const token = execSync('gh auth token', { encoding: 'utf8' }).trim()

async function graphql(query) {
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'read-discussion',
    },
    body: JSON.stringify({ query }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(JSON.stringify(json.errors, null, 2))
  return json.data
}

const data = await graphql(`{
  repository(owner: "deepseek-ai", name: "deepseek-harness") {
    discussion(number: ${number}) {
      number title url createdAt updatedAt
      author { login }
      category { name }
      upvoteCount
      body
      comments(first: 30) {
        totalCount
        nodes { author { login } createdAt body upvoteCount isAnswer }
      }
    }
  }
}`)

const d = data.repository.discussion
console.log(`${'='.repeat(72)}`)
console.log(`#${d.number}  [${d.category.name}]  ${d.title}`)
console.log(`${d.url}`)
console.log(`作者 ${d.author?.login}  创建 ${d.createdAt}  更新 ${d.updatedAt}  👍 ${d.upvoteCount}`)
console.log(`${'='.repeat(72)}\n`)
console.log(d.body)

console.log(`\n${'-'.repeat(72)}`)
console.log(`评论 ${d.comments.totalCount} 条`)
console.log(`${'-'.repeat(72)}`)
for (const c of d.comments.nodes) {
  console.log(`\n@${c.author?.login}  ${c.createdAt}  👍 ${c.upvoteCount}${c.isAnswer ? '  ✅答案' : ''}`)
  console.log(c.body)
}
