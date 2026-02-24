/**
 * WCAG Color Contrast Checker
 *
 * Utility to verify WCAG AA and AAA contrast ratios.
 * Use in development to validate theme colors meet accessibility standards.
 *
 * WCAG AA Requirements:
 * - Normal text (< 18pt / < 14pt bold): 4.5:1
 * - Large text (>= 18pt / >= 14pt bold): 3:1
 * - UI components & graphical objects: 3:1
 *
 * WCAG AAA Requirements:
 * - Normal text: 7:1
 * - Large text: 4.5:1
 */

/**
 * Parse a hex color string to RGB components.
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleaned = hex.replace('#', '');
  let r: number, g: number, b: number;

  if (cleaned.length === 3) {
    r = parseInt(cleaned[0] + cleaned[0], 16);
    g = parseInt(cleaned[1] + cleaned[1], 16);
    b = parseInt(cleaned[2] + cleaned[2], 16);
  } else if (cleaned.length === 6) {
    r = parseInt(cleaned.substring(0, 2), 16);
    g = parseInt(cleaned.substring(2, 4), 16);
    b = parseInt(cleaned.substring(4, 6), 16);
  } else {
    return null;
  }

  return { r, g, b };
}

/**
 * Parse an HSL color string (e.g., "217 91% 60%") to RGB.
 */
function hslToRgb(hslString: string): { r: number; g: number; b: number } | null {
  const parts = hslString.trim().split(/\s+/);
  if (parts.length !== 3) return null;

  const h = parseFloat(parts[0]) / 360;
  const s = parseFloat(parts[1]) / 100;
  const l = parseFloat(parts[2]) / 100;

  if (s === 0) {
    const val = Math.round(l * 255);
    return { r: val, g: val, b: val };
  }

  const hue2rgb = (p: number, q: number, t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;

  return {
    r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  };
}

/**
 * Calculate the relative luminance of an RGB color.
 * Based on WCAG 2.1 definition.
 */
function getRelativeLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const srgb = c / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

/**
 * Calculate the contrast ratio between two colors.
 * Returns a value between 1 (no contrast) and 21 (maximum contrast).
 */
export function getContrastRatio(
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number },
): number {
  const l1 = getRelativeLuminance(color1.r, color1.g, color1.b);
  const l2 = getRelativeLuminance(color2.r, color2.g, color2.b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if a contrast ratio meets WCAG requirements.
 */
export function meetsContrastRequirement(
  ratio: number,
  level: 'AA' | 'AAA' = 'AA',
  textSize: 'normal' | 'large' = 'normal',
): boolean {
  if (level === 'AAA') {
    return textSize === 'large' ? ratio >= 4.5 : ratio >= 7;
  }
  return textSize === 'large' ? ratio >= 3 : ratio >= 4.5;
}

type ContrastLevel = 'AA' | 'AAA';
type TextSize = 'normal' | 'large';

interface ContrastCheckResult {
  ratio: number;
  formattedRatio: string;
  passes: {
    AA_normal: boolean;
    AA_large: boolean;
    AAA_normal: boolean;
    AAA_large: boolean;
  };
}

/**
 * Full contrast check between two colors (hex or HSL CSS variable format).
 *
 * @example
 * // Using hex colors
 * checkContrast('#1e40af', '#ffffff');
 *
 * // Using HSL variable format (as stored in CSS variables)
 * checkContrast('217 91% 60%', '0 0% 100%');
 */
export function checkContrast(
  foreground: string,
  background: string,
): ContrastCheckResult | null {
  const fg = foreground.startsWith('#') ? hexToRgb(foreground) : hslToRgb(foreground);
  const bg = background.startsWith('#') ? hexToRgb(background) : hslToRgb(background);

  if (!fg || !bg) return null;

  const ratio = getContrastRatio(fg, bg);

  return {
    ratio,
    formattedRatio: `${ratio.toFixed(2)}:1`,
    passes: {
      AA_normal: meetsContrastRequirement(ratio, 'AA', 'normal'),
      AA_large: meetsContrastRequirement(ratio, 'AA', 'large'),
      AAA_normal: meetsContrastRequirement(ratio, 'AAA', 'normal'),
      AAA_large: meetsContrastRequirement(ratio, 'AAA', 'large'),
    },
  };
}

/**
 * Validate all theme color pairs used in the application.
 * Logs results to the console. Run in development to audit your theme.
 *
 * @example
 * // Call in a useEffect in development
 * if (process.env.NODE_ENV === 'development') {
 *   validateThemeContrast();
 * }
 */
export function validateThemeContrast(): void {
  const pairs: Array<{ name: string; fg: string; bg: string }> = [
    { name: 'foreground / background', fg: '217 91% 20%', bg: '210 100% 97%' },
    { name: 'primary-foreground / primary', fg: '0 0% 100%', bg: '217 91% 60%' },
    { name: 'secondary-foreground / secondary', fg: '0 0% 100%', bg: '217 91% 65%' },
    { name: 'muted-foreground / muted', fg: '217 33% 45%', bg: '210 40% 96%' },
    { name: 'card-foreground / card', fg: '217 91% 20%', bg: '0 0% 100%' },
    { name: 'destructive-foreground / destructive', fg: '0 0% 100%', bg: '0 84% 60%' },
    // Dark mode pairs
    { name: '[dark] foreground / background', fg: '210 40% 98%', bg: '222.2 84% 4.9%' },
    { name: '[dark] primary-foreground / primary', fg: '222.2 47.4% 11.2%', bg: '217.2 91.2% 59.8%' },
    { name: '[dark] secondary-foreground / secondary', fg: '210 40% 98%', bg: '217.2 32.6% 17.5%' },
    { name: '[dark] muted-foreground / muted', fg: '215 20.2% 65.1%', bg: '217.2 32.6% 17.5%' },
    { name: '[dark] destructive-foreground / destructive', fg: '210 40% 98%', bg: '0 62.8% 30.6%' },
  ];

  console.group('Theme Contrast Audit (WCAG)');

  for (const pair of pairs) {
    const result = checkContrast(pair.fg, pair.bg);
    if (!result) {
      console.warn(`Could not parse colors for: ${pair.name}`);
      continue;
    }

    const status = result.passes.AA_normal ? 'PASS' : 'FAIL';
    const method = result.passes.AA_normal ? 'log' : 'warn';

    console[method](
      `${status} ${pair.name}: ${result.formattedRatio} | AA: ${result.passes.AA_normal ? 'Y' : 'N'} | AAA: ${result.passes.AAA_normal ? 'Y' : 'N'}`,
    );
  }

  console.groupEnd();
}
