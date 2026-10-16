// WCAG 2.x contrast for checking the design tokens. Pure; no DOM.

export type Rgba = { r: number; g: number; b: number; a: number };

export function parseColor(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value.trim());
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(
    value.trim(),
  );
  if (rgba) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
      a: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }
  throw new Error(`Unsupported colour: ${value}`);
}

/** A translucent colour laid over an opaque one, as a hex colour. */
export function composite(top: string, under: string): string {
  const t = parseColor(top);
  const u = parseColor(under);
  const mix = (a: number, b: number) => Math.round(a * t.a + b * (1 - t.a));
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(mix(t.r, u.r))}${hex(mix(t.g, u.g))}${hex(mix(t.b, u.b))}`.toUpperCase();
}

function luminance({ r, g, b }: Rgba): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(parseColor(a));
  const lb = luminance(parseColor(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
