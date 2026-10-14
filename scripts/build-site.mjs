// Copies the static resume site into dist/ so Netlify can publish dist/ alongside
// the built webapps. Only listed paths are published; source, tests and config stay out.
import { cpSync, mkdirSync, rmSync } from "node:fs";

const STATIC = ["index.html", "favicon_n.png", "css", "js", "images"];

rmSync("dist", { recursive: true, force: true });
mkdirSync("dist");
for (const path of STATIC) cpSync(path, `dist/${path}`, { recursive: true });
console.log(`Copied ${STATIC.join(", ")} to dist/`);
