import { lookupSearchText, type LookupPresentation } from "../domain/lookup-presentation";

export function LookupDisplay({ presentation }: { presentation: LookupPresentation | null }) {
  if (!presentation) return <span aria-label="None" className="lookup-display lookup-display--null">—</span>;
  return <span className="lookup-display" data-search-text={lookupSearchText(presentation)}>
    <span className="lookup-display__primary">{presentation.primary}</span>
    {presentation.secondary && <span className="lookup-display__secondary" data-copy-value={presentation.secondary}>{presentation.secondary}</span>}
    {presentation.context.length > 0 && <span className="lookup-display__context">{presentation.context.join(" · ")}</span>}
  </span>;
}

