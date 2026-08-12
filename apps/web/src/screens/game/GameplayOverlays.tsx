import { useQuery } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";

import type { PageManifestEntry } from "../../lib/page-manifest";

interface GameplayParty {
  partyId: string;
  worldKey: "CONCORD" | "RUIN" | "SCHISM";
  currency: { asset: string; name: string };
  purse: number;
  withdrawal: null | { limit: number; nextLimitIncreaseAtGameMinute: string | null; remaining: number; used: number };
  withdrawals: Array<{ amount: number; occurredAtGameMinute: string }>;
  inventory: Array<{ itemId: string; name: string; quantity: number }>;
  companions: Array<{ companionKey: string; condition: "GREEN" | "YELLOW" | "ORANGE" | "RED" | null; conditionSentence: string | null; name: string; transformed: boolean }>;
  currentLocation: null | { name: string; services: Array<"BANK" | "INN">; innActions: null | Record<"STAY" | "EAT", { cost: number; rest: number; morale: number; comfort: number }> };
}

function useGameplayParty() {
  return useQuery({ queryKey: ["player", "gameplay"], queryFn: async () => {
    const response = await fetch("/api/player/gameplay");
    const result = await response.json() as { error?: string; party: GameplayParty | null };
    if (!response.ok) throw new Error(result.error ?? "Player gameplay state could not be loaded.");
    return result.party;
  }, retry: false });
}

function Overlay({ children, title }: { children: ReactNode; title: string }) {
  return <div className="modal-backdrop game-modal"><section aria-labelledby="gameplay-overlay-title" aria-modal="true" className="modal-card gameplay-overlay" role="dialog"><div className="action-row action-row--between"><h2 id="gameplay-overlay-title">{title}</h2><a aria-label={`Close ${title}`} className="button" href="/game">×</a></div>{children}</section></div>;
}

function LoadingParty({ query }: { query: ReturnType<typeof useGameplayParty> }) {
  if (query.isPending) return <p className="notice">Loading current party…</p>;
  if (query.isError) return <p className="notice notice--bad" role="alert">{query.error.message}</p>;
  if (!query.data) return <p className="notice notice--warn">No party/world instance is active.</p>;
  return null;
}

export function PartyHealthOverlay() {
  const query = useGameplayParty();
  return <Overlay title="Party Health"><LoadingParty query={query} />{query.data && <div className="party-health-grid">{query.data.companions.map((companion) => <article className={`party-health-card condition-${(companion.condition ?? "unavailable").toLowerCase()}`} key={companion.companionKey}><div><p className="kicker">COMPANION {companion.companionKey}</p><h3>{companion.name}</h3><p>{companion.conditionSentence ?? "Recovery condition is not yet available."}</p></div><div className="companion-portrait" aria-label={`${companion.name} portrait placeholder`}>{companion.name.charAt(0)}{companion.transformed && <span aria-label="Transformed" className="transformed-crown">♛</span>}</div></article>)}</div>}</Overlay>;
}

export function InventoryOverlay() {
  const query = useGameplayParty();
  const [selectedId, setSelectedId] = useState<string>();
  const selected = query.data?.inventory.find((item) => item.itemId === selectedId) ?? query.data?.inventory[0];
  return <Overlay title="Inventory"><LoadingParty query={query} />{query.data && <><div className="action-row action-row--between"><strong>{query.data.currency.name} {query.data.purse}</strong><span>Rolling allowance {query.data.withdrawal?.remaining ?? "unconfigured"}</span></div><div className="inventory-layout"><div aria-label="Inventory stacks" className="inventory-grid">{query.data.inventory.map((item) => <button aria-pressed={selected?.itemId === item.itemId} className="inventory-tile" key={item.itemId} onClick={() => setSelectedId(item.itemId)} type="button"><span>{item.name}</span><span className="inventory-quantity">{item.quantity}</span></button>)}</div><aside className="card inventory-detail"><div aria-label="Item artwork unavailable" className="inventory-detail-art">◇</div><h3>{selected?.name ?? "No carried items"}</h3>{selected && <p>Authored item details are unavailable.</p>}</aside></div></>}</Overlay>;
}

