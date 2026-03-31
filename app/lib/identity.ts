// Simple user identity for HomeBase todos
// Two hardcoded users: "brendan" and "sarah"

const STORAGE_KEY = "homebase_user";

export type Identity = "brendan" | "sarah";

export const USERS: { id: Identity; label: string }[] = [
  { id: "brendan", label: "Brendan" },
  { id: "sarah", label: "Sarah" },
];

export function getIdentity(): Identity | null {
  if (typeof window === "undefined") return null;
  const val = localStorage.getItem(STORAGE_KEY);
  if (val === "brendan" || val === "sarah") return val;
  return null;
}

export function setIdentity(name: Identity): void {
  localStorage.setItem(STORAGE_KEY, name);
}

export function clearIdentity(): void {
  localStorage.removeItem(STORAGE_KEY);
}

/** Returns the localStorage key for persisting the active list per user */
export function getActiveListKey(user: Identity): string {
  return `homebase_active_list_${user}`;
}
