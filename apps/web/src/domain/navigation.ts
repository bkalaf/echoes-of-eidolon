import {
  canAccessAdministration,
  canAccessGame,
  type AuthorizationRole,
} from "./authorization";

export interface NavigationPrincipal {
  betaEligible: boolean;
  canPlay: boolean;
  membershipEntitled: boolean;
  participationEligible: boolean;
  role: AuthorizationRole;
}

export interface NavigationProjection {
  account: boolean;
  administration: boolean;
  game: boolean;
  home: true;
  signOut: boolean;
}

export function projectNavigation(
  principal: NavigationPrincipal | null,
  authenticated = principal !== null,
): NavigationProjection {
  return {
    account: authenticated,
    administration: principal ? canAccessAdministration(principal.role) : false,
    game: principal
      ? canAccessGame(principal.role, principal.betaEligible, principal.participationEligible)
      : false,
    home: true,
    signOut: authenticated,
  };
}
