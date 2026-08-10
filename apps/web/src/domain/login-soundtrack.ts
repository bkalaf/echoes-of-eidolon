import { loginSoundtrackKeys, managedAssetUrl, type ManagedAssetKey } from "../content/managed-assets";

const storageKey = "echoes.login-soundtrack";

export function chooseLoginSoundtrack(randomValue: number): (typeof loginSoundtrackKeys)[number] {
  const bounded = Number.isFinite(randomValue) ? Math.min(Math.max(randomValue, 0), 0.999999999999) : 0;
  return loginSoundtrackKeys[Math.floor(bounded * loginSoundtrackKeys.length)]!;
}

export function queueRandomLoginSoundtrack(
  storage: Pick<Storage, "setItem"> = window.sessionStorage,
  randomValue = Math.random(),
): ManagedAssetKey {
  const selected = chooseLoginSoundtrack(randomValue);
  storage.setItem(storageKey, selected);
  return selected;
}

export function clearQueuedLoginSoundtrack(storage: Pick<Storage, "removeItem"> = window.sessionStorage): void {
  storage.removeItem(storageKey);
}

export function consumeQueuedLoginSoundtrack(
  storage: Pick<Storage, "getItem" | "removeItem"> = window.sessionStorage,
): string | undefined {
  const selected = storage.getItem(storageKey);
  storage.removeItem(storageKey);
  return loginSoundtrackKeys.includes(selected as (typeof loginSoundtrackKeys)[number])
    ? managedAssetUrl(selected as (typeof loginSoundtrackKeys)[number])
    : undefined;
}
