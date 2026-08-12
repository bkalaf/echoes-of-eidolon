export interface AudioBusSettings {
  master: number;
  soundtrack: number;
  narrative: number;
  muted: boolean;
}

function boundedGain(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 100) throw new Error("Audio volume must be between 0 and 100.");
  return value / 100;
}

export function effectiveAudioGains(settings: AudioBusSettings) {
  if (settings.muted) return { soundtrack: 0, narrative: 0 };
  const master = boundedGain(settings.master);
  return {
    soundtrack: master * boundedGain(settings.soundtrack),
    narrative: master * boundedGain(settings.narrative),
  };
}
