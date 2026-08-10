import { getAuth } from "./auth";
import { getDatabase } from "./database";
import { getPaymentsEnv, getStorageEnv } from "./env";

export type ServiceHealthStatus = "operational" | "configured" | "unavailable" | "unmonitored";

export interface PublicServiceHealth {
  description: string;
  name: "Website" | "Authentication" | "Game Service" | "Store";
  status: ServiceHealthStatus;
}

export interface PublicHealthReport {
  checkedAt: string;
  services: PublicServiceHealth[];
}

export function buildPublicHealthReport(input: {
  authenticationAvailable: boolean;
  checkedAt?: string;
  commerceConfigured: boolean;
}): PublicHealthReport {
  return {
    checkedAt: input.checkedAt ?? new Date().toISOString(),
    services: [
      {
        name: "Website",
        description: "Public site and account access",
        status: "operational",
      },
      {
        name: "Authentication",
        description: "Sign in and account access",
        status: input.authenticationAvailable ? "operational" : "unavailable",
      },
      {
        name: "Game Service",
        description: "Player runtime and progression",
        status: "unmonitored",
      },
      {
        name: "Store",
        description: "Merchandise browsing and checkout",
        status: input.commerceConfigured ? "configured" : "unavailable",
      },
    ],
  };
}

async function databaseIsAvailable(): Promise<boolean> {
  try {
    await getDatabase().$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}

function authenticationIsConfigured(): boolean {
  try {
    getAuth();
    return true;
  } catch {
    return false;
  }
}

function commerceIsConfigured(): boolean {
  try {
    getPaymentsEnv();
    getStorageEnv();
    return true;
  } catch {
    return false;
  }
}

export async function getPublicHealthReport(): Promise<PublicHealthReport> {
  const databaseAvailable = await databaseIsAvailable();
  return buildPublicHealthReport({
    authenticationAvailable: databaseAvailable && authenticationIsConfigured(),
    commerceConfigured: commerceIsConfigured(),
  });
}
