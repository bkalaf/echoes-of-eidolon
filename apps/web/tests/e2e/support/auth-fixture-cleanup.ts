export interface AuthFixtureCleanupSteps {
  hasFixtures: boolean;
  closeBrowserContext: () => Promise<void>;
  deleteDatabaseRecords: () => Promise<void>;
  clearTrackedFixtures: () => void;
}

export async function runAuthFixtureCleanup(steps: AuthFixtureCleanupSteps): Promise<void> {
  if (!steps.hasFixtures) return;
  await steps.closeBrowserContext();
  await steps.deleteDatabaseRecords();
  steps.clearTrackedFixtures();
}
