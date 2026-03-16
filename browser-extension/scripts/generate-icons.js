/**
 * Generate PNG icons from canvas for Chrome extension.
 * Run: node scripts/generate-icons.js
 *
 * This creates simple colored square PNG icons.
 * For production, replace with your actual brand icons.
 */

const fs = require('fs');
const path = require('path');

// Minimal 1-pixel-per-unit PNG generator
// Creates a simple colored square with letter "E"
function createMinimalPNG(size) {
  // Create a simple solid-color PNG manually
  // This is a minimal valid PNG with a blue square
  // For production, use proper icon files

  const { createCanvas } = (() => {
    try {
      return require('canvas');
    } catch {
      return { createCanvas: null };
    }
  })();

  if (createCanvas) {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Blue background with rounded corners (simulated)
    ctx.fillStyle = '#2563eb';
    ctx.fillRect(0, 0, size, size);

    // White letter E
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(size * 0.6)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('E', size / 2, size / 2);

    return canvas.toBuffer('image/png');
  }

  // Fallback: copy SVG as-is (user needs to convert manually)
  console.log(`Note: 'canvas' package not found. Please convert SVG icons to PNG manually.`);
  console.log(`You can use: https://convertio.co/svg-png/ or any image editor.`);
  return null;
}

const iconsDir = path.join(__dirname, '..', 'public', 'icons');

for (const size of [16, 48, 128]) {
  const pngData = createMinimalPNG(size);
  if (pngData) {
    fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), pngData);
    console.log(`Created icon${size}.png`);
  }
}
