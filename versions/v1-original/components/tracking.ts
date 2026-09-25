export const DIRECTIONS = [
  "right", "lower-right", "down", "lower-left",
  "left", "upper-left", "up", "upper-right",
] as const;

export type Direction = "center" | (typeof DIRECTIONS)[number];
export type Point = { x: number; y: number };

const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));
const TAU = Math.PI * 2;
const SECTOR = Math.PI / 4;

/** A small radial dead zone plus angular hysteresis keeps photographed frames steady. */
export function selectDirection(x: number, y: number, previous: Direction = "center"): Direction {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return "center";
  const radius = Math.hypot(x, y);
  if (radius < (previous === "center" ? 0.19 : 0.14)) return "center";
  const angle = (Math.atan2(y, x) + TAU) % TAU;
  if (previous !== "center") {
    const oldAngle = DIRECTIONS.indexOf(previous) * SECTOR;
    const difference = Math.abs(((angle - oldAngle + Math.PI + TAU) % TAU) - Math.PI);
    if (difference < SECTOR / 2 + (8 * Math.PI) / 180) return previous;
  }
  return DIRECTIONS[Math.round(angle / SECTOR) % 8];
}

export function normalizedPointer(pointer: Point, center: Point, viewport: Point): Point {
  return {
    x: clamp((pointer.x - center.x) / Math.max(180, viewport.x * 0.4), -1, 1),
    y: clamp((pointer.y - center.y) / Math.max(180, viewport.y * 0.4), -1, 1),
  };
}

/** Cap vector length, so diagonal movement never exceeds the promised pixel limit. */
export function motionTarget(pointer: Point, limit: number, strength: number, reduced: boolean): Point {
  if (reduced) return { x: 0, y: 0 };
  const magnitude = Math.max(1, Math.hypot(pointer.x, pointer.y));
  const amount = limit * clamp(Number.isFinite(strength) ? strength : 1, 0, 1);
  return { x: (pointer.x / magnitude) * amount, y: (pointer.y / magnitude) * amount };
}

export function smoothPoint(current: Point, target: Point, elapsedMs: number): Point {
  const blend = 1 - Math.exp(-Math.max(0, Math.min(elapsedMs, 64)) / 95);
  return { x: current.x + (target.x - current.x) * blend, y: current.y + (target.y - current.y) * blend };
}

export function trackingState(pointer: Point | null, previous: Direction, finePointer: boolean) {
  if (!pointer || !finePointer) return { direction: "center" as Direction, pointer: { x: 0, y: 0 } };
  return { direction: selectDirection(pointer.x, pointer.y, previous), pointer };
}
