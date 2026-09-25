"use client";

import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { DIRECTIONS, handFlex, handTarget, motionTarget, normalizedPointer, smoothPoint, trackingState, type Direction, type HandPose, type Point } from "./tracking";
import "./portrait.css";
import { AsciiSprite, isAsciiSet, type AsciiSet } from "./AsciiSprite";
import { PortraitTone, BLUE_TINT, PLUM_TINT } from "./BlueTone";

export type PortraitMode = "photos" | "generated" | "oil" | "watercolor" | "pencil" | "ascii" | "blue" | "monotone" | "duotone";

export interface FloatingPortraitProps {
  assetPath?: string;
  /** Optional photo, pencil, or watercolor head directory; matching style hands are retained. */
  headAssetPath?: string;
  /** Approximate visible head width. */
  size?: number;
  /** 0–1: head translation ≤6px; hand parallax ≤4px plus local repulsion ≤8px. */
  motionStrength?: number;
  /** Portrait style; "blue" remains an alias for "monotone". */
  headMode?: PortraitMode;
  /** Six-digit hex colors; invalid values fall back to the original blue/plum palette. */
  monotoneColor?: string;
  duotoneShadow?: string;
  duotoneHighlight?: string;
  /** Enable the second matching hand pose near the cursor. */
  animateHands?: boolean;
  className?: string;
  label?: string;
  onDirectionChange?: (direction: Direction) => void;
}

const frames: Direction[] = ["center", ...DIRECTIONS];
const sides = ["left", "right"] as const;
const zeroPose = (): HandPose => ({x:0,y:0,tilt:0});

