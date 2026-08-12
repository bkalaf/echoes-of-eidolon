import type { Path, UseFormRegister } from "react-hook-form";

import { OtpInput, PasswordInput } from "../ui/controls";

export interface PasswordResetValues {
  code: string;
  confirmPassword: string;
  email: string;
  password: string;
}

export function PasswordResetFields<T extends PasswordResetValues>({
  busy,
  preservedEmail,
  register,
  resend,
}: {
  busy: boolean;
  preservedEmail: string;
  register: UseFormRegister<T>;
  resend: () => void;
}) {
  return <>
    {preservedEmail
      ? <div className="account-value"><span className="account-value__label">Account/email</span><span className="account-value__text">{preservedEmail}</span></div>
      : <label className="field">Account/email<input autoComplete="email" className="input" type="email" {...register("email" as Path<T>, { required: true })} /></label>}
    <label className="field">Reset code<OtpInput {...register("code" as Path<T>, { required: true, pattern: /^[0-9]{6}$/ })} /></label>
    <PasswordInput autoComplete="new-password" label="New password" {...register("password" as Path<T>, { required: true })} />
    <PasswordInput autoComplete="new-password" label="Confirm new password" {...register("confirmPassword" as Path<T>, { required: true })} />
    <button className="button" disabled={busy} onClick={resend} type="button">Resend code</button>
  </>;
}
