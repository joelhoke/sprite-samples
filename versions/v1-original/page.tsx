"use client";

import { useState } from "react";
import { FloatingPortrait } from "../components/FloatingPortrait";
import Link from "next/link";

export default function Home() {
  const [background,setBackground] = useState("light");
  return (
    <main className={`studio studio-${background}`}>
      <header className="masthead"><Link href="/" className="wordmark" aria-label="Joel's portrait">joel<span>.</span></Link><span className="edition">A LITTLE PRESENCE / 001</span><span className="live-note"><i />Right here with you</span></header>
      <section className="portrait-section" aria-labelledby="title">
        <div className="intro"><p className="eyebrow">LESS BODY. MORE PERSONALITY.</p><h1 id="title">Here. <em>Almost.</em></h1><p className="description">A familiar face. A little space. Your point of view.</p></div>
        <div className="stage"><FloatingPortrait /></div>
        <p className="interaction-hint"><span>↗</span> Move your cursor. I’ll follow your lead.</p>
      </section>
      <footer className="studio-footer"><div className="footer-copy"><strong>Same me. Different atmosphere.</strong><span>The background fills in the rest.</span></div><fieldset className="background-picker"><legend>Set the scene</legend>{["light","dark","pattern"].map(value=><button key={value} type="button" aria-pressed={background===value} onClick={()=>setBackground(value)}><span className={`swatch swatch-${value}`} />{value==="pattern"?"Pattern":value[0].toUpperCase()+value.slice(1)}</button>)}</fieldset><span className="footer-signoff">A portrait with a point of view.</span></footer>
    </main>
  );
}
