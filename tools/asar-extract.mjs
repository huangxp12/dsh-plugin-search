// Minimal asar reader: list entries or extract one file to stdout.
// Usage:
//   node asar-extract.mjs <archive> list [substring]
//   node asar-extract.mjs <archive> get <inner/path>
import { open } from 'node:fs/promises'

const [, , archivePath, command, arg] = process.argv
if (!archivePath || !command) {
  console.error('usage: asar-extract.mjs <archive> list [substring] | get <inner/path>')
  process.exit(2)
}

const fh = await open(archivePath, 'r')

// Header layout: uint32 pickle-length (4), uint32 header-size, then the pickle.
const sizeBuf = Buffer.alloc(8)
await fh.read(sizeBuf, 0, 8, 0)
const headerSize = sizeBuf.readUInt32LE(4)

const raw = Buffer.alloc(headerSize)
await fh.read(raw, 0, headerSize, 8)

// The pickle holds a length-prefixed JSON payload; locate its opening brace
// rather than assuming a fixed prefix length.
const start = raw.indexOf(0x7b) // '{'
if (start < 0) throw new Error('no JSON object found in asar header')
// Find the matching end by taking the declared length when it looks sane.
const declared = raw.readUInt32LE(start - 4)
let jsonText
if (declared > 0 && start - 4 + declared <= raw.length) {
  jsonText = raw.subarray(start, start + declared).toString('utf8')
} else {
  jsonText = raw.subarray(start).toString('utf8')
}
let header
try {
  header = JSON.parse(jsonText)
} catch {
  // Fall back: trim trailing NULs/padding by scanning for the last '}'
  const end = raw.lastIndexOf(0x7d)
  header = JSON.parse(raw.subarray(start, end + 1).toString('utf8'))
}

const baseOffset = 8 + headerSize

function walk(node, prefix, out) {
  for (const [name, child] of Object.entries(node.files ?? {})) {
    const path = prefix ? `${prefix}/${name}` : name
    if (child.files) walk(child, path, out)
    else out.push({ path, size: child.size ?? 0, offset: child.offset ? Number(child.offset) : undefined })
  }
}

const all = []
walk(header, '', all)

if (command === 'list') {
  const filtered = arg ? all.filter(e => e.path.includes(arg)) : all
  for (const e of filtered) console.log(`${String(e.size).padStart(10)}  ${e.path}`)
  console.error(`\n${filtered.length} of ${all.length} entries`)
} else if (command === 'get') {
  const entry = all.find(e => e.path === arg)
  if (!entry || entry.offset === undefined) {
    console.error(`not found: ${arg}`)
    process.exit(1)
  }
  const buf = Buffer.alloc(entry.size)
  await fh.read(buf, 0, entry.size, baseOffset + entry.offset)
  process.stdout.write(buf)
}

await fh.close()
