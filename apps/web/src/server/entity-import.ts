import type { ImportRecord } from "../domain/entity-import";

export interface ImportTransactionBoundary<Transaction> {
  transaction<Result>(work: (transaction: Transaction) => Promise<Result>): Promise<Result>;
}

export async function applyValidatedEntityImport<Transaction>(input: {
  authorized: boolean;
  database: ImportTransactionBoundary<Transaction>;
  errors: string[];
  insert: (transaction: Transaction, rows: ImportRecord[]) => Promise<number>;
  rows: ImportRecord[];
}): Promise<number> {
  if (!input.authorized) throw new Error("Administrative authorization is required.");
  if (input.errors.length > 0) throw new Error("Import validation must pass before apply.");
  if (input.rows.length === 0) throw new Error("Import requires at least one row.");
  return input.database.transaction((transaction) => input.insert(transaction, input.rows));
}
