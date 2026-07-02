import type { ReactNode } from "react";

interface AuthGuardProps {
  children: ReactNode;
}

/**
 * TEMPORARY: passthrough for Chunk A scaffolding. Chunk B replaces this with
 * a whoami check that redirects to /login on 401.
 */
export function AuthGuard({ children }: AuthGuardProps) {
  return <>{children}</>;
}
