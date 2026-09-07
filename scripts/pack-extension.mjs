import { copyFile, mkdir, cp } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(root, "dist");
const extSrc = join(root, "extension");
const extOut = join(root, "dist-extension");

await mkdir(extOut, { recursive: true });
await cp(dist, extOut, { recursive: true });
await copyFile(join(extSrc, "manifest.json"), join(extOut, "manifest.json"));
await copyFile(join(extSrc, "background.js"), join(extOut, "background.js"));

console.log("Extension packed to dist-extension/");
