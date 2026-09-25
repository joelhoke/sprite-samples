"use client";

import { useId, useState } from "react";
import { BLUE_TINT, PLUM_TINT, parseHex } from "./BlueTone";
import "./tone-controls.css";

function ColorField({label, value, onChange}: {label: string; value: string; onChange: (color: string) => void}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && parseHex(draft) === null;
  return <div className="tone-color-field">
    <span id={id}>{label}</span>
    <div className="tone-color-inputs">
      <input type="color" aria-label={`${label} color`} value={value} onChange={event=>onChange(event.target.value.toUpperCase())} />
      <input type="text" aria-label={`${label} hex`} value={draft ?? value} spellCheck={false} autoComplete="off" maxLength={7}
        aria-invalid={invalid} aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={event=>{const next=event.target.value;setDraft(next);const color=parseHex(next);if(color) onChange(color);}}
        onBlur={()=>setDraft(null)}
        onKeyDown={event=>{if(event.key==="Escape" || (event.key==="Enter" && !invalid)) {setDraft(null);event.currentTarget.blur();}}} />
    </div>
    {invalid && <small id={`${id}-error`}>Use six hex digits.</small>}
  </div>;
}

export function ToneControls({mode, monotone, shadow, highlight, onMonotone, onShadow, onHighlight}: {
  mode: "monotone" | "duotone";
  monotone: string; shadow: string; highlight: string;
  onMonotone: (color: string) => void; onShadow: (color: string) => void; onHighlight: (color: string) => void;
}) {
  const duo = mode === "duotone";
  return <fieldset className="tone-controls">
    <legend>{duo ? "Duotone colors" : "Monotone color"}</legend>
    <div className="tone-fields">
      {duo ? <>
        <ColorField label="Shadows" value={shadow} onChange={onShadow} />
        <ColorField label="Highlights" value={highlight} onChange={onHighlight} />
      </> : <ColorField label="Midtones" value={monotone} onChange={onMonotone} />}
      <div className="tone-actions">
        {duo && <button type="button" onClick={()=>{onShadow(highlight);onHighlight(shadow);}}>Swap colors</button>}
        <button type="button" onClick={()=>{if(duo) {onShadow(PLUM_TINT);onHighlight(BLUE_TINT);} else onMonotone(BLUE_TINT);}}>Reset colors</button>
      </div>
    </div>
    <div className="tone-ramp" aria-hidden="true" style={{background:duo ? `linear-gradient(90deg, ${shadow}, ${highlight})` : `linear-gradient(90deg, #000, ${monotone}, #fff)`}} />
  </fieldset>;
}
