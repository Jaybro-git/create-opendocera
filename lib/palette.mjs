// Derives the four OpenDocera palette colors from one brand color.
//
// The template's default palette was the reference: brand #B4512F gives
// deep ~#3A2116, bright ~#D97757 and neutral ~#8A7A68. The same hue is kept
// for every shade; lightness and saturation are set per role, then nudged
// until the contrast rules in AGENTS.md hold.

const WHITE = "#ffffff";
/** Dark-mode page background the `bright` color must stay readable on. */
const DARK_BG = "#0a0c11";
const MIN_CONTRAST = 4.5;

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHex(value) {
  return HEX.test(String(value).trim());
}

/** "#abc", "abc", "#AABBCC" -> "#AABBCC". */
export function normalizeHex(value) {
  const m = String(value).trim().match(HEX);
  if (!m) throw new Error(`Not a hex color: ${value}`);
  let h = m[1];
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  return `#${h.toUpperCase()}`;
}

function toRgb(hex) {
  const n = parseInt(normalizeHex(hex).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
}

function toHex([r, g, b]) {
  const byte = (v) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${byte(r)}${byte(g)}${byte(b)}`.toUpperCase();
}

function rgbToHsl([r, g, b]) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

function hslToRgb([h, s, l]) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0]
    : h < 120 ? [x, c, 0]
    : h < 180 ? [0, c, x]
    : h < 240 ? [0, x, c]
    : h < 300 ? [x, 0, c]
    : [c, 0, x];
  return [r + m, g + m, b + m];
}

const hsl = (h, s, l) => toHex(hslToRgb([h, Math.min(1, Math.max(0, s)), Math.min(1, Math.max(0, l))]));

function luminance(hex) {
  const lin = toRgb(hex).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG contrast ratio between two colors, 1 to 21. */
export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Brand color -> { deep, brand, bright, neutral, adjusted }.
 * `adjusted` is true when the brand color had to be darkened to reach 4.5:1
 * against white (it carries white button text and links on white).
 */
export function derivePalette(input) {
  const original = normalizeHex(input);
  const [h, s, l0] = rgbToHsl(toRgb(original));

  let l = l0;
  let brand = original;
  while (contrast(brand, WHITE) < MIN_CONTRAST && l > 0) {
    l -= 0.01;
    brand = hsl(h, s, l);
  }

  // A touch more saturation than the brand color, about 15% lighter, then
  // lifted until it reads on the dark background.
  let bl = Math.min(l + 0.15, 0.72);
  let bright = hsl(h, s * 1.05, bl);
  while (contrast(bright, DARK_BG) < MIN_CONTRAST && bl < 0.95) {
    bl += 0.01;
    bright = hsl(h, s * 1.05, bl);
  }

  const deep = hsl(h, Math.min(s, 0.45), 0.16);
  const neutral = hsl(h, Math.min(s, 0.14), 0.47);

  return { deep, brand, bright, neutral, adjusted: brand !== original };
}
