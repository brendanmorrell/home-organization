// Simple user identity for HomeBase todos
// Two hardcoded users: "brendan" and "erin"

const STORAGE_KEY = "homebase_user";

export type Identity = "brendan" | "erin";

export const USERS: { id: Identity; label: string }[] = [
  { id: "brendan", label: "Brendan" },
  { id: "erin", label: "Erin" },
];

export function getIdentity(): Identity | null {
  if (typeof window === "undefined") return null;
  const val = localStorage.getItem(STORAGE_KEY);
  if (val === "brendan" || val === "erin") return val;
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
