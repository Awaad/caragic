/**
 * Display name for the card owner. Set via VITE_OWNER_NAME at build/dev time.
 * Fallback is the actual name so unset environments don't render a variable.
 */
export const OWNER_NAME: string =
  (import.meta.env.VITE_OWNER_NAME as string | undefined) ?? "Awad";