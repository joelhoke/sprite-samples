import type { CSSProperties } from "react";

export interface AsciiFrame {
  columns: number;
  rows: number;
  canvas: [number, number];
  lines: string[];
}
export interface AsciiSet { version: 1; frames: Record<string, AsciiFrame> }

/** Validate the complete set before making any pose interactive. */
export function isAsciiSet(value: unknown, required: string[]): value is AsciiSet {
  if (!value || typeof value !== "object") return false;
  const data = value as AsciiSet;
  return data.version === 1 && !!data.frames && required.every(id => {
    const frame = data.frames[id];
    return frame && Number.isInteger(frame.columns) && frame.columns > 0 && frame.columns <= 160
      && Number.isInteger(frame.rows) && frame.rows > 0 && frame.rows <= 160
      && Array.isArray(frame.canvas) && frame.canvas.length === 2
      && frame.canvas.every(n => Number.isFinite(n) && n > 0)
      && Array.isArray(frame.lines) && frame.lines.length === frame.rows
      && frame.lines.every(line => typeof line === "string" && line.length === frame.columns && /^[\x20-\x7e]*$/.test(line));
  });
}

export function AsciiSprite({frame, name, className}: {frame?: AsciiFrame; name: string; className: string}) {
  // Courier's glyph advance is 0.6em. Container units scale with the fixed anchor,
  // so the same text alignment survives responsive layout and hand transforms.
  const style = frame ? {
    fontSize: `${100 / frame.columns / .6}cqw`,
    lineHeight: `${100 * frame.canvas[1] / frame.canvas[0] / frame.rows}cqw`,
  } as CSSProperties : undefined;
  return <pre className={`${className} portrait-ascii`} data-ascii-frame={name} aria-hidden="true" style={style}>{frame?.lines.join("\n") ?? ""}</pre>;
}
