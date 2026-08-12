import type { WorldKey } from "../generated/prisma/enums";

const currencyPresentation = {
  CONCORD: { asset: "CURRENCY_MANE.svg", name: "Mane" },
  RUIN: { asset: "CURRENCY_FAN.svg", name: "Fan" },
  SCHISM: { asset: "CURRENCY_MANTLE.svg", name: "Mantle" },
} as const satisfies Record<WorldKey, { asset: string; name: string }>;

export function currencyForWorld(worldKey: WorldKey) {
  return currencyPresentation[worldKey];
}

export interface WithdrawalRecord {
  amount: number;
  occurredAtGameMinute: bigint;
}

export function projectWithdrawalWindow(input: {
  currentGameMinute: bigint;
  gameMinutesPerDay?: bigint;
  limit: number;
  withdrawals: readonly WithdrawalRecord[];
}) {
  if (!Number.isInteger(input.limit) || input.limit < 0) throw new Error("Withdrawal limit must be a nonnegative integer.");
  const gameMinutesPerDay = input.gameMinutesPerDay ?? 1_440n;
  if (gameMinutesPerDay <= 0n) throw new Error("Game-day duration must be positive.");
  const windowStart = input.currentGameMinute - (7n * gameMinutesPerDay);
  const active = input.withdrawals.filter((row) => {
    if (!Number.isInteger(row.amount) || row.amount <= 0) throw new Error("Withdrawal amounts must be positive integers.");
    return row.occurredAtGameMinute > windowStart && row.occurredAtGameMinute <= input.currentGameMinute;
  });
  const used = active.reduce((sum, row) => sum + row.amount, 0);
  const remaining = Math.max(0, input.limit - used);
  const earliest = active.reduce<WithdrawalRecord | undefined>((current, row) => !current || row.occurredAtGameMinute < current.occurredAtGameMinute ? row : current, undefined);
  return {
    used,
    remaining,
    nextLimitIncreaseAtGameMinute: remaining < input.limit && earliest ? earliest.occurredAtGameMinute + (7n * gameMinutesPerDay) : null,
  };
}
