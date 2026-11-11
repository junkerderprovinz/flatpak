/**
 * Draws the README banner, flatpak-banner.svg and .png: the knight avatar of the
 * profile, centred on white at 1600x500, with no text.
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

const avatar = readFileSync(join(HERE, "avatar.svg"), "utf8").replace(/<\?xml[^>]*\?>\s*/, "");
const logo = avatar.replace("<svg", `<svg x="${(W - LOGO) / 2}" y="${(H - LOGO) / 2}" width="${LOGO}" height="${LOGO}"`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Junker der Provinz">
  <rect width="${W}" height="${H}" fill="#ffffff"/>
  ${logo.trim()}
</svg>
`;
writeFileSync(join(HERE, "flatpak-banner.svg"), svg);
writeFileSync(join(HERE, "flatpak-banner.png"), new Resvg(svg, { background: "#ffffff", fitTo: { mode: "original" } }).render().asPng());
