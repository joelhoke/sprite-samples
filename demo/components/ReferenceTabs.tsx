"use client";

export type ReferenceVersion = "then" | "now";

export function ReferenceTabs({value,onChange}: {value: ReferenceVersion; onChange: (value: ReferenceVersion) => void}) {
  const versions: ReferenceVersion[] = ["then","now"];
  return <div className="reference-tabs" role="tablist" aria-label="Head reference">
    {versions.map(version=><button key={version} type="button" role="tab" id={`reference-${version}`}
      aria-selected={value===version} aria-controls={`panel-${version}`} tabIndex={value===version?0:-1}
      onClick={()=>onChange(version)} onKeyDown={event=>{
        if (!["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) return;
        event.preventDefault();
        const next=event.key==="Home"?"then":event.key==="End"?"now":version==="then"?"now":"then";
        onChange(next);
        document.getElementById(`reference-${next}`)?.focus();
      }}>
      <strong>{version==="then"?"Then":"Now"}</strong>
      <span>{version==="then"?"Original · 8 styles":"New reference · 3 styles"}</span>
    </button>)}
  </div>;
}
