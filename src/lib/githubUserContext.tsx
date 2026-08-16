import { createContext, useContext, type ReactNode } from "react";
import type { GithubUser } from "./types";

const GithubUserContext = createContext<GithubUser | null>(null);

export function GithubUserProvider({
  user,
  children,
}: {
  user: GithubUser | null;
  children: ReactNode;
}) {
  return <GithubUserContext.Provider value={user}>{children}</GithubUserContext.Provider>;
}

export function useGithubUser(): GithubUser | null {
  return useContext(GithubUserContext);
}