export function WithdrawalLedgerOverlay() {
  const query = useGameplayParty();
  return <Overlay title="Withdrawal Record"><LoadingParty query={query} />{query.data && <><p><strong>{query.data.currency.name}</strong> · purse {query.data.purse}</p>{query.data.withdrawal ? <><p>Rolling 7-day limit {query.data.withdrawal.limit} · remaining {query.data.withdrawal.remaining}</p>{query.data.withdrawal.nextLimitIncreaseAtGameMinute && <p>Next limit increase at game minute {query.data.withdrawal.nextLimitIncreaseAtGameMinute}</p>}</> : <p>No withdrawal policy is configured.</p>}<div className="table-scroll"><table className="simple-table"><thead><tr><th>Game time</th><th>Amount</th></tr></thead><tbody>{query.data.withdrawals.map((entry, index) => <tr key={`${entry.occurredAtGameMinute}-${index}`}><td>{entry.occurredAtGameMinute}</td><td>{entry.amount} {query.data!.currency.name}</td></tr>)}</tbody></table></div></>}</Overlay>;
}

export function BankOverlay() {
  const query = useGameplayParty();
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const atBank = query.data?.currentLocation?.services.includes("BANK") === true;
  return <Overlay title="Bank"><LoadingParty query={query} />{query.data && <>{atBank ? <form onSubmit={async (event) => { event.preventDefault(); const response = await fetch("/api/player/bank-withdraw", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ amount: Number(amount) }) }); const result = await response.json() as { error?: string; remaining?: number }; setMessage(response.ok ? `Withdrawal complete. ${result.remaining} remains in the rolling allowance.` : result.error ?? "Withdrawal failed."); await query.refetch(); }}><p>{query.data.currentLocation?.name} · {query.data.currency.name}</p><label className="field">Withdrawal amount<input className="input" max={query.data.withdrawal?.remaining} min={1} onChange={(event) => setAmount(event.target.value)} required type="number" value={amount} /></label><button className="button button--gold" disabled={!query.data.withdrawal || Number(amount) > query.data.withdrawal.remaining}>Withdraw</button></form> : <p className="notice notice--warn">Withdrawals are available only from the current-world Bank interaction.</p>}{message && <p className="notice" role="status">{message}</p>}</>}</Overlay>;
}

export function InnOverlay() {
  const query = useGameplayParty();
  const atInn = query.data?.currentLocation?.services.includes("INN") === true;
  const [message, setMessage] = useState("");
  const act = async (action: "STAY" | "EAT") => { const response = await fetch("/api/player/inn", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }); const result = await response.json() as { error?: string }; setMessage(response.ok ? `${action === "STAY" ? "Stay" : "Meal"} completed.` : result.error ?? "Inn action failed."); if (response.ok) await query.refetch(); };
  return <Overlay title="Inn"><LoadingParty query={query} />{query.data && (atInn ? <><p>{query.data.currentLocation?.name}</p><p>Lodging, food, and recovery are owned by this current-world Inn.</p>{query.data.currentLocation?.innActions ? <div className="grid-2">{(["STAY", "EAT"] as const).map((action) => { const effect = query.data!.currentLocation!.innActions![action]; return <article className="card" key={action}><h3>{action === "STAY" ? "Stay" : "Eat"}</h3><p>Rest +{effect.rest} · Morale +{effect.morale} · Comfort +{effect.comfort}</p><button className={`button ${action === "STAY" ? "button--gold" : ""}`} onClick={() => void act(action)} type="button">{action === "STAY" ? "Stay" : "Eat"} · {effect.cost} {query.data!.currency.name}</button></article>; })}</div> : <p className="notice notice--warn">This Inn has no authored stay/eat recovery policy.</p>}<div className="action-row"><a className="button" href="/game?state=GAME_MTG01_MORNING_MEETING_V2">Morning Meeting</a><a className="button" href="/game?state=GAME_MTG02_EVENING_MEETING_V2">Evening Meeting</a></div>{message && <p className="notice" role="status">{message}</p>}</> : <p className="notice notice--warn">The current location is not an Inn.</p>)}</Overlay>;
}

