import { useCallback, useEffect, useState } from "react";
import { logout, whoami } from "@/auth/api";
import { isAuthError } from "@/github/dispatch";
import { errMessage } from "@/app/helpers";
import type { ForgeUser } from "@/auth/types";

export function useAuth(setError: (message: string | null) => void) {
  const [user, setUser] = useState<ForgeUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    void whoami()
      .then(setUser)
      .catch((err) => {
        if (isAuthError(err)) {
          setUser(null);
          return;
        }
        setError(errMessage(err));
      });
  }, [setError]);

  const signOut = useCallback(() => {
    void logout()
      .then(() => setUser(null))
      .catch((err) => setError(errMessage(err)));
  }, [setError]);

  return { user, setUser, authOpen, setAuthOpen, signOut };
}
