import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Copy,
  Check,
  X,
  AlertTriangle,
  Sparkles,
  QrCode,
} from "lucide-react";
import { useMintLinkToken, useModesList } from "@/api/hooks";
import type { CreateTokenResponse } from "@/api/types";
import { cn } from "@/lib/utils";

/**
 * The mint dialog has three states:
 *   1. form   — enter mode + optional label, click mint
 *   2. reveal — token minted, show URL + QR + copy. ONE VIEW ONLY.
 *   3. done   — user closed reveal; nothing to show
 *
 * The reveal step is deliberately friction-heavy — this is the only time the
 * raw URL will ever be visible. If we close without copying, the URL is
 * gone forever (backend only stores the hash).
 */
export function MintTokenDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const modes = useModesList(["active"]);
  const mint = useMintLinkToken();

  const [mode, setMode] = useState<string>("");
  const [label, setLabel] = useState("");
  const [minted, setMinted] = useState<CreateTokenResponse | null>(null);
  const [copied, setCopied] = useState<"url" | "token" | null>(null);
  const [showQr, setShowQr] = useState(false);

  const handleMint = () => {
    if (!mode) return;
    mint.mutate(
      { mode, label: label.trim() || null },
      {
        onSuccess: (data) => setMinted(data),
      },
    );
  };

  const handleClose = () => {
    setMinted(null);
    setMode("");
    setLabel("");
    setCopied(null);
    setShowQr(false);
    onClose();
  };

  const copy = (text: string, key: "url" | "token") => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={handleClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-border bg-card shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-border/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold">
              {minted ? "Token minted" : "Mint link token"}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {!minted ? (
          <div className="p-5 space-y-4">
            <p className="text-xs text-muted-foreground">
              Creates a shareable link tied to a mode. Each visit through the
              link mints a fresh visitor session on that mode. Multi-use.
            </p>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                Mode
              </label>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">choose a mode…</option>
                {modes.data?.modes.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                Label{" "}
                <span className="text-muted-foreground/40">
                  · optional, for your reference
                </span>
              </label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. instagram bio, linkedin"
                className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            {mint.isError && (
              <div className="text-xs text-destructive font-mono">
                {mint.error?.message ?? "mint failed"}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={handleClose}
                className="rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                cancel
              </button>
              <button
                onClick={handleMint}
                disabled={!mode || mint.isPending}
                className="rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-xs font-mono uppercase tracking-wider hover:bg-primary/90 disabled:opacity-40 transition-colors"
              >
                {mint.isPending ? "minting…" : "mint"}
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* One-shot warning */}
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <div>
                This URL will never be shown again. Copy it now — the backend
                stores only its hash.
              </div>
            </div>

            {/* URL */}
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 mb-1.5">
                Shareable URL
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 min-w-0 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs font-mono text-foreground break-all">
                  {minted.url}
                </code>
                <button
                  onClick={() => copy(minted.url, "url")}
                  className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border bg-card/60 px-3 py-2 text-xs font-mono text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                >
                  {copied === "url" ? (
                    <>
                      <Check className="h-3 w-3 text-success" />
                      copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      copy
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* QR toggle */}
            <button
              onClick={() => setShowQr((s) => !s)}
              className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              <QrCode className="h-3 w-3" />
              {showQr ? "hide QR" : "show QR code"}
            </button>

            {showQr && (
              <div className="flex justify-center p-4 rounded-md bg-white">
                <QRCodeSVG
                  value={minted.url}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>
            )}

            {/* Metadata */}
            <div className="space-y-1 pt-2 border-t border-border/50">
              <MetaRow label="mode" value={minted.mode} />
              {minted.label && (
                <MetaRow label="label" value={minted.label} />
              )}
              <MetaRow label="id" value={minted.id} mono />
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={handleClose}
                className="rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-xs font-mono uppercase tracking-wider hover:bg-primary/90 transition-colors"
              >
                done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60 w-14">
        {label}
      </span>
      <span
        className={cn(
          "text-muted-foreground truncate",
          mono && "font-mono text-[11px]",
        )}
        title={value}
      >
        {value}
      </span>
    </div>
  );
}