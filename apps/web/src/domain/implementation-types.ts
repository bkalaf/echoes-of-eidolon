import type { Prisma } from "../generated/prisma/client";
import type { AuthorizationRole } from "./authorization";
import type { PageManifestEntry, ShellKind } from "../lib/page-manifest";

export type PersistedEntityName = keyof Prisma.TypeMap["model"];
export type PersistedEntity<Name extends PersistedEntityName> = Prisma.TypeMap["model"][Name]["payload"]["scalars"];
export type PersistedEntityMap = { [Name in PersistedEntityName]: PersistedEntity<Name> };

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

export interface ApiContract<RequestBody, ResponseBody> {
  request: RequestBody;
  response: ResponseBody;
}

type EmptyRequest = Record<never, never>;
type ErrorResponse = { error: string };
type MutationResult<Key extends string> = { [Property in Key]: true } | ErrorResponse;

export interface AccountOrderSummary {
  orderId: string;
  createdAt: string;
  status: string;
  totalCents: number;
}
export interface AccountSessionProjection {
  sessionId: string;
  current: boolean;
  lastActivityAt: string;
  expiresAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}
export interface PlayerAccessResponse {
  betaEligible: boolean;
  canPlay: boolean;
  membershipEntitled: boolean;
  participationEligible: boolean;
  role: AuthorizationRole;
  voiceWindowSeconds: number;
}
export interface ImportResponse { changed: number; unchanged: number; }
export type BulkApiAction =
  | { action: "generate" | "enable-keyless" }
  | { action: "revoke"; sessionId: string }
  | { action: "apply" | "delete" | "rerun"; envelopeId: string };
export interface BulkApiOverviewResponse extends JsonObject {
  activeSession: JsonObject | null;
  audits: JsonObject[];
  envelopes: JsonObject[];
  maximumLifetimeMinutes: number;
  state: "OFF" | "KEYED" | "KEYLESS";
}

export interface ApiContractMap {
  "GET /api/account/membership": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "GET /api/account/orders": ApiContract<EmptyRequest, { orders: AccountOrderSummary[] } | ErrorResponse>;
  "GET /api/account/orders/:orderId": ApiContract<EmptyRequest, { order: JsonObject } | ErrorResponse>;
  "GET /api/account/sessions": ApiContract<EmptyRequest, { sessions: AccountSessionProjection[] } | ErrorResponse>;
  "POST /api/account/sessions/revoke-all-other": ApiContract<EmptyRequest, { revokedCount: number } | ErrorResponse>;
  "POST /api/account/sessions/revoke-other": ApiContract<{ sessionId: string }, MutationResult<"revoked">>;
  "GET /api/account/settings": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "PUT /api/account/settings": ApiContract<JsonObject, JsonObject | ErrorResponse>;
  "GET /api/admin/accounts": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "GET /api/admin/accounts/:userId": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "PATCH /api/admin/accounts/:userId/role": ApiContract<{ role: Exclude<AuthorizationRole, "guest"> }, { userId: string; role: string } | ErrorResponse>;
  "GET /api/admin/assets": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "GET /api/admin/beta-invitations": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "GET /api/admin/bulk-operations": ApiContract<EmptyRequest, BulkApiOverviewResponse | ErrorResponse>;
  "POST /api/admin/bulk-operations": ApiContract<BulkApiAction, JsonObject | ErrorResponse>;
  "POST /api/admin/beta-invitations/:id/approve": ApiContract<{ expiresAt: string }, MutationResult<"approved">>;
  "POST /api/admin/beta-invitations/:id/reject": ApiContract<EmptyRequest, MutationResult<"rejected">>;
  "GET /api/admin/commerce": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "GET /api/admin/campaign": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "PUT /api/admin/campaign": ApiContract<JsonObject, JsonObject | ErrorResponse>;
  "POST /api/admin/data/:entityKey/import": ApiContract<{ rows: JsonValue[] }, ImportResponse | ErrorResponse>;
  "GET /api/admin/perks": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "GET /api/admin/perks/:perkId": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "PATCH /api/admin/perks/:perkId": ApiContract<JsonObject, JsonObject | ErrorResponse>;
  "GET /api/admin/prompts": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "GET /api/admin/puzzles/blueprints": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "GET /api/admin/releases": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "POST /api/admin/releases": ApiContract<JsonObject, JsonObject | ErrorResponse>;
  "POST /api/admin/releases/:id/publish": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "GET /api/admin/settlements": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "POST /api/admin/settlements/complete-naming": ApiContract<JsonObject, JsonObject | ErrorResponse>;
  "POST /api/admin/settlements/found-city": ApiContract<JsonObject, JsonObject | ErrorResponse>;
  "POST /api/admin/settlements/migrate": ApiContract<JsonObject, MutationResult<"migrated">>;
  "GET /api/atlas/catalog": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "GET|POST /api/auth/*": ApiContract<Request, Response>;
  "POST /api/beta-invitations/redeem": ApiContract<{ code: string }, MutationResult<"redeemed">>;
  "POST /api/beta-invitations/request": ApiContract<{ friendName: string; email: string; reason: string; consent: true }, MutationResult<"received">>;
  "POST /api/contact": ApiContract<JsonObject, JsonObject | ErrorResponse>;
  "POST /api/donations/checkout": ApiContract<JsonObject, JsonObject | ErrorResponse>;
  "GET /api/health": ApiContract<EmptyRequest, JsonObject>;
  "GET /api/player/access": ApiContract<EmptyRequest, PlayerAccessResponse | ErrorResponse>;
  "GET /api/player/calendar": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "GET /api/player/puzzles": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "POST /api/player/puzzles": ApiContract<JsonObject, JsonObject | ErrorResponse>;
  "GET /api/player/runtime": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "GET /api/releases": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "GET /api/store/catalog": ApiContract<EmptyRequest, JsonObject | ErrorResponse>;
  "POST /api/store/checkout": ApiContract<JsonObject, JsonObject | ErrorResponse>;
  "POST /api/stripe/webhook": ApiContract<Request, JsonObject | ErrorResponse>;
  "GET /api/version": ApiContract<EmptyRequest, JsonObject>;
}

