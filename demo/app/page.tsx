"use client";

import { useState } from "react";
import { FloatingPortrait, type PortraitMode } from "../components/FloatingPortrait";
import { BLUE_TINT, PLUM_TINT } from "../components/BlueTone";
import { ToneControls } from "../components/ToneControls";
import Link from "next/link";
import { ReferenceTabs, type ReferenceVersion } from "../components/ReferenceTabs";

export default function Home() {
  const [reference,setReference] = useState<ReferenceVersion>("now");
  const [background,setBackground] = useState("light");
  const [headMode,setHeadMode] = useState<PortraitMode>("photos");
  const [nowMode,setNowMode] = useState<"photos" | "pencil" | "watercolor">("pencil");
  const [animateHands,setAnimateHands] = useState(true);
  const [monotone,setMonotone] = useState(BLUE_TINT);
  const [shadow,setShadow] = useState(PLUM_TINT);
  const [highlight,setHighlight] = useState(BLUE_TINT);
  return (
    <main className={`studio studio-${background}`}>
      <header className="masthead"><Link href="/" className="wordmark" aria-label="Joel's portrait">joel<span>.</span></Link><span className="edition">A LITTLE PRESENCE / 001</span><span className="live-note"><i />Right here with you</span></header>
      <section className="portrait-section" aria-labelledby="title">
        <div className="intro"><p className="eyebrow">LESS BODY. MORE PERSONALITY.</p><h1 id="title">Here. <em>Almost.</em></h1><p className="description">A familiar face. A little space. Your point of view.</p></div>
        <ReferenceTabs value={reference} onChange={setReference} />
        <div role="tabpanel" id={`panel-${reference==="now"?"then":"now"}`} aria-labelledby={`reference-${reference==="now"?"then":"now"}`} hidden />
        <div role="tabpanel" id={`panel-${reference}`} aria-labelledby={`reference-${reference}`} tabIndex={0}>
        <div className="stage"><FloatingPortrait key={reference} headAssetPath={reference==="now"?`/sprites/now${nowMode==="photos"?"":`/${nowMode}`}`:undefined} label={reference==="now" && nowMode==="photos"?"Joel, a floating head from the new video with photographic hands":undefined} headMode={reference==="now"?nowMode:headMode} animateHands={animateHands} monotoneColor={monotone} duotoneShadow={shadow} duotoneHighlight={highlight} /></div>
        <p className="interaction-hint"><span>↗</span> Move your cursor. I’ll follow your lead.</p>
        <div className="portrait-options">
          {reference==="now" && <fieldset className="background-picker"><legend>Portrait version</legend>
            <button type="button" aria-pressed={nowMode==="photos"} onClick={()=>setNowMode("photos")}>Video cutout</button>
            <button type="button" aria-pressed={nowMode==="pencil"} onClick={()=>setNowMode("pencil")}>Pencil sketch</button>
            <button type="button" aria-pressed={nowMode==="watercolor"} onClick={()=>setNowMode("watercolor")}>Watercolor</button>
          </fieldset>}
          {reference==="then" && <fieldset className="background-picker"><legend>Portrait version</legend>
            <button type="button" aria-pressed={headMode==="photos"} onClick={()=>setHeadMode("photos")}>Photo only</button>
            <button type="button" aria-pressed={headMode==="generated"} onClick={()=>setHeadMode("generated")}>AI simulated</button>
            <button type="button" aria-pressed={headMode==="monotone"} onClick={()=>setHeadMode("monotone")}><span className="swatch" style={{background:monotone}} />Monotone</button>
            <button type="button" aria-pressed={headMode==="duotone"} onClick={()=>setHeadMode("duotone")}><span className="swatch" style={{background:`linear-gradient(135deg, ${shadow} 50%, ${highlight} 50%)`}} />Duotone</button>
            <button type="button" aria-pressed={headMode==="oil"} onClick={()=>setHeadMode("oil")}>Oil painting</button>
            <button type="button" aria-pressed={headMode==="watercolor"} onClick={()=>setHeadMode("watercolor")}>Watercolor</button>
            <button type="button" aria-pressed={headMode==="pencil"} onClick={()=>setHeadMode("pencil")}>Pencil sketch</button>
            <button type="button" aria-pressed={headMode==="ascii"} onClick={()=>setHeadMode("ascii")}>ASCII</button>
          </fieldset>}
          <label className="hand-option"><input type="checkbox" checked={animateHands} onChange={event=>setAnimateHands(event.target.checked)} /> Let the hands change pose</label>
        </div>
        {reference==="then" && (headMode==="monotone" || headMode==="duotone") && <ToneControls key={headMode} mode={headMode} monotone={monotone} shadow={shadow} highlight={highlight} onMonotone={setMonotone} onShadow={setShadow} onHighlight={setHighlight} />}
        <p className="mode-note">{reference==="now" ? (nowMode==="pencil" ? "Your new smile, drawn in graphite. With matching sketched hands." : nowMode==="watercolor" ? "Your new smile in soft washes of color. Painted hands, and a little light shining through." : "Your new video, cut out frame by frame. Paired with the original photographic hands.") : headMode==="duotone" ? "Two colors, one familiar face. Color the shadows and highlights your way." : headMode==="monotone" ? "One color through the midtones, with deep shadows and bright highlights." : headMode==="ascii" ? "A familiar face, letter by letter. Head and hands, made entirely of characters." : headMode==="pencil" ? "A familiar face in graphite. Fine lines and soft shading, right down to the fingertips." : headMode==="watercolor" ? "Soft washes of color, from face to fingertips. A little light shines through." : headMode==="oil" ? "Thick brushwork and vivid color, from your face to your fingertips." : headMode==="generated" ? "A generated head in every direction, with matching generated hands." : "Original photographs, softly feathered at the edges. Bring your cursor near a hand."}</p>
        </div>
      </section>
      <footer className="studio-footer"><div className="footer-copy"><strong>Same me. Different atmosphere.</strong><span>The background fills in the rest.</span></div><fieldset className="background-picker"><legend>Set the scene</legend>{["light","dark","pattern"].map(value=><button key={value} type="button" aria-pressed={background===value} onClick={()=>setBackground(value)}><span className={`swatch swatch-${value}`} />{value==="pattern"?"Pattern":value[0].toUpperCase()+value.slice(1)}</button>)}</fieldset><span className="footer-signoff">A portrait with a point of view.</span></footer>
    </main>
  );
}
