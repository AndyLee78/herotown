// Rasterize public/favicon.svg into the PWA icons committed under public/icons.
// Run: node tools/render-pwa-icons.mjs
// @resvg/resvg-js is installed into tools/.icon-deps (gitignored) the first time.
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const resvgEntry = resolve(root, 'tools/.icon-deps/node_modules/@resvg/resvg-js/index.js')
if (!existsSync(resvgEntry)) {
  const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
  const install = spawnSync(npm, ['install', '--prefix', resolve(root, 'tools/.icon-deps'), '@resvg/resvg-js'], { stdio: 'inherit' })
  if (install.status !== 0) {
    process.exit(install.status ?? 1)
  }
}
const { Resvg } = await import(pathToFileURL(resvgEntry).href)

const shield = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8')
const inner = shield.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').trim()
const sky = '#cfe6f2'

function svg(size, pad) {
  const scale = (size - pad * 2) / 76
  const x = (size - 72 * scale) / 2
  const y = (size - 76 * scale) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${sky}"/>
    <g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${scale.toFixed(4)})">${inner}</g>
  </svg>`
}

const out = resolve(root, 'public/icons')
mkdirSync(out, { recursive: true })
const jobs = [
  ['icon-192.png', 192, 16],
  ['icon-512.png', 512, 40],
  ['icon-maskable-512.png', 512, 72],
  ['apple-touch-180.png', 180, 16],
]
for (const [name, size, pad] of jobs) {
  const png = new Resvg(svg(size, pad), { fitTo: { mode: 'width', value: size } }).render().asPng()
  writeFileSync(resolve(out, name), png)
  console.log(`${name} ${png.length} bytes`)
}
