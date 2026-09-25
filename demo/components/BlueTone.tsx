export const BLUE_TINT = "#3B9EC8";
export const PLUM_TINT = "#4D0038";

export function parseHex(value: string): string | null {
  const hex = value.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : null;
}

function channels(value: string, fallback: string) {
  const hex = parseHex(value) ?? fallback;
  return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
}

export function PortraitTone({id, mode, color = BLUE_TINT, shadow = PLUM_TINT, highlight = BLUE_TINT}: {
  id: string; mode: "monotone" | "duotone"; color?: string; shadow?: string; highlight?: string;
}) {
  const mid = channels(color, BLUE_TINT);
  const low = channels(shadow, PLUM_TINT), high = channels(highlight, BLUE_TINT);
  const tables = mid.map((channel, i) => mode === "duotone" ? `${low[i]} ${high[i]}` : `0 ${channel} 1`);

  return <svg className="portrait-filter-definitions" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      <filter id={id} colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
        <feColorMatrix type="saturate" values="0" />
        {/* Keep the existing contrast boost and preserve the original cutout alpha. */}
        <feColorMatrix type="matrix" values="1.35 0 0 0 -0.175  0 1.35 0 0 -0.175  0 0 1.35 0 -0.175  0 0 0 1 0" />
        <feComponentTransfer>
          <feFuncR type="table" tableValues={tables[0]} />
          <feFuncG type="table" tableValues={tables[1]} />
          <feFuncB type="table" tableValues={tables[2]} />
          <feFuncA type="identity" />
        </feComponentTransfer>
      </filter>
    </defs>
  </svg>;
}

/** Compatibility with integrations using the original blue filter directly. */
export function BlueTone({id}: {id: string}) {
  return <PortraitTone id={id} mode="monotone" />;
}
