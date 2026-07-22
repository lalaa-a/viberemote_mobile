/**
 * generate-app-icons.mjs — build the Android + iOS app icons from the Vibe Remote brand mark.
 *
 *   node scripts/generate-app-icons.mjs
 *
 * The mark is the same artwork as the bottom-nav terminal tab (src/assets/icons/chats.svg)
 * and the desktop logo, so the launcher icon matches the in-app icon.
 *
 * Outputs:
 *   android/app/src/main/res/mipmap-<d>/ic_launcher.png            (rounded square, legacy)
 *   android/app/src/main/res/mipmap-<d>/ic_launcher_round.png      (circle, legacy)
 *   android/app/src/main/res/mipmap-<d>/ic_launcher_foreground.png (adaptive foreground, transparent)
 *   android/app/src/main/res/mipmap-anydpi-v26/ic_launcher{,_round}.xml
 *   android/app/src/main/res/values/ic_launcher_background.xml
 *   ios/AgentControl/Images.xcassets/AppIcon.appiconset/*.png + Contents.json
 */
import sharp from 'sharp'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

// Brand: app background navy + the green the logo is drawn in throughout the app.
const BG = '#082134'
const FG = '#27E07E'

// The Vibe Remote mark (24x24 viewBox) — identical paths to src/assets/icons/chats.svg.
const LOGO = [
  'M3.08606 17.509C3.17183 17.1193 3.1391 16.7129 2.99206 16.342C1.96883 14.219 1.72831 11.8027 2.31295 9.51964C2.89759 7.23654 4.26981 5.23329 6.1875 3.86334C8.10519 2.49338 10.4451 1.84475 12.7944 2.0319C15.1438 2.21904 17.3515 3.22992 19.0281 4.88619C20.7048 6.54247 21.7425 8.73769 21.9584 11.0845C22.1742 13.4314 21.5542 15.7791 20.2078 17.7134C18.8613 19.6477 16.875 21.0442 14.5992 21.6567C12.3234 22.2692 9.90444 22.0582 7.76906 21.061C7.41859 20.9279 7.03777 20.8961 6.67006 20.969L3.25706 21.967C3.09242 22.0107 2.91935 22.0116 2.75426 21.9697C2.58917 21.9277 2.43753 21.8443 2.31372 21.7273C2.18992 21.6103 2.09805 21.4636 2.04683 21.3011C1.99561 21.1387 1.98674 20.9658 2.02106 20.799L3.08606 17.509Z',
  'M11.5 16.875H16.5',
  'M6.5 15.625L10.25 11.875L6.5 8.125',
]

/** Build an icon SVG: optional background shape + the centred mark. */
function iconSvg({ size, shape = 'square', bg = null, logoFrac = 0.52, stroke = FG }) {
  const s = size * logoFrac
  const o = (size - s) / 2
  const k = s / 24                       // source viewBox is 24x24
  let bgEl = ''
  if (bg) {
    if (shape === 'circle')       bgEl = `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${bg}"/>`
    else if (shape === 'rounded') bgEl = `<rect width="${size}" height="${size}" rx="${size * 0.2237}" fill="${bg}"/>`
    else                          bgEl = `<rect width="${size}" height="${size}" fill="${bg}"/>`
  }
  const paths = LOGO.map((d) => `<path d="${d}"/>`).join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`
       + bgEl
       + `<g transform="translate(${o} ${o}) scale(${k})" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</g>`
       + `</svg>`
}

async function render(svg, outPath, { flatten = false } = {}) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  let img = sharp(Buffer.from(svg))
  if (flatten) img = img.flatten({ background: BG })   // iOS icons must have no alpha
  await img.png().toFile(outPath)
}

const write = (p, text) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, text) }

// ── Android ───────────────────────────────────────────────────────────────────
// Legacy icon sizes (dp==px at mdpi) and the 108dp adaptive foreground canvas.
const ANDROID = [
  { d: 'mdpi',    legacy: 48,  fg: 108 },
  { d: 'hdpi',    legacy: 72,  fg: 162 },
  { d: 'xhdpi',   legacy: 96,  fg: 216 },
  { d: 'xxhdpi',  legacy: 144, fg: 324 },
  { d: 'xxxhdpi', legacy: 192, fg: 432 },
]

async function android() {
  const res = path.join(ROOT, 'android/app/src/main/res')
  for (const { d, legacy, fg } of ANDROID) {
    const dir = path.join(res, `mipmap-${d}`)
    await render(iconSvg({ size: legacy, shape: 'rounded', bg: BG, logoFrac: 0.52 }), path.join(dir, 'ic_launcher.png'))
    await render(iconSvg({ size: legacy, shape: 'circle',  bg: BG, logoFrac: 0.50 }), path.join(dir, 'ic_launcher_round.png'))
    // Adaptive foreground: transparent, mark kept well inside the 66/108 safe zone.
    await render(iconSvg({ size: fg, bg: null, logoFrac: 0.40 }), path.join(dir, 'ic_launcher_foreground.png'))
  }

  const adaptive = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`
  write(path.join(res, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive)
  write(path.join(res, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive)
  write(path.join(res, 'values/ic_launcher_background.xml'),
`<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BG}</color>
</resources>
`)
  console.log('android: legacy + round + adaptive foreground written')
}

// ── iOS ───────────────────────────────────────────────────────────────────────
const IOS = [
  { file: 'Icon-20@2x.png',  px: 40,   idiom: 'iphone',        size: '20x20',     scale: '2x' },
  { file: 'Icon-20@3x.png',  px: 60,   idiom: 'iphone',        size: '20x20',     scale: '3x' },
  { file: 'Icon-29@2x.png',  px: 58,   idiom: 'iphone',        size: '29x29',     scale: '2x' },
  { file: 'Icon-29@3x.png',  px: 87,   idiom: 'iphone',        size: '29x29',     scale: '3x' },
  { file: 'Icon-40@2x.png',  px: 80,   idiom: 'iphone',        size: '40x40',     scale: '2x' },
  { file: 'Icon-40@3x.png',  px: 120,  idiom: 'iphone',        size: '40x40',     scale: '3x' },
  { file: 'Icon-60@2x.png',  px: 120,  idiom: 'iphone',        size: '60x60',     scale: '2x' },
  { file: 'Icon-60@3x.png',  px: 180,  idiom: 'iphone',        size: '60x60',     scale: '3x' },
  { file: 'Icon-1024.png',   px: 1024, idiom: 'ios-marketing', size: '1024x1024', scale: '1x' },
]

async function ios() {
  const dir = path.join(ROOT, 'ios/AgentControl/Images.xcassets/AppIcon.appiconset')
  for (const { file, px } of IOS) {
    // Square + opaque (no alpha) — iOS applies its own corner mask and rejects alpha.
    await render(iconSvg({ size: px, shape: 'square', bg: BG, logoFrac: 0.54 }), path.join(dir, file), { flatten: true })
  }
  write(path.join(dir, 'Contents.json'), JSON.stringify({
    images: IOS.map(({ file, idiom, size, scale }) => ({ filename: file, idiom, scale, size })),
    info: { author: 'xcode', version: 1 },
  }, null, 2) + '\n')
  console.log('ios: AppIcon.appiconset written')
}

await android()
await ios()
console.log('done.')
