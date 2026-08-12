export function isFirstAssignedBookCompletion(bookNumbers: readonly number[], completedBookNumber: number): boolean {
  if (!Number.isInteger(completedBookNumber) || completedBookNumber <= 0) throw new Error("Completed book number must be a positive integer.");
  const valid = bookNumbers.filter((book) => Number.isInteger(book) && book > 0);
  if (valid.length !== bookNumbers.length || valid.length === 0) return false;
  return completedBookNumber === Math.min(...valid);
}

export function awarenessAvailable(awarenessSkill: string | null, transformed: boolean): boolean {
  return awarenessSkill !== null && transformed;
}
