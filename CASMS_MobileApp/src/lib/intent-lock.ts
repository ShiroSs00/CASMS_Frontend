const active = new Set<string>();

export async function withIntentLock<T>(key: string, run: () => Promise<T>, message: string) {
  if (active.has(key)) throw new Error(message);
  active.add(key);
  try { return await run(); }
  finally { active.delete(key); }
}
