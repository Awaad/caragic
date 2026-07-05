import type {
  ModeDetail,
  RoundDetail,
  RevealDetail,
} from "@/api/types";



// editor value types

export interface EditorOption {
  id: string;
  label: string;
  revealText: string;
}

export interface EditorChoiceData {
  question: string;
  options: EditorOption[];
}

export interface EditorCaptureData {
  prompt: string;
  acceptLabel: string;
  declineLabel: string;
  declineMessage: string;
}

export type EditorRoundData = EditorChoiceData | EditorCaptureData;

export interface EditorRound {
  // Stable identity within the editor session only. Comes from server
  // (round id) for existing rounds, generated locally for new rounds.
  // Never sent to the server — server uses (mode_id, position) as
  // identity and (mode_id, slug) for uniqueness.
  key: string;
  slug: string;
  roundType: "choice" | "capture";
  data: EditorRoundData;
}

export interface EditorRevealLink {
  key: string;
  label: string;
  url: string;
}

export interface EditorReveal {
  name: string;
  tagline: string;
  links: EditorRevealLink[];
}

export interface EditorMode {
  name: string;
  rounds: EditorRound[];
  reveal: EditorReveal;
}

// key generation

const newKey = () => crypto.randomUUID().slice(0, 8);

// server → editor 

export function toEditorValue(detail: ModeDetail): EditorMode {
  return {
    name: detail.name,
    rounds: detail.rounds.map(roundToEditor),
    reveal: revealToEditor(detail.reveal),
  };
}

function roundToEditor(r: RoundDetail): EditorRound {
  if (r.round_type === "choice") {
    const d = r.data as {
      question?: string;
      options?: Array<{ id: string; label: string; revealText: string }>;
    };
    return {
      key: r.id,
      slug: r.slug,
      roundType: "choice",
      data: {
        question: d.question ?? "",
        options: (d.options ?? []).map((o) => ({
          id: o.id,
          label: o.label,
          revealText: o.revealText,
        })),
      },
    };
  }
  const d = r.data as {
    prompt?: string;
    acceptLabel?: string;
    declineLabel?: string;
    declineMessage?: string;
  };
  return {
    key: r.id,
    slug: r.slug,
    roundType: "capture",
    data: {
      prompt: d.prompt ?? "",
      acceptLabel: d.acceptLabel ?? "",
      declineLabel: d.declineLabel ?? "",
      declineMessage: d.declineMessage ?? "",
    },
  };
}

function revealToEditor(r: RevealDetail): EditorReveal {
  return {
    name: r.name,
    tagline: r.tagline ?? "",
    // Backend stores links as list[Any]; existing modes may have any
    // shape. We coerce anything that isn't {label, url} to empty strings
    // so the editor doesn't crash — user can fix them, or the
    links: (r.links ?? []).map((l: unknown) => {
      const obj = (l ?? {}) as { label?: unknown; url?: unknown };
      return {
        key: newKey(),
        label: typeof obj.label === "string" ? obj.label : "",
        url: typeof obj.url === "string" ? obj.url : "",
      };
    }),
  };
}

// editor → PUT payload

export interface PutModePayload {
  rounds: Array<{
    slug: string;
    round_type: "choice" | "capture";
    data: unknown;
  }>;
  reveal: {
    name: string;
    tagline: string;
    links: Array<{ label: string; url: string }>;
  };
}

export function toPutPayload(m: EditorMode): PutModePayload {
  return {
    rounds: m.rounds.map((r) => ({
      slug: r.slug,
      round_type: r.roundType,
      data:
        r.roundType === "choice"
          ? {
              question: (r.data as EditorChoiceData).question,
              options: (r.data as EditorChoiceData).options.map((o) => ({
                id: o.id,
                label: o.label,
                revealText: o.revealText,
              })),
            }
          : {
              prompt: (r.data as EditorCaptureData).prompt,
              acceptLabel: (r.data as EditorCaptureData).acceptLabel,
              declineLabel: (r.data as EditorCaptureData).declineLabel,
              declineMessage: (r.data as EditorCaptureData).declineMessage,
            },
    })),
    reveal: {
      name: m.reveal.name,
      tagline: m.reveal.tagline,
      links: m.reveal.links.map((l) => ({ label: l.label, url: l.url })),
    },
  };
}

//  factories

export function newOption(): EditorOption {
  return { id: newKey(), label: "", revealText: "" };
}

export function newChoiceRound(): EditorRound {
  return {
    key: newKey(),
    slug: "",
    roundType: "choice",
    data: {
      question: "",
      options: [newOption(), newOption()],
    },
  };
}

export function newCaptureRound(): EditorRound {
  return {
    key: newKey(),
    slug: "capture",
    roundType: "capture",
    data: {
      prompt: "",
      acceptLabel: "Continue",
      declineLabel: "Not now",
      declineMessage: "Thanks for playing.",
    },
  };
}

export function newRevealLink(): EditorRevealLink {
  return { key: newKey(), label: "", url: "" };
}

export function emptyEditorMode(name: string): EditorMode {
  return {
    name,
    rounds: [newChoiceRound(), newCaptureRound()],
    reveal: { name: "", tagline: "", links: [] },
  };
}