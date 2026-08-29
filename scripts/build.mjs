import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await mkdir("dist/icons", { recursive: true });

await Promise.all([
  build({
    entryPoints: ["src/content/index.ts"],
    outfile: "dist/content.js",
    bundle: true,
    format: "iife",
    target: "chrome120",
    sourcemap: false,
    legalComments: "none",
  }),
  build({
    entryPoints: ["src/popup/index.ts"],
    outfile: "dist/popup.js",
    bundle: true,
    format: "iife",
    target: "chrome120",
    sourcemap: false,
    legalComments: "none",
  }),
  build({
    entryPoints: ["src/options/index.ts"],
    outfile: "dist/options.js",
    bundle: true,
    format: "iife",
    target: "chrome120",
    sourcemap: false,
    legalComments: "none",
  }),
  build({
    entryPoints: ["src/background/index.ts"],
    outfile: "dist/background.js",
    bundle: true,
    format: "iife",
    target: "chrome120",
    sourcemap: false,
    legalComments: "none",
  }),
]);

await Promise.all([
  cp("manifest.json", "dist/manifest.json"),
  cp("assets/icons/icon-16.png", "dist/icons/icon-16.png"),
  cp("assets/icons/icon-32.png", "dist/icons/icon-32.png"),
  cp("assets/icons/icon-48.png", "dist/icons/icon-48.png"),
  cp("assets/icons/icon-128.png", "dist/icons/icon-128.png"),
  cp("src/content/content.css", "dist/content.css"),
  cp("src/popup/popup.html", "dist/popup.html"),
  cp("src/popup/popup.css", "dist/popup.css"),
  cp("src/options/options.html", "dist/options.html"),
  cp("src/options/options.css", "dist/options.css"),
  cp("src/privacy/privacy.html", "dist/privacy.html"),
]);

console.log("Built unpacked extension in dist/");
