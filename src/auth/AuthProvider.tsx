import { createContext, useContext, type ReactNode } from "react";
import type { ForgeUser } from "./types";

const AuthContext = createContext<ForgeUser | null>(null);

export function AuthProvider({
  user,
  children,
}: {
  user: ForgeUser | null;
  children: ReactNode;
}) {
  return <AuthContext.Provider value={user}>{children}</AuthContext.Provider>;
}

export function useAuthUser(): ForgeUser | null {
  return useContext(AuthContext);
}
