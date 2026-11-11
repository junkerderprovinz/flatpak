/**
 * Draws the README banners, flatpak-banner.{svg,png} and flatpak-banner-dark.{svg,png}:
 * the knight avatar of the profile, centred at 1600x500, with no text.
 *
 * Deps (global): @resvg/resvg-js. Run: node .github/assets/gen-banner.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { Resvg } = require(`${execSync("npm root -g").toString().trim()}/@resvg/resvg-js`);
const HERE = dirname(fileURLToPath(import.meta.url));

const W = 1600, H = 500, LOGO = 400;
// The avatar's black outer ring vanishes on GitHub's dark canvas, so that one theme lightens it.
const THEMES = [
  { suffix: "", bg: "#ffffff", ring: "#000000" },
  { suffix: "-dark", bg: "#0d1117", ring: "#e6edf3" },
];

const avatar = readFileSync(join(HERE, "avatar.svg"), "utf8").replace(/<\?xml[^>]*\?>\s*/, "");
if (!avatar.includes('<circle id="website"')) throw new Error("avatar.svg has no outer ring");

for (const t of THEMES) {
  const logo = avatar
    .replace("<svg", `<svg x="${(W - LOGO) / 2}" y="${(H - LOGO) / 2}" width="${LOGO}" height="${LOGO}"`)
    .replace('<circle id="website"', `<circle id="website" fill="${t.ring}"`);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Junker der Provinz">
  <rect width="${W}" height="${H}" fill="${t.bg}"/>
  ${logo.trim()}
</svg>
`;
  writeFileSync(join(HERE, `flatpak-banner${t.suffix}.svg`), svg);
  writeFileSync(join(HERE, `flatpak-banner${t.suffix}.png`), new Resvg(svg, { background: t.bg, fitTo: { mode: "original" } }).render().asPng());
}
