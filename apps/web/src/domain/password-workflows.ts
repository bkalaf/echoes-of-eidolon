export const pendingResetEmailKey = "eidolon.auth.pending-reset-email";

export function passwordsMatch(password: string | undefined, confirmation: string | undefined): boolean {
  return Boolean(password) && password === confirmation;
}

export function preserveResetIdentity(email: string): void {
  window.sessionStorage.setItem(pendingResetEmailKey, email.trim().toLowerCase());
}
