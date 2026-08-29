import { useMemo, useState } from "react";

import { lookupSearchText, LookupPresentationError, ownerFormLookupPresentationFor } from "../domain/lookup-presentation";
import { LookupDisplay } from "./LookupDisplay";
import { ownerNullLabel } from "../domain/owner-presentation";

const pageSize = 50;

export function RelationAutocomplete({
  disabled,
  error,
  idField,
  initialRecord,
  label,
  loading,
  nullable,
  records,
  relationType,
  value,
  onChange,
  onOpen,
}: {
  disabled: boolean;
  error?: Error | null;
  idField: string;
  initialRecord?: Record<string, unknown>;
  label: string;
  loading: boolean;
  nullable: boolean;
  records: Record<string, unknown>[];
  relationType: string;
  value: string;
  onChange: (value: string) => void;
  onOpen?: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const selectedRecord = records.find((record) => String(record[idField]) === value) ?? initialRecord;
  let selectedPresentation = null;
  let presentationError: string | null = null;
  try { selectedPresentation = ownerFormLookupPresentationFor(relationType, selectedRecord); }
  catch (caught) { presentationError = caught instanceof LookupPresentationError ? caught.message : String(caught); }
  const matching = useMemo(() => records.flatMap((record) => {
    try {
      const presentation = ownerFormLookupPresentationFor(relationType, record);
      return !search.trim() || lookupSearchText(presentation).includes(search.trim().toLocaleLowerCase()) ? [{ presentation, record }] : [];
    } catch { return []; }
  }), [records, relationType, search]);
  const pageCount = Math.max(1, Math.ceil(matching.length / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = matching.slice(currentPage * pageSize, (currentPage + 1) * pageSize);
  const select = (index: number) => {
    const option = visible[index];
    if (!option) return;
    onChange(String(option.record[idField]));
    setSearch("");
    setPage(0);
    setActiveIndex(0);
    setOpen(false);
  };
  const openLookup = () => {
    if (disabled || open) return;
    setOpen(true);
    onOpen?.();
  };
  return <fieldset className="field span-2 relation-autocomplete" disabled={disabled}>
    <legend>{label}</legend>
    <LookupDisplay nullLabel={ownerNullLabel(label)} presentation={selectedPresentation} />
    <label className="field">Search {relationType} by name, context, or technical ID
      <input
        aria-activedescendant={open && visible[activeIndex] ? `${relationType}-option-${currentPage * pageSize + activeIndex}` : undefined}
        aria-controls={`${relationType}-lookup-options`}
        aria-expanded={open}
        aria-label={`Search ${relationType}`}
        aria-autocomplete="list"
        className="input"
        role="combobox"
        type="search"
        value={search}
        onClick={openLookup}
        onFocus={openLookup}
        onChange={(event) => { openLookup(); setSearch(event.target.value); setPage(0); setActiveIndex(0); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); openLookup(); setActiveIndex((index) => Math.min(index + 1, visible.length - 1)); }
          if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
          if (event.key === "Enter") { event.preventDefault(); select(activeIndex); }
          if (event.key === "Escape") { setOpen(false); setSearch(""); setPage(0); setActiveIndex(0); }
        }}
      />
    </label>
    {open && loading && <small role="status">Loading {relationType} choices…</small>}
    {open && error && <p className="notice notice--bad" role="alert">{error.message}</p>}
    {presentationError && <p className="notice notice--bad" role="alert">{presentationError}</p>}
    {open && !loading && !error && <p className="lookup-match-count" role="status">{matching.length} matches · showing {matching.length ? currentPage * pageSize + 1 : 0}–{Math.min((currentPage + 1) * pageSize, matching.length)} of {records.length}</p>}
    {open && <div className="lookup-option-list" id={`${relationType}-lookup-options`} role="listbox">{visible.map(({ presentation, record }, index) => {
      const id = String(record[idField]);
      return <div aria-selected={id === value} className={`lookup-option${index === activeIndex ? " is-active" : ""}`} id={`${relationType}-option-${currentPage * pageSize + index}`} key={id} onMouseDown={(event) => { event.preventDefault(); select(index); }} role="option"><LookupDisplay presentation={presentation} technicalDetails={false} /></div>;
    })}</div>}
    {open && !loading && !error && matching.length === 0 && <p className="empty-state">No {relationType} records match this search.</p>}
    {open && pageCount > 1 && <div className="action-row lookup-pagination"><button className="button button--small" disabled={currentPage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))} type="button">Previous</button><span>Page {currentPage + 1} of {pageCount}</span><button className="button button--small" disabled={currentPage >= pageCount - 1} onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))} type="button">Next</button></div>}
    {nullable && value && <button className="button button--small" onClick={() => onChange("")} type="button">Clear {label}</button>}
  </fieldset>;
}
