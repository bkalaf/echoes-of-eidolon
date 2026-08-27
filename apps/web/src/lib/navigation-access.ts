import { useEffect, useState, useSyncExternalStore } from "react";

import { authorizationRoles } from "../domain/authorization";
import {
  projectNavigation,
  type NavigationPrincipal,
  type NavigationProjection,
} from "../domain/navigation";
import { authClient } from "./auth-client";

interface AccessState {
  access: NavigationPrincipal | null;
  status: "error" | "idle" | "loading" | "ready";
  userId: string | null;
}

const subscribeToHydration = () => () => undefined;
const clientHydrationSnapshot = () => true;
const serverHydrationSnapshot = () => false;

function isNavigationPrincipal(value: unknown): value is NavigationPrincipal {
  if (!value || typeof value !== "object") return false;
  const access = value as Record<string, unknown>;
  return typeof access.betaEligible === "boolean"
    && typeof access.canPlay === "boolean"
    && typeof access.membershipEntitled === "boolean"
    && typeof access.participationEligible === "boolean"
    && typeof access.role === "string"
    && authorizationRoles.includes(access.role as NavigationPrincipal["role"]);
}

export interface NavigationAccessState {
  access: NavigationPrincipal | null;
  accessStatus: AccessState["status"];
  hydrated: boolean;
  navigation: NavigationProjection;
  session: ReturnType<typeof authClient.useSession>;
}

export function useNavigationAccess(): NavigationAccessState {
  const session = authClient.useSession();
  const hydrated = useSyncExternalStore(subscribeToHydration, clientHydrationSnapshot, serverHydrationSnapshot);
  const userId = hydrated ? session.data?.user.id ?? null : null;
  const [state, setState] = useState<AccessState>({ access: null, status: "idle", userId: null });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    if (!userId) {
      return () => controller.abort();
    }

    void fetch("/api/player/access", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Player access could not be verified.");
        const result: unknown = await response.json();
        if (!isNavigationPrincipal(result)) throw new Error("Player access response is invalid.");
        return result;
      })
      .then((access) => {
        if (active) setState({ access, status: "ready", userId });
      })
      .catch((error: unknown) => {
        if (active && !(error instanceof DOMException && error.name === "AbortError")) {
          setState({ access: null, status: "error", userId });
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [userId]);

  const current = state.userId === userId ? state : { access: null, status: userId ? "loading" as const : "idle" as const };
  return {
    access: current.access,
    accessStatus: current.status,
    hydrated,
    navigation: projectNavigation(current.access, Boolean(userId)),
    session,
  };
}
