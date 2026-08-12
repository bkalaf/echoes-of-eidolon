export type RecoveryCondition = "GREEN" | "YELLOW" | "ORANGE" | "RED";

export interface RecoveryInputs {
  rest: number;
  morale: number;
  comfort: number;
}

export interface RecoveryThresholds {
  greenMinimum: number;
  yellowMinimum: number;
  orangeMinimum: number;
}

export function projectRecoveryCondition(inputs: RecoveryInputs, thresholds: RecoveryThresholds): RecoveryCondition {
  const values = [...Object.values(inputs), ...Object.values(thresholds)];
  if (values.some((value) => !Number.isFinite(value))) throw new Error("Recovery values must be finite.");
  if (!(thresholds.greenMinimum > thresholds.yellowMinimum && thresholds.yellowMinimum > thresholds.orangeMinimum)) {
    throw new Error("Recovery thresholds must descend from green to orange.");
  }
  const current = Math.min(inputs.rest, inputs.morale, inputs.comfort);
  if (current >= thresholds.greenMinimum) return "GREEN";
  if (current >= thresholds.yellowMinimum) return "YELLOW";
  if (current >= thresholds.orangeMinimum) return "ORANGE";
  return "RED";
}

export function applyRecovery(inputs: RecoveryInputs, delta: RecoveryInputs, maximum: number): RecoveryInputs {
  if (![...Object.values(inputs), ...Object.values(delta), maximum].every(Number.isFinite) || maximum < 0) throw new Error("Recovery configuration must be finite and nonnegative.");
  return {
    rest: Math.min(maximum, inputs.rest + delta.rest),
    morale: Math.min(maximum, inputs.morale + delta.morale),
    comfort: Math.min(maximum, inputs.comfort + delta.comfort),
  };
}
