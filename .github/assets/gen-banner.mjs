/**
 * Draws the README banners, flatpak-banner.{svg,png} and flatpak-banner-dark.{svg,png}:
 * the Flatpak mark with the name and claim beside it, laid out like the app
 * banners. Mark ink 400px with its left edge at x=165 and its centre at y=250,
 * name 132, claim 44, mark-to-text gap 70, name-to-claim gap 8.
 *
 * The mark is Flatpak's (CC BY 3.0, flatpak.org/press), path from Simple Icons.
 * Fonts (OFL) are fetched to the OS temp dir at runtime.
 * Deps (global): @resvg/resvg-js, opentype.js. Run: node .github/assets/gen-banner.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const gRoot = execSync("npm root -g").toString().trim();
const { Resvg } = require(`${gRoot}/@resvg/resvg-js`);
const opentype = require(`${gRoot}/opentype.js`);
const HERE = dirname(fileURLToPath(import.meta.url));

const NAME = "Flatpak Repo";
const CLAIM = "Add it once, the updates follow.";
const W = 1600, H = 500, INK = 400;
const nameSize = 132, claimSize = 44, gap = 70, lineGap = 8;
const THEMES = [
  { suffix: "", bg: "#ffffff", name: "#1f2328", claim: "#5a5d5e" },
  { suffix: "-dark", bg: "#0d1117", name: "#e6edf3", claim: "#9aa4ad" },
];

const mark = readFileSync(join(HERE, "flatpak-mark.svg"), "utf8").replace(/<\?xml[^>]*\?>\s*/, "");
const vb = (mark.match(/viewBox="([^"]+)"/) || [, "0 0 24 24"])[1];
const [vbX, vbY, vbW, vbH] = vb.split(/[\s,]+/).map(Number);

const ink = new Resvg(Buffer.from(mark)).innerBBox();
if (!ink) throw new Error("no ink bbox from the mark");
const scale = INK / Math.max(ink.width, ink.height);
const boxW = vbW * scale, boxH = vbH * scale;
const LX = 165 - (ink.x - vbX) * scale;
const LY = 250 - ((ink.y - vbY) + ink.height / 2) * scale;
const textX = 165 + ink.width * scale + gap;

async function getFont(file, url) {
  const p = join(tmpdir(), file);
  if (!existsSync(p)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`font fetch ${res.status} ${url}`);
    writeFileSync(p, Buffer.from(await res.arrayBuffer()));
  }
  const b = readFileSync(p);
  return opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
}
const bree = await getFont("Flatpak-BreeSerif-Regular.ttf", "https://github.com/google/fonts/raw/main/ofl/breeserif/BreeSerif-Regular.ttf");
const lato = await getFont("Flatpak-Lato-Regular.ttf", "https://github.com/google/fonts/raw/main/ofl/lato/Lato-Regular.ttf");

const nameAsc = bree.ascender * (nameSize / bree.unitsPerEm);
const nameDesc = -bree.descender * (nameSize / bree.unitsPerEm);
const claimAsc = lato.ascender * (claimSize / lato.unitsPerEm);
const blockH = nameAsc + nameDesc + lineGap + claimAsc;
const nameBaseline = H / 2 - blockH / 2 + nameAsc;
const claimBaseline = nameBaseline + nameDesc + lineGap + claimAsc;

// Each glyph is built at x=0 and moved by a transform, because opentype.js emits
// NaN control points for some glyphs far along a line.
function glyphs(font, text, size) {
  const s = size / font.unitsPerEm;
  const gs = font.stringToGlyphs(text);
  const out = [];
  let x = 0;
  for (let i = 0; i < gs.length; i++) {
    const d = gs[i].getPath(0, 0, size).toPathData(2);
    if (d.includes("NaN")) throw new Error(`NaN in "${text[i]}"`);
    if (d) out.push({ d, x });
    x += gs[i].advanceWidth * s;
    if (i + 1 < gs.length) x += font.getKerningValue(gs[i], gs[i + 1]) * s;
  }
  return out;
}
const paint = (gl, y, fill) =>
  gl.map((g) => `<path transform="translate(${g.x.toFixed(2)},${y.toFixed(2)})" d="${g.d}" fill="${fill}"/>`).join("\n    ");
const rightEdge = textX + Math.max(bree.getAdvanceWidth(NAME, nameSize), lato.getAdvanceWidth(CLAIM, claimSize));
if (W - rightEdge < 120) throw new Error(`right margin ${(W - rightEdge).toFixed(0)}px, house minimum is 120`);

const placed = mark.replace(/<svg\b[^>]*>/,
  `<svg x="${LX.toFixed(2)}" y="${LY.toFixed(2)}" width="${boxW.toFixed(2)}" height="${boxH.toFixed(2)}" viewBox="${vb}" xmlns="http://www.w3.org/2000/svg">`);
for (const t of THEMES) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${NAME}">
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  ${placed.trim()}
  <g transform="translate(${textX.toFixed(2)},0)">
    ${paint(glyphs(bree, NAME, nameSize), nameBaseline, t.name)}
    ${paint(glyphs(lato, CLAIM, claimSize), claimBaseline, t.claim)}
  </g>
</svg>
`;
  writeFileSync(join(HERE, `flatpak-banner${t.suffix}.svg`), svg);
  writeFileSync(join(HERE, `flatpak-banner${t.suffix}.png`), new Resvg(svg, { background: t.bg, fitTo: { mode: "original" } }).render().asPng());
}
console.log(`right margin ${(W - rightEdge).toFixed(0)}px`);
