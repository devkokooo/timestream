import type { GithubUser } from "./types";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function identityEmails(user: GithubUser): string[] {
  const out = new Set<string>();
  const add = (value?: string | null) => {
    const email = normalizeEmail(value ?? "");
    if (email) out.add(email);
  };
  add(user.email);
  for (const email of user.emails ?? []) add(email);
  add(`${user.login}@users.noreply.github.com`);
  return [...out];
}

export function isSelfEmail(user: GithubUser | null | undefined, email?: string | null): boolean {
  if (!user || !email) return false;
  const needle = normalizeEmail(email);
  return Boolean(needle) && identityEmails(user).includes(needle);
}

export function isSelfLogin(user: GithubUser | null | undefined, login?: string | null): boolean {
  if (!user || !login) return false;
  return user.login.toLowerCase() === login.trim().toLowerCase();
}

export function isSelfPerson(
  user: GithubUser | null | undefined,
  hint: { email?: string | null; login?: string | null },
): boolean {
  return isSelfEmail(user, hint.email) || isSelfLogin(user, hint.login);
}
