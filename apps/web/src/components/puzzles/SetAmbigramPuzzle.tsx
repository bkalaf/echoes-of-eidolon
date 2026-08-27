import { memo, useMemo, useState } from "react";

import type { SetPlayerArtifact } from "../../server/puzzle-production-generators";
import type { ProductionPlayerSubmission } from "../../server/puzzle-production-validation";

function spokenMarks(expression: string) {
  return expression.replaceAll("U", " U mark ").replaceAll("I", " I mark ").replaceAll("(", " open scope ").replaceAll(")", " close scope ").replaceAll(/\s+/g, " ").trim();
}

export const SetAmbigramPuzzle = memo(function SetAmbigramPuzzle({ accessibleMode, artifact, onValidate }: {
  accessibleMode: boolean;
  artifact: SetPlayerArtifact;
  onValidate: (submission: ProductionPlayerSubmission) => Promise<{ correct: boolean }>;
}) {
  const universe = useMemo(() => [...new Set(Object.values(artifact.sets).flat())].sort((left, right) => left - right), [artifact.sets]);
  const [selected, setSelected] = useState<number[]>([]);
  const [status, setStatus] = useState("");
  const toggle = (member: number) => {
    setSelected((current) => current.includes(member) ? current.filter((value) => value !== member) : [...current, member].sort((left, right) => left - right));
    setStatus("");
  };
  const submit = async () => {
    const result = await onValidate({ kind: "set", members: selected });
    setStatus(result.correct ? "Set accepted. Its reading matches the seal." : "That set does not match the sealed reading.");
  };

  return <div className="stack">
    <div className="puzzle-set-cards">{Object.entries(artifact.sets).map(([name, members]) => <article className="puzzle-set-card" key={name}><h3>Card {name}</h3><p aria-label={`Card ${name} contains ${members.join(", ")}`}>{members.map((member) => <span className="puzzle-token" key={member}>{member}</span>)}</p></article>)}</div>
    <fieldset className="puzzle-scope-cards"><legend>Surviving scope ribbons</legend>{artifact.scopeCards.map((expression, index) => <div className="puzzle-scope-card" key={expression}><span aria-hidden="true">{index + 1}</span><span aria-label={spokenMarks(expression)} className="puzzle-scope-ribbon">{expression}</span>{accessibleMode && <span>{spokenMarks(expression)}</span>}</div>)}</fieldset>
    <aside aria-label="Wax-seal result clue" className="puzzle-seal"><strong>The intact collection bears this seal</strong><span>{artifact.seal.memberCount} members</span><span>total {artifact.seal.memberTotal}</span><span>product {artifact.seal.memberProduct}</span></aside>
    <fieldset><legend>Build the ordered result set</legend><div className="action-row">{universe.map((member) => {
      const active = selected.includes(member);
      return <button aria-label={`${active ? "Remove" : "Select"} member ${member}`} aria-pressed={active} className="button" key={member} onClick={() => toggle(member)} type="button">{member}</button>;
    })}</div></fieldset>
    <p aria-live="polite">Selected set: {selected.length ? `{ ${selected.join(", ")} }` : "empty"}</p>
    <button className="button button--gold" disabled={!selected.length} onClick={() => void submit()} type="button">Check selected set</button>
    {status && <p className={`notice ${status.startsWith("Set accepted") ? "notice--good" : "notice--bad"}`} role="status">{status}</p>}
  </div>;
});
