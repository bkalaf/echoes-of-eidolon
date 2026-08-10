import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from "react";
import { forwardRef } from "react";

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