export function FloatingPortrait({
  assetPath = "/sprites", headAssetPath, size = 200, motionStrength = 0.8, headMode = "photos", animateHands = true,
  monotoneColor = BLUE_TINT, duotoneShadow = PLUM_TINT, duotoneHighlight = BLUE_TINT,
  className = "", label, onDirectionChange,
}: FloatingPortraitProps) {
  const base = assetPath.replace(/\/$/, "");
  const isAscii = headMode === "ascii";
  const isMonotone = headMode === "blue" || headMode === "monotone";
  const isToned = isMonotone || headMode === "duotone";
  const toneFilterId = `portrait-tone-${useId().replace(/:/g, "")}`;
  const handBase = isAscii ? `${base}/ascii` : headMode === "oil" || headMode === "watercolor" || headMode === "pencil" ? `${base}/${headMode}` : headMode === "generated" || isToned ? `${base}/ai` : base;
  const customHeads = Boolean(headAssetPath) && ["photos","pencil","watercolor"].includes(headMode);
  const headBase = customHeads && headAssetPath ? headAssetPath.replace(/\/$/, "") : handBase;
  const assetKey = `${headBase}|${handBase}`;
  const styleName = isToned ? `${isMonotone ? "monotone" : "duotone"} AI-generated` : isAscii ? "ASCII" : headMode === "pencil" ? "pencil-sketched" : headMode === "watercolor" ? "watercolor" : headMode === "oil" ? "oil-painted" : headMode === "generated" ? "AI-generated" : "photographic";
  const description = label ?? `Joel, a floating ${styleName} head and two ${styleName} hands`;
  const root = useRef<HTMLDivElement>(null);
  const headAnchor = useRef<HTMLDivElement>(null);
  const leftAnchor = useRef<HTMLDivElement>(null), rightAnchor = useRef<HTMLDivElement>(null);
  const callback = useRef(onDirectionChange);
  const [direction, setDirection] = useState<Direction>("center");
  const [flex, setFlex] = useState([false,false]);
  const [readyPath, setReadyPath] = useState<string | null>(null);
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const [variants, setVariants] = useState({key:"", hands:false, failed:false});
  const [ascii, setAscii] = useState<{path: string; data: AsciiSet} | null>(null);
  const variantKey = `${handBase}:${animateHands}`;
  const ready = readyPath === assetKey;
  const handsReady = animateHands && (isAscii ? ready : variants.key === variantKey && variants.hands);
  const safeSize = Number.isFinite(size) ? Math.max(80, Math.min(640, size)) : 200;

  useEffect(() => { callback.current = onDirectionChange; }, [onDirectionChange]);
  useEffect(() => {
    let cancelled = false;
    if (isAscii) {
      const controller = new AbortController();
      const required = [...frames.map(id=>`head-${id}`), ...sides.flatMap(side=>[`hand-${side}`, `hand-${side}-flex`])];
      fetch(`${headBase}/frames.json`, {signal: controller.signal})
        .then(response => { if (!response.ok) throw new Error("ASCII asset unavailable"); return response.json(); })
        .then((data: unknown) => {
          if (!isAsciiSet(data, required)) throw new Error("Incomplete ASCII portrait");
          if (!cancelled) { setAscii({path:headBase,data}); setReadyPath(assetKey); setFailedPath(null); }
        }).catch(() => { if (!cancelled) setFailedPath(assetKey); });
      return () => { cancelled = true; controller.abort(); };
    }
    const decode = (url: string) => { const image = new Image(); image.src = url; return image.decode(); };
    const headNames = frames;
    const urls = [...headNames.map(id=>`${headBase}/head-${id}.png`),...sides.map(side=>`${handBase}/hand-${side}.png`)];
    Promise.all(urls.map(decode)).then(() => {
      if (!cancelled) { setReadyPath(assetKey); setFailedPath(null); }
    }).catch(() => { if (!cancelled) setFailedPath(assetKey); });
    return () => { cancelled = true; };
  }, [assetKey,base,headBase,handBase,headMode,isAscii]);
  useEffect(() => {
    if (isAscii) return;
    let cancelled = false;
    const decode = (side: string) => { const image = new Image(); image.src = `${handBase}/hand-${side}-flex.png`; return image.decode(); };
    const hands = animateHands ? Promise.all(sides.map(decode)) : Promise.resolve();
    hands.then(() => {
      if (!cancelled) setVariants({key:variantKey,hands:true,failed:false});
    }).catch(() => { if (!cancelled) setVariants({key:variantKey,hands:false,failed:true}); });
    return () => { cancelled = true; };
  }, [handBase,animateHands,variantKey,isAscii]);

  useEffect(() => {
    const element = root.current, anchor = headAnchor.current;
    if (!element || !anchor) return;
    const finePointer = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let currentDirection: Direction = "center";
    let pointer: Point = {x:0,y:0}, head = {x:0,y:0};
    let hands = [zeroPose(),zeroPose()], poses = [false,false];
    let frame = 0, lastTime = 0;
    let center = {x:0,y:0};
    const handCenters = [{x:0,y:0},{x:0,y:0}], radii = [140,140];
    let lastPointer: Point | null = null;
    const paint = () => {
      element.style.setProperty("--head-x",`${head.x.toFixed(3)}px`);
      element.style.setProperty("--head-y",`${head.y.toFixed(3)}px`);
      hands.forEach((hand,i)=>{
        element.style.setProperty(`--${sides[i]}-x`,`${hand.x.toFixed(3)}px`);
        element.style.setProperty(`--${sides[i]}-y`,`${hand.y.toFixed(3)}px`);
        element.style.setProperty(`--${sides[i]}-tilt`,`${hand.tilt.toFixed(3)}deg`);
      });
    };
    const animate = (time: number) => {
      frame=0;
      const elapsed=lastTime ? time-lastTime : 16.67;lastTime=time;
      const active = finePointer.matches && ready ? lastPointer : null;
      const target = motionTarget(pointer,6,motionStrength,reducedMotion.matches);
      const targets = handCenters.map((point,i)=>handTarget(active,point,pointer,radii[i],i===0?-1:1,motionStrength,reducedMotion.matches));
      head = reducedMotion.matches ? target : smoothPoint(head,target,elapsed);
      hands = hands.map((hand,i)=>reducedMotion.matches ? targets[i] : {
        ...smoothPoint(hand,targets[i],elapsed),
        tilt:smoothPoint({x:hand.tilt,y:0},{x:targets[i].tilt,y:0},elapsed).x,
      });
      const remaining = Math.hypot(head.x-target.x,head.y-target.y)+hands.reduce((sum,hand,i)=>sum+Math.hypot(hand.x-targets[i].x,hand.y-targets[i].y)+Math.abs(hand.tilt-targets[i].tilt),0);
      if (remaining<.015) { head=target;hands=targets; }
      else frame=requestAnimationFrame(animate);
      paint();
    };
    const schedule = () => { if (!frame) { lastTime=0;frame=requestAnimationFrame(animate); } };
    const update = (nextPointer: Point | null) => {
      lastPointer=nextPointer;
      const active=finePointer.matches && ready;
      const next=trackingState(nextPointer && normalizedPointer(nextPointer,center,{x:window.innerWidth,y:window.innerHeight}),currentDirection,active);
      pointer=next.pointer;
      if (next.direction!==currentDirection) callback.current?.(next.direction);
      currentDirection=next.direction;
      setDirection(currentDirection);
      const nextPoses=handCenters.map((point,i)=>handFlex(nextPointer,point,radii[i],poses[i],active && handsReady && !reducedMotion.matches && motionStrength>0));
      if (nextPoses.some((value,i)=>value!==poses[i])) { poses=nextPoses;setFlex(poses); }
      schedule();
    };
    const measure = () => {
      const bounds=anchor.getBoundingClientRect();
      center={x:bounds.left+bounds.width/2,y:bounds.top+bounds.height*.52};
      [leftAnchor,rightAnchor].forEach((ref,i)=>{
        const rect=ref.current?.getBoundingClientRect();
        if (rect) { handCenters[i]={x:rect.left+rect.width*.5,y:rect.top+rect.height*.5};radii[i]=Math.max(80,Math.min(180,rect.width*.9)); }
      });
      if (lastPointer) update(lastPointer);
    };
    const move = (event: PointerEvent) => update(event.pointerType==="touch" ? null : {x:event.clientX,y:event.clientY});
    const reset = () => update(null);
    const leave = (event: PointerEvent) => { if (event.relatedTarget===null) reset(); };
    const visibility = () => { if (document.hidden) { reset();cancelAnimationFrame(frame);frame=0;head={x:0,y:0};hands=[zeroPose(),zeroPose()];paint(); } };
    const preferenceChange = () => update(finePointer.matches ? lastPointer : null);
    measure();
    // Reset state when assets or comparison options change, before the next pointer move.
    reset();setFlex([false,false]);
    const observer=new ResizeObserver(measure);observer.observe(element);
    window.addEventListener("pointermove",move,{passive:true});window.addEventListener("pointerout",leave);
    window.addEventListener("blur",reset);window.addEventListener("resize",measure);window.addEventListener("scroll",measure,{passive:true});
    document.addEventListener("visibilitychange",visibility);
    finePointer.addEventListener("change",preferenceChange);reducedMotion.addEventListener("change",preferenceChange);
    return () => {
      cancelAnimationFrame(frame);observer.disconnect();
      window.removeEventListener("pointermove",move);window.removeEventListener("pointerout",leave);
      window.removeEventListener("blur",reset);window.removeEventListener("resize",measure);window.removeEventListener("scroll",measure);
      document.removeEventListener("visibilitychange",visibility);
      finePointer.removeEventListener("change",preferenceChange);reducedMotion.removeEventListener("change",preferenceChange);
      head={x:0,y:0};hands=[zeroPose(),zeroPose()];paint();
    };
  }, [ready,motionStrength,headMode,handsReady]);

  const visibleFrame = ready ? direction : "center";
  const headFile = `head-${visibleFrame}`;
  const asciiFrames = ascii?.path === headBase ? ascii.data.frames : undefined;
  return (
    <div className={`portrait ${className}`} ref={root} role="img" aria-label={description}
      data-direction={ready ? direction : "center"} data-frame={visibleFrame} data-ready={ready} data-mode={headMode}
      style={{"--portrait-size":`${safeSize}px`, "--portrait-tone":isToned ? `url("#${toneFilterId}")` : "none"} as CSSProperties}>
      {isToned && <PortraitTone id={toneFilterId} mode={isMonotone ? "monotone" : "duotone"} color={monotoneColor} shadow={duotoneShadow} highlight={duotoneHighlight} />}
      <div className="portrait-head-anchor" ref={headAnchor}>
        {isAscii ? <AsciiSprite className="portrait-head" name={headFile} frame={asciiFrames?.[headFile]} /> : <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="portrait-head" src={`${headBase}/${headFile}.png`} alt="" width="640" height="800" draggable={false} fetchPriority="high" /></>}
      </div>
      {sides.map((side,i)=><div key={side} ref={i===0?leftAnchor:rightAnchor} className={`portrait-hand-anchor portrait-hand-${side}`}>
        {isAscii ? <AsciiSprite className="portrait-hand" name={`hand-${side}${handsReady && flex[i] ? "-flex" : ""}`} frame={asciiFrames?.[`hand-${side}${handsReady && flex[i] ? "-flex" : ""}`]} /> : <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="portrait-hand" src={`${handBase}/hand-${side}${handsReady && flex[i] ? "-flex" : ""}.png`} alt="" width="560" height={i===0?545:492} draggable={false} /></>}
      </div>)}
      {failedPath===assetKey && <span className="portrait-error" role="status">{customHeads ? (headMode === "photos" ? "The new video cutouts couldn’t load. Try Then or refresh." : "The new styled portrait couldn’t load. Try Then or another style.") : isAscii ? "The ASCII set couldn’t load. Choose Photo only or refresh to try again." : headMode === "pencil" ? "The pencil sketch set couldn’t load. Choose Photo only or refresh to try again." : headMode === "watercolor" ? "The watercolor set couldn’t load. Choose Photo only or refresh to try again." : headMode === "oil" ? "The oil painting set couldn’t load. Choose Photo only or refresh to try again." : headMode === "generated" || isToned ? "The AI portrait set couldn’t load. Choose Photo only or refresh to try again." : "Some photos couldn’t load. Refresh to try again."}</span>}
      {!isAscii && failedPath!==assetKey && variants.key===variantKey && variants.failed && <span className="portrait-error" role="status">An optional hand pose couldn’t load. Keeping the open hands.</span>}
    </div>
  );
}
