import { useMemo, useState } from "react";

import type { PublicProductionPuzzle } from "../../server/puzzle-production-generators";
import type { ProductionPlayerSubmission } from "../../server/puzzle-production-validation";

type Carrier = Extract<PublicProductionPuzzle["carrier"], { kind: "SET_AMBIGRAM" }>;

function spokenExpression(expression: string) {
  return expression.replaceAll("UNION", "union").replaceAll("INTERSECT", "intersection").replaceAll("(", "open scope ").replaceAll(")", " close scope");
}

export function SetAmbigramPuzzle({ accessibleMode, carrier, onValidate }: {
  accessibleMode: boolean;
  carrier: Carrier;
  onValidate: (submission: ProductionPlayerSubmission) => Promise<{ correct: boolean }>;
}) {
  const universe = useMemo(() => [...new Set(Object.values(carrier.sets).flat())].sort((left, right) => left - right), [carrier.sets]);
  const [selected, setSelected] = useState<number[]>([]);
  const [status, setStatus] = useState("");
  const [count, total, product] = carrier.resultChecksum.split(":");
  const toggle = (member: number) => {
    setSelected((current) => current.includes(member) ? current.filter((value) => value !== member) : [...current, member].sort((left, right) => left - right));
    setStatus("");
  };
  const submit = async () => {
    const result = await onValidate({ kind: "set", members: selected });
    setStatus(result.correct ? "Set accepted. Its reading matches the seal." : "That set does not match the sealed reading.");
  };

  return <div className="stack">
    <p>The same U and I shapes can be read as letters or as operations. In an operator slot on the scope ribbons, <strong>U</strong> means <span>Union</span> and <strong>I</strong> means <span>Intersection</span>; the parentheses decide their reach.</p>
    <div className="puzzle-set-cards">{Object.entries(carrier.sets).map(([name, members]) => <article className="puzzle-set-card" key={name}><h3>Set {name}</h3><p aria-label={`Set ${name} contains ${members.join(", ")}`}>{members.map((member) => <span className="puzzle-token" key={member}>{member}</span>)}</p></article>)}</div>
    <fieldset className="puzzle-scope-cards"><legend>Possible scoped readings</legend>{carrier.expressions.map((expression, index) => <div className="puzzle-scope-card" key={expression}><span aria-hidden="true">{index + 1}</span><code aria-label={spokenExpression(expression)}>{expression.replaceAll("UNION", "∪").replaceAll("INTERSECT", "∩")}</code>{accessibleMode && <span>{spokenExpression(expression)}</span>}</div>)}</fieldset>
    <aside aria-label="Wax-seal result clue" className="puzzle-seal"><strong>The matching result bears this seal</strong><span>{count} members</span><span>member total {total}</span><span>member product {product}</span></aside>
    <fieldset><legend>Build the ordered result set</legend><div className="action-row">{universe.map((member) => {
      const active = selected.includes(member);
      return <button aria-label={`${active ? "Remove" : "Select"} member ${member}`} aria-pressed={active} className="button" key={member} onClick={() => toggle(member)} type="button">{member}</button>;
    })}</div></fieldset>
    <p aria-live="polite">Selected set: {selected.length ? `{ ${selected.join(", ")} }` : "empty"}</p>
    <button className="button button--gold" disabled={!selected.length} onClick={() => void submit()} type="button">Check selected set</button>
    {status && <p className={`notice ${status.startsWith("Set accepted") ? "notice--good" : "notice--bad"}`} role="status">{status}</p>}
  </div>;
}
