"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { DIRECTIONS, handFlex, handTarget, motionTarget, normalizedPointer, selectHeadFrame, smoothPoint, trackingState, type Direction, type HeadFrame, type HandPose, type Point } from "./tracking";
import "./portrait.css";

export interface FloatingPortraitProps {
  assetPath?: string;
  /** Approximate visible head width. */
  size?: number;
  /** 0–1: head translation ≤6px; hand parallax ≤4px plus local repulsion ≤8px. */
  motionStrength?: number;
  /** Generated horizontal in-betweens are an opt-in experiment. */
  headMode?: "photos" | "generated";
  /** Enable the second photographed hand pose near the cursor. */
  animateHands?: boolean;
  className?: string;
  label?: string;
  onDirectionChange?: (direction: Direction) => void;
}

const frames: Direction[] = ["center", ...DIRECTIONS];
const sides = ["left", "right"] as const;
const zeroPose = (): HandPose => ({x:0,y:0,tilt:0});

export function FloatingPortrait({
  assetPath = "/sprites", size = 200, motionStrength = 0.8, headMode = "photos", animateHands = true,
  className = "", label = "Joel, a floating photographic head and two hands", onDirectionChange,
}: FloatingPortraitProps) {
  const base = assetPath.replace(/\/$/, "");
  const root = useRef<HTMLDivElement>(null);
  const headAnchor = useRef<HTMLDivElement>(null);
  const leftAnchor = useRef<HTMLDivElement>(null), rightAnchor = useRef<HTMLDivElement>(null);
  const callback = useRef(onDirectionChange);
  const [direction, setDirection] = useState<Direction>("center");
  const [headFrame, setHeadFrame] = useState<HeadFrame>("center");
  const [flex, setFlex] = useState([false,false]);
  const [readyPath, setReadyPath] = useState<string | null>(null);
  const [failedPath, setFailedPath] = useState<string | null>(null);
  const [variants, setVariants] = useState({key:"", heads:false, hands:false, failed:false});
  const variantKey = `${base}:${headMode}:${animateHands}`;
  const ready = readyPath === base;
  const generatedReady = variants.key === variantKey && variants.heads && headMode === "generated";
  const handsReady = variants.key === variantKey && variants.hands && animateHands;
  const safeSize = Number.isFinite(size) ? Math.max(80, Math.min(640, size)) : 200;

  useEffect(() => { callback.current = onDirectionChange; }, [onDirectionChange]);
  useEffect(() => {
    let cancelled = false;
    const decode = (name: string) => { const image = new Image(); image.src = `${base}/${name}.png`; return image.decode(); };
    Promise.all([...frames.map(id=>`head-${id}`),"hand-left","hand-right"].map(decode)).then(() => {
      if (!cancelled) { setReadyPath(base); setFailedPath(null); }
    }).catch(() => { if (!cancelled) setFailedPath(base); });
    return () => { cancelled = true; };
  }, [base]);
  useEffect(() => {
    let cancelled = false;
    const decode = (name: string) => { const image = new Image(); image.src = `${base}/${name}.png`; return image.decode(); };
    const heads = headMode === "generated" ? Promise.all(sides.map(side=>decode(`experimental/head-inner-${side}`))) : Promise.resolve();
    const hands = animateHands ? Promise.all(sides.map(side=>decode(`hand-${side}-flex`))) : Promise.resolve();
    Promise.allSettled([heads,hands]).then(results => {
      if (!cancelled) setVariants({key:variantKey,heads:results[0].status==="fulfilled",hands:results[1].status==="fulfilled",failed:results.some(result=>result.status==="rejected")});
    });
    return () => { cancelled = true; };
  }, [base,headMode,animateHands,variantKey]);

  useEffect(() => {
    const element = root.current, anchor = headAnchor.current;
    if (!element || !anchor) return;
    const finePointer = window.matchMedia("(any-hover: hover) and (any-pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let currentDirection: Direction = "center", currentFrame: HeadFrame = "center";
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
      currentFrame=selectHeadFrame(pointer,currentDirection,currentFrame,generatedReady);
      setHeadFrame(currentFrame);
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
  }, [ready,motionStrength,generatedReady,handsReady]);

  const visibleFrame = !ready ? "center" : headFrame.startsWith("inner-") && !generatedReady ? direction : headFrame;
  const headFile = visibleFrame.startsWith("inner-") ? `experimental/head-${visibleFrame}` : `head-${visibleFrame}`;
  return (
    <div className={`portrait ${className}`} ref={root} role="img" aria-label={label}
      data-direction={ready ? direction : "center"} data-frame={visibleFrame} data-ready={ready}
      style={{"--portrait-size":`${safeSize}px`} as CSSProperties}>
      <div className="portrait-head-anchor" ref={headAnchor}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="portrait-head" src={`${base}/${headFile}.png`} alt="" width="640" height="800" draggable={false} fetchPriority="high" />
      </div>
      {sides.map((side,i)=><div key={side} ref={i===0?leftAnchor:rightAnchor} className={`portrait-hand-anchor portrait-hand-${side}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="portrait-hand" src={`${base}/hand-${side}${handsReady && flex[i] ? "-flex" : ""}.png`} alt="" width="560" height={i===0?545:492} draggable={false} />
      </div>)}
      {failedPath===base && <span className="portrait-error">Some photos couldn’t load. Refresh to try again.</span>}
      {failedPath!==base && variants.key===variantKey && variants.failed && <span className="portrait-error">An optional pose couldn’t load. Using the original photos.</span>}
    </div>
  );
}
