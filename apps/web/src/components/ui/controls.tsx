import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { forwardRef, useId } from "react";

import { numericControlContracts, type NumericControlKey } from "../../domain/numeric-controls";

type ButtonVariant = "default" | "gold" | "danger" | "good";

export function Button({
  variant = "default",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      {...props}
      className={["button", `button--${variant}`, className].filter(Boolean).join(" ")}
    />
  );
}

export function Field({
  label,
  hint,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
}) {
  const id = props.id ?? props.name;
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <input {...props} id={id} className="input" />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function HardenedSelect({
  label,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  children: ReactNode;
}) {
  const id = props.id ?? props.name;
  return (
    <label className="field" htmlFor={id}>
      <span>{label}</span>
      <select {...props} id={id} className="select select--hardened">
        {children}
      </select>
    </label>
  );
}

export function Chip({ children, tone = "cyan" }: { children: ReactNode; tone?: string }) {
  return <span className={`chip chip--${tone}`}>{children}</span>;
}

function enumTokenLabel(token: string): string {
  return token
    .split("_")
    .map((word) => `${word.charAt(0)}${word.slice(1).toLowerCase()}`)
    .join(" ");
}

export function FiniteChipSelection({
  allowedTokens,
  label,
  multiple = false,
  onChange,
  selectedTokens,
}: {
  allowedTokens: readonly string[];
  label: string;
  multiple?: boolean;
  onChange: (tokens: string[]) => void;
  selectedTokens: readonly string[];
}) {
  const labelId = useId();
  const orderedAllowed = [...allowedTokens].sort((left, right) => left.localeCompare(right));
  const allowed = new Set(orderedAllowed);
  if (allowed.size !== orderedAllowed.length) throw new Error("Finite selections require unique allowed tokens.");
  if (selectedTokens.some((token) => !allowed.has(token))) throw new Error("Finite selection contains an unregistered token.");
  if (!multiple && selectedTokens.length > 1) throw new Error("Single selection accepts at most one token.");

  const selected = orderedAllowed.filter((token) => selectedTokens.includes(token));
  const unselected = orderedAllowed.filter((token) => !selectedTokens.includes(token));
  const tone = (token: string) => orderedAllowed.indexOf(token) % 8;
  const select = (token: string) => onChange(multiple ? [...selected, token] : [token]);
  const clear = (token: string) => onChange(selected.filter((entry) => entry !== token));

  return <div className="finite-selection"><strong id={labelId}>{label}</strong><div aria-labelledby={labelId} className="finite-selection__selected" role="group">{selected.length === 0 ? <span className="muted">No value selected</span> : selected.map((token) => <button aria-label={`Clear ${enumTokenLabel(token)}`} aria-pressed="true" className={`finite-chip finite-chip--tone-${tone(token)}`} data-token={token} key={token} onClick={() => clear(token)} type="button" value={token}>{enumTokenLabel(token)} <span aria-hidden="true">×</span></button>)}</div>{unselected.length > 0 && <details className="finite-selection__options"><summary>Add value</summary><div>{unselected.map((token) => <button aria-label={`Select ${enumTokenLabel(token)}`} aria-pressed="false" className={`finite-chip finite-chip--tone-${tone(token)}`} data-token={token} key={token} onClick={() => select(token)} type="button" value={token}>{enumTokenLabel(token)}</button>)}</div></details>}</div>;
}

export const OtpInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "inputMode" | "maxLength" | "minLength" | "pattern" | "type">>(function OtpInput({ className = "", onInput, ...props }, ref) {
  return <input
    {...props}
    autoComplete="one-time-code"
    className={["input", "input--otp", className].filter(Boolean).join(" ")}
    inputMode="numeric"
    maxLength={6}
    minLength={6}
    onInput={(event) => {
      event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 6);
      onInput?.(event);
    }}
    pattern="[0-9]{6}"
    ref={ref}
    type="text"
  />;
});

export function BoundedNumberField({ control, defaultValue }: { control: NumericControlKey; defaultValue?: number }) {
  const contract = numericControlContracts[control];
  return <label className="field">{contract.label}<input className="input" defaultValue={defaultValue} max={contract.max} min={contract.min} step={contract.step} type="number" /></label>;
}
