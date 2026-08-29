import { readFile, readdir, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { unzipSync, zipSync } from "fflate";

const projectRoot = process.cwd();
const distRoot = path.join(projectRoot, "dist");
const releaseRoot = path.join(projectRoot, "release");

async function collectFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectFiles(absolutePath, relativePath));
    else if (entry.isFile()) files.push({ absolutePath, relativePath });
  }
  return files;
}

function requiredManifestFiles(manifest) {
  return [
    manifest.action?.default_popup,
    manifest.options_ui?.page,
    manifest.background?.service_worker,
    manifest.side_panel?.default_path,
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
    ...(manifest.content_scripts ?? []).flatMap((script) => [...(script.js ?? []), ...(script.css ?? [])]),
  ].filter((value) => typeof value === "string");
}

function validateArchive(entries) {
  const names = Object.keys(entries).filter((name) => !name.endsWith("/"));
  const manifests = names.filter((name) => name === "manifest.json" || name.endsWith("/manifest.json"));
  if (manifests.length !== 1 || manifests[0] !== "manifest.json") {
    throw new Error(`Store archive must contain exactly one root manifest.json; found: ${manifests.join(", ") || "none"}`);
  }

  const forbidden = names.filter((name) =>
    name.endsWith(".map")
      || name.startsWith("src/")
      || name.startsWith("tests/")
      || name.startsWith("node_modules/")
      || name.split("/").some((part) => part.startsWith(".")),
  );
  if (forbidden.length) throw new Error(`Store archive contains development-only files: ${forbidden.join(", ")}`);

  const manifest = JSON.parse(new TextDecoder().decode(entries["manifest.json"]));
  if (manifest.manifest_version !== 3) throw new Error("Store archive must use Manifest V3");
  for (const field of ["name", "version", "description"]) {
    if (typeof manifest[field] !== "string" || !manifest[field].trim()) {
      throw new Error(`Manifest requires a non-empty ${field}`);
    }
  }
  if (manifest.description.length > 132) throw new Error("Manifest description exceeds 132 characters");
  for (const size of ["16", "32", "48", "128"]) {
    if (!manifest.icons?.[size]) throw new Error(`Manifest is missing the ${size}px Store icon`);
  }
  for (const referencedFile of requiredManifestFiles(manifest)) {
    if (!entries[referencedFile]) throw new Error(`Manifest references missing file: ${referencedFile}`);
  }
  return manifest;
}

const files = await collectFiles(distRoot);
const archiveEntries = Object.fromEntries(
  await Promise.all(files.map(async ({ absolutePath, relativePath }) => [relativePath, new Uint8Array(await readFile(absolutePath))])),
);
const manifest = validateArchive(archiveEntries);
const archive = zipSync(archiveEntries, { level: 9 });
validateArchive(unzipSync(archive));

await mkdir(releaseRoot, { recursive: true });
const archiveName = `just-the-role-chrome-extension-v${manifest.version}.zip`;
const archivePath = path.join(releaseRoot, archiveName);
await rm(archivePath, { force: true });
await writeFile(archivePath, archive);

console.log(`Created Chrome Web Store package: release/${archiveName}`);
console.log(`Validated ${Object.keys(archiveEntries).length} files and exactly one root manifest.json`);
