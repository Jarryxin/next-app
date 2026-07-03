import "server-only";

interface PendingAuth {
  state: string;
  sessionToken?: string;
  createdAt: number;
}

const store = new Map<string, PendingAuth>();

const TTL = 10 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [key, val] of store) {
    if (now - val.createdAt > TTL) store.delete(key);
  }
}, 60_000);

export function createPendingAuth(state: string) {
  store.set(state, { state, createdAt: Date.now() });
}

export function completeAuth(state: string, sessionToken: string) {
  const entry = store.get(state);
  if (entry) {
    entry.sessionToken = sessionToken;
  }
}

export function getAuthStatus(state: string) {
  const entry = store.get(state);
  if (!entry) return { status: "expired" as const };
  if (entry.sessionToken) return { status: "success" as const, token: entry.sessionToken };
  return { status: "pending" as const };
}
