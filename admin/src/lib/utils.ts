import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** shadcn's standard cn helper — Tailwind-aware class merge. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}