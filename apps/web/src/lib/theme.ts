import { BRAND } from "@kasa/core";

/**
 * Renk ve ölçek tokenlarını CSS değişkenlerine çevirir. Tek kaynak `packages/core/src/brand.ts`
 * (K-010); bu dosya hex içermez, üretir. Koyu tema sistem tercihine ve `data-theme`'e bağlıdır.
 */
export function themeCss(): string {
  const declarations = (tokens: Readonly<Record<string, string>>) =>
    Object.entries(tokens)
      .map(([name, value]) => `${name}:${value};`)
      .join("");
  const scale = Object.entries(BRAND.typography.scale)
    .map(([name, [size, line]]) => `${name}:${size}px;${name}-lh:${line}px;`)
    .join("");
  const radius = Object.entries(BRAND.layout.radius)
    .map(([name, value]) => `${name}:${value}px;`)
    .join("");
  return [
    `:root{${declarations(BRAND.colors.light)}${scale}${radius}--kasa-font:${BRAND.typography.families.ui};--kasa-mono:${BRAND.typography.families.mono};--kasa-max:${BRAND.layout.maxWidth}px;--kasa-gutter:${BRAND.layout.gutter}px;--kasa-card-pad:${BRAND.layout.cardPadding}px;--kasa-touch:${BRAND.layout.minTouchTarget}px;}`,
    `@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){${declarations(BRAND.colors.dark)}}}`,
    `:root[data-theme="dark"]{${declarations(BRAND.colors.dark)}}`,
  ].join("\n");
}