export function MeetingOverlay({ evening }: { evening: boolean }) {
  const query = useGameplayParty();
  const [text, setText] = useState("");
  const [history, setHistory] = useState<Array<{ speaker: string; text: string }>>([]);
  const [recording, setRecording] = useState(false);
  const [voiceMessage, setVoiceMessage] = useState("");
  const recorder = useRef<MediaRecorder | null>(null);
  const send = async () => {
    if (!text.trim()) return;
    const submitted = text.trim(); setText(""); setHistory((rows) => [...rows, { speaker: "You", text: submitted }]);
    const response = await fetch("/api/player/runtime", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ inputText: submitted }) });
    const result = await response.json() as { responseText?: string };
    if (response.ok && result.responseText) setHistory((rows) => [...rows, { speaker: "Companion", text: result.responseText! }]);
  };
  const toggleRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") { setVoiceMessage("Voice recording is unavailable in this browser. Text chat remains available."); return; }
    if (recorder.current && recorder.current.state === "recording") { recorder.current.stop(); setRecording(false); setVoiceMessage("Recording stopped. Voice-provider submission is unavailable; text chat remains available."); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorder.current = new MediaRecorder(stream); recorder.current.onstop = () => stream.getTracks().forEach((track) => track.stop()); recorder.current.start(); setRecording(true); setVoiceMessage("Recording locally. Select Stop when finished; voice-provider submission is unavailable.");
    } catch {
      setRecording(false); setVoiceMessage("Microphone access was unavailable. Text chat remains available.");
    }
  };
  const title = evening ? "Evening Meeting" : "Morning Meeting";
  return <Overlay title={title}><p>{evening ? "Discuss and process what the party learned." : "Set up the day with the party."}</p><LoadingParty query={query} />{query.data && <div aria-label="Meeting companion roster" className="meeting-roster">{query.data.companions.map((companion) => <div key={companion.companionKey}><span className="companion-portrait">{companion.name.charAt(0)}</span><small>{companion.name}</small></div>)}</div>}<div aria-label={`${title} conversation`} className="meeting-history">{history.length ? history.map((entry, index) => <p key={index}><strong>{entry.speaker}</strong> {entry.text}</p>) : <p>No conversation has been recorded in this meeting.</p>}</div><label className="field">Message<textarea className="textarea" onChange={(event) => setText(event.target.value)} value={text} /></label><div className="action-row"><button aria-pressed={recording} className="button" onClick={() => void toggleRecording()} type="button">{recording ? "Stop" : "Talk"}</button><button className="button button--gold" disabled={!text.trim()} onClick={() => void send()} type="button">Send</button></div>{voiceMessage && <p className="notice notice--warn" role="status">{voiceMessage}</p>}</Overlay>;
}

export function GameplayOverlayForScreen({ screen }: { screen: PageManifestEntry }) {
  if (screen.screenId === "GAME_HEALTH01_PARTY_HEALTH") return <PartyHealthOverlay />;
  if (screen.screenId.startsWith("GAME_INV01_")) return <InventoryOverlay />;
  if (screen.screenId.startsWith("GAME_LED01_")) return <WithdrawalLedgerOverlay />;
  if (screen.screenId.startsWith("GAME_BANK01_")) return <BankOverlay />;
  if (screen.screenId === "GAME_INN01_INN") return <InnOverlay />;
  if (screen.screenId === "GAME_MTG01_MORNING_MEETING_V2") return <MeetingOverlay evening={false} />;
  if (screen.screenId === "GAME_MTG02_EVENING_MEETING_V2") return <MeetingOverlay evening />;
  return null;
}
