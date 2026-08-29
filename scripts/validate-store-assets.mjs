import { readFile } from "node:fs/promises";

const expectedAssets = new Map([
  ["store-assets/screenshots/01-focus-mode.png", [1280, 800]],
  ["store-assets/screenshots/02-keywords-and-sections.png", [1280, 800]],
  ["store-assets/screenshots/03-customize-page.png", [1280, 800]],
  ["store-assets/screenshots/04-presets-and-settings.png", [1280, 800]],
  ["store-assets/screenshots/05-search-list-cleanup.png", [1280, 800]],
  ["store-assets/promo/small-promo-440x280.png", [440, 280]],
  ["store-assets/promo/marquee-promo-1400x560.png", [1400, 560]],
]);

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

for (const [filePath, [expectedWidth, expectedHeight]] of expectedAssets) {
  const image = await readFile(filePath);
  if (!image.subarray(0, 8).equals(pngSignature)) throw new Error(`${filePath} is not a PNG file`);
  const width = image.readUInt32BE(16);
  const height = image.readUInt32BE(20);
  const bitDepth = image[24];
  const colorType = image[25];
  if (width !== expectedWidth || height !== expectedHeight) {
    throw new Error(`${filePath} is ${width}x${height}; expected ${expectedWidth}x${expectedHeight}`);
  }
  if (bitDepth !== 8 || colorType !== 2) {
    throw new Error(`${filePath} must be 24-bit RGB PNG without alpha; found bit depth ${bitDepth}, color type ${colorType}`);
  }
}

console.log(`Validated ${expectedAssets.size} Chrome Web Store images: exact dimensions, 24-bit RGB PNG, no alpha`);