export interface WireframeViewModel {
  manifest: PageManifestEntry;
  shell: ShellKind;
  revision: "v11.3" | "v11.3-owner-amendment-2026-08-10";
  viewport: { width: number; height: number };
  state: "loading" | "empty" | "error" | "ready" | "success" | "denied";
}

export interface ProviderRequestContext {
  requestId: string;
  userId: string | null;
  occurredAt: string;
}
export interface ProviderResult<ProviderReference extends string = string> {
  providerReference: ProviderReference;
  acceptedAt: string;
}
export interface SpacesAssetPort { putVerifiedAsset(bytes: Uint8Array, mimeType: string, sha256: string): Promise<ProviderResult>; }
export interface ResendEmailPort { send(message: { from: string; to: string; subject: string; text: string }, context: ProviderRequestContext): Promise<ProviderResult>; }
export interface StripePaymentPort { createCheckout(input: JsonObject, context: ProviderRequestContext): Promise<ProviderResult>; verifyWebhook(rawBody: Uint8Array, signature: string): JsonObject; }
export interface PrintfulFulfillmentPort {
  submitPaidOrder(input: {
    externalOrderId: string;
    recipient: JsonObject;
    configuredLines: Array<{ externalVariantId: string; quantity: number; retailPrice: string }>;
  }, context: ProviderRequestContext): Promise<ProviderResult>;
}
export interface NpcRuntimePort { respond(input: { userId: string; text: string; context: JsonObject }, context: ProviderRequestContext): Promise<ProviderResult & { text: string }>; }

export type InvitationState = "REQUESTED" | "APPROVED" | "REJECTED" | "ISSUED" | "REDEEMED" | "EXPIRED";
export type PaymentState = "CREATED" | "CHECKOUT_PENDING" | "CONFIRMED" | "REFUNDED" | "FAILED";
export type FulfillmentState = "BLOCKED_UNTIL_PAYMENT" | "READY" | "SUBMITTED" | "FAILED";
export type ReleaseState = "DRAFT" | "REVIEWED" | "PUBLISHED" | "DEPLOYED" | "FAILED" | "ROLLED_BACK";
export type ImportState = "INPUT" | "MAPPED" | "VALIDATED" | "COMMITTED" | "REJECTED";
export type PuzzleChallengeState = "OFFERED" | "ACCEPTED" | "ACTIVE" | "SOLVED" | "EXPIRED";
