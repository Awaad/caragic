import type { Mode } from "./types";

export function getAccentColors(mode: Mode): {
  primary: string;
  secondary: string;
} {
  switch (mode) {
    case "dating":
      return { primary: "#ff3ad8", secondary: "#00e5ff" };
    case "friendship":
      return { primary: "#3aeae0", secondary: "#b14aff" };
    case "professional":
      return { primary: "#3a8aff", secondary: "#2ee6ff" };
    case "mix":
      return { primary: "#c060d8", secondary: "#3affd0" };
    default:
      return { primary: "#88aaff", secondary: "#46f0ff" };
  }
}