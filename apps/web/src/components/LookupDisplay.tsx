import { lookupSearchText, type LookupPresentation } from "../domain/lookup-presentation";
import { useState } from "react";

export function LookupDisplay({ presentation, technicalDetails = true, nullLabel = "—" }: { presentation: LookupPresentation | null; technicalDetails?: boolean; nullLabel?: string }) {
  const [technicalOpen, setTechnicalOpen] = useState(false);
  if (!presentation) return <span aria-label="None" className="lookup-display lookup-display--null">{nullLabel}</span>;
  return <span className="lookup-display" data-search-text={lookupSearchText(presentation)}>
    <span className="lookup-display__primary">{presentation.primary}</span>
    {presentation.context.length > 0 && <span className="lookup-display__context">{presentation.context.join(" · ")}</span>}
    {technicalDetails && presentation.technicalId && <span className="lookup-display__technical">
      <button aria-expanded={technicalOpen} className="technical-details-toggle" onClick={() => setTechnicalOpen((open) => !open)} type="button">Technical details</button>
      {technicalOpen && <span className="technical-details-content"><code data-copy-value={presentation.technicalId}>{presentation.technicalId}</code><button className="technical-copy" onClick={() => void navigator.clipboard?.writeText(presentation.technicalId!)} type="button">Copy ID</button></span>}
    </span>}
  </span>;
}
