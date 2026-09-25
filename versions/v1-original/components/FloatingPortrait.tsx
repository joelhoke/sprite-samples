"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DIRECTIONS, motionTarget, normalizedPointer, smoothPoint, trackingState, type Direction, type Point } from "./tracking";
import "./portrait.css";

export interface FloatingPortraitProps {
  /** Directory containing the PNG filenames listed in assets/manifest.json. */
  assetPath?: string;
  /** Approximate visible head width; the entire composition scales responsively. */
  size?: number;
  /** 0 disables translation; 1 allows at most 6px for the head and 4px for hands. */
  motionStrength?: number;
  className?: string;
  label?: string;
  onDirectionChange?: (direction: Direction) => void;
}

const frames: Direction[] = ["center", ...DIRECTIONS];

export function FloatingPortrait({
  assetPath = "/sprites", size = 200, motionStrength = 0.8,
  className = "", label = "Joel, a floating photographic head and two hands",
  onDirectionChange,
}: FloatingPortraitProps) {
  const base = assetPath.replace(/\/$/, "");
  const root = useRef<HTMLDivElement>(null);
  const headAnchor = useRef<HTMLDivElement>(null);
  const callback = useRef(onDirectionChange);
  const [direction, setDirection] = useState<Direction>("center");
  const [readyPath, setReadyPath] = useState<string | null>(null);
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const ready = readyPath === base;
  const failed = failedPath === base;
  const safeSize = Number.isFinite(size) ? Math.max(80, Math.min(640, size)) : 200;

  useEffect(() => { callback.current = onDirectionChange; }, [onDirectionChange]);

  useEffect(() => {
    let cancelled = false;
    const names = [...frames.map(id => `head-${id}`), "hand-left", "hand-right"];
    const images = names.map(name => {
      const image = new Image();
      image.src = `${base}/${name}.png`;
      return image.decode();
    });
    Promise.all(images).then(() => {
      if (!cancelled) { setReadyPath(base); setFailedPath(null); }
    }).catch(() => { if (!cancelled) setFailedPath(base); });
    return () => { cancelled = true; };
  }, [base]);

  useEffect(() => {
    const element = root.current;
    const anchor = headAnchor.current;
    if (!element || !anchor) return;
    const finePointer = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let currentDirection: Direction = "center";
    let pointer: Point = { x: 0, y: 0 };
    let head = { x: 0, y: 0 }, hands = { x: 0, y: 0 };
    let frame = 0, lastTime = 0;
    let center = { x: 0, y: 0 };
    let lastPointer: Point | null = null;

    const paint = () => {
      element.style.setProperty("--head-x", `${head.x.toFixed(3)}px`);
      element.style.setProperty("--head-y", `${head.y.toFixed(3)}px`);
      element.style.setProperty("--hand-x", `${hands.x.toFixed(3)}px`);
      element.style.setProperty("--hand-y", `${hands.y.toFixed(3)}px`);
    };
    const animate = (time: number) => {
      frame = 0;
      const elapsed = lastTime ? time - lastTime : 16.67;
      lastTime = time;
      const headTarget = motionTarget(pointer, 6, motionStrength, reducedMotion.matches);
      const handTarget = motionTarget(pointer, 4, motionStrength, reducedMotion.matches);
      if (reducedMotion.matches) { head = headTarget; hands = handTarget; }
      else { head = smoothPoint(head, headTarget, elapsed); hands = smoothPoint(hands, handTarget, elapsed); }
      const remaining = Math.hypot(head.x-headTarget.x, head.y-headTarget.y) + Math.hypot(hands.x-handTarget.x, hands.y-handTarget.y);
      if (remaining < 0.015) { head = headTarget; hands = handTarget; }
      else frame = requestAnimationFrame(animate);
      paint();
    };
    const schedule = () => { if (!frame) { lastTime = 0; frame = requestAnimationFrame(animate); } };
    const update = (nextPointer: Point | null) => {
      lastPointer = nextPointer;
      const next = trackingState(nextPointer && normalizedPointer(nextPointer,center,{x:window.innerWidth,y:window.innerHeight}),currentDirection,finePointer.matches && ready);
      pointer = next.pointer;
      if (next.direction !== currentDirection) {
        currentDirection = next.direction;
        setDirection(currentDirection);
        callback.current?.(currentDirection);
      }
      schedule();
    };
    const measure = () => {
      const bounds = anchor.getBoundingClientRect();
      center = { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height * 0.52 };
      if (lastPointer) update(lastPointer);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerType === "touch") { update(null); return; }
      update({x:event.clientX,y:event.clientY});
    };
    const reset = () => update(null);
    const leave = (event: PointerEvent) => { if (event.relatedTarget === null) reset(); };
    const visibility = () => { if (document.hidden) { reset(); cancelAnimationFrame(frame); frame=0; head={x:0,y:0}; hands={x:0,y:0}; paint(); } };
    const preferenceChange = () => { if (!finePointer.matches) reset(); else schedule(); };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(anchor);
    window.addEventListener("pointermove",move,{passive:true});
    window.addEventListener("pointerout",leave);
    window.addEventListener("blur",reset);
    window.addEventListener("resize",measure);
    window.addEventListener("scroll",measure,{passive:true});
    document.addEventListener("visibilitychange",visibility);
    finePointer.addEventListener("change",preferenceChange);
    reducedMotion.addEventListener("change",preferenceChange);
    return () => {
      cancelAnimationFrame(frame); observer.disconnect();
      window.removeEventListener("pointermove",move);
      window.removeEventListener("pointerout",leave);
      window.removeEventListener("blur",reset);
      window.removeEventListener("resize",measure);
      window.removeEventListener("scroll",measure);
      document.removeEventListener("visibilitychange",visibility);
      finePointer.removeEventListener("change",preferenceChange);
      reducedMotion.removeEventListener("change",preferenceChange);
      head={x:0,y:0}; hands={x:0,y:0}; paint();
    };
  }, [ready, motionStrength]);

  return (
    <div className={`portrait ${className}`} ref={root} role="img" aria-label={label}
      data-direction={ready ? direction : "center"} data-ready={ready}
      style={{"--portrait-size":`${safeSize}px`} as CSSProperties}>
      <div className="portrait-head-anchor" ref={headAnchor}>
        {/* Photographs intentionally use native img to preserve transparent pixels. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="portrait-head" src={`${base}/head-${ready ? direction : "center"}.png`} alt="" width="640" height="800" draggable={false} fetchPriority="high" />
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="portrait-hand portrait-hand-left" src={`${base}/hand-left.png`} alt="" draggable={false} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="portrait-hand portrait-hand-right" src={`${base}/hand-right.png`} alt="" draggable={false} />
      {failed && <span className="portrait-error">Some photos couldn’t load. Refresh to try again.</span>}
    </div>
  );
}
