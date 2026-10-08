/**
 * 用 GitHub git-data API 直接提一个收录 PR（避免克隆 145MB 的清单仓库）。
 *
 *   1. 读 fork 的 main HEAD 作为 base
 *   2. 建 blob（条目文件内容）→ tree（base_tree 上只加这一个文件）→ commit
 *   3. 建分支 ref
 *   4. 开 PR 到上游 awesome-dsh-plugin:main
 *
 * 用法：node open-submission-pr.mjs <owner> <branch> <entryFile> <prBodyFile>
 * token 走 `gh auth token`，不写进任何文件。
 */
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const [, , FORK_OWNER, BRANCH, ENTRY_FILE, BODY_FILE] = process.argv
const UPSTREAM_OWNER = 'awesome-dsh-plugin'
const REPO = 'awesome-dsh-plugin'
const ENTRY_PATH = 'data/plugins/huangxp12__dsh-plugin-search.yml'

const token = execSync('gh auth token', { encoding: 'utf8' }).trim()

async function api(path, init = {}) {
  const res = await fetch(`https://api.github.com/${path}`, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'user-agent': 'submission-script',
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  if (!res.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}\n${typeof body === 'string' ? body : JSON.stringify(body, null, 2)}`)
  }
  return body
}

// ── 1. base：fork 的 main HEAD ──────────────────────────────────────────────
const ref = await api(`repos/${FORK_OWNER}/${REPO}/git/ref/heads/main`)
const baseSha = ref.object.sha
const baseCommit = await api(`repos/${FORK_OWNER}/${REPO}/git/commits/${baseSha}`)
console.log(`base: ${baseSha.slice(0, 8)} (${FORK_OWNER}/${REPO}@main)`)

// ── 2. blob → tree → commit ────────────────────────────────────────────────
const content = readFileSync(ENTRY_FILE, 'utf8')
const blob = await api(`repos/${FORK_OWNER}/${REPO}/git/blobs`, {
  method: 'POST',
  body: JSON.stringify({ content, encoding: 'utf8' }),
})
console.log(`blob: ${blob.sha.slice(0, 8)} (${content.length} bytes)`)

const tree = await api(`repos/${FORK_OWNER}/${REPO}/git/trees`, {
  method: 'POST',
  // base_tree + 一个 path：这次提交只新增这一个文件，别的条目一个都不碰（评审会检查这一点）
  body: JSON.stringify({
    base_tree: baseCommit.tree.sha,
    tree: [{ path: ENTRY_PATH, mode: '100644', type: 'blob', sha: blob.sha }],
  }),
})
console.log(`tree: ${tree.sha.slice(0, 8)}`)

const commit = await api(`repos/${FORK_OWNER}/${REPO}/git/commits`, {
  method: 'POST',
  body: JSON.stringify({
    message: `Add huangxp12/dsh-plugin-search entry\n\nKeyword search field for the Plugins page.`,
    tree: tree.sha,
    parents: [baseSha],
  }),
})
console.log(`commit: ${commit.sha.slice(0, 8)}`)

// ── 3. 分支 ref（已存在就更新，便于重跑） ──────────────────────────────────
try {
  await api(`repos/${FORK_OWNER}/${REPO}/git/refs`, {
    method: 'POST',
    body: JSON.stringify({ ref: `refs/heads/${BRANCH}`, sha: commit.sha }),
  })
  console.log(`branch created: ${BRANCH}`)
} catch (error) {
  if (!/422/.test(error.message)) throw error
  await api(`repos/${FORK_OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha, force: true }),
  })
  console.log(`branch updated: ${BRANCH}`)
}

// 确认这次提交真的只碰了一个文件
const files = await api(`repos/${FORK_OWNER}/${REPO}/commits/${commit.sha}`)
console.log(`changed files in this commit: ${files.files.map((f) => `${f.status} ${f.filename}`).join(', ')}`)

// ── 4. 开 PR ───────────────────────────────────────────────────────────────
const body = readFileSync(BODY_FILE, 'utf8')
const pr = await api(`repos/${UPSTREAM_OWNER}/${REPO}/pulls`, {
  method: 'POST',
  body: JSON.stringify({
    title: 'Add huangxp12/dsh-plugin-search entry',
    head: `${FORK_OWNER}:${BRANCH}`,
    base: 'main',
    body,
    maintainer_can_modify: true,
  }),
})
console.log(`\nPR: ${pr.html_url}`)
console.log(`state: ${pr.state}, mergeable_state: ${pr.mergeable_state ?? '(pending)'}`)
