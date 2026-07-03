import { useEffect, useState } from "react";
import {
  useNotificationsConfig,
  useUpdateNotificationsConfig,
  useTestNotification,
} from "@/api/hooks";
import { cn } from "@/lib/utils";
import {
  Bell,
  Send,
  CheckCircle2,
  AlertCircle,
  Clock,
  Eye,
  EyeOff,
} from "lucide-react";

interface FormState {
  enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_password: string;
  smtp_use_tls: boolean;
  notification_from: string;
  notification_to_raw: string; // comma-separated for editing
}

function toFormState(server: {
  enabled: boolean;
  smtp_host: string;
  smtp_port: number;
  smtp_username: string;
  smtp_use_tls: boolean;
  notification_from: string;
  notification_to: string[];
}): FormState {
  return {
    enabled: server.enabled,
    smtp_host: server.smtp_host,
    smtp_port: server.smtp_port,
    smtp_username: server.smtp_username,
    smtp_password: "", // never populated from server
    smtp_use_tls: server.smtp_use_tls,
    notification_from: server.notification_from,
    notification_to_raw: server.notification_to.join(", "),
  };
}

function parseRecipients(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function SettingsPage() {
  const config = useNotificationsConfig();
  const update = useUpdateNotificationsConfig();
  const test = useTestNotification();

  const [form, setForm] = useState<FormState | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (config.data && form === null) {
      setForm(toFormState(config.data));
    }
  }, [config.data, form]);

  if (config.isLoading || form === null) {
    return (
      <div className="animate-fade-in text-sm text-muted-foreground font-mono">
        loading…
      </div>
    );
  }

  const update_field = <K extends keyof FormState>(
    key: K,
    value: FormState[K],
  ) => setForm((f) => (f ? { ...f, [key]: value } : f));

  const handleSave = () => {
    if (!form) return;
    update.mutate({
      enabled: form.enabled,
      smtp_host: form.smtp_host,
      smtp_port: form.smtp_port,
      smtp_username: form.smtp_username,
      smtp_password: form.smtp_password, // empty = server keeps existing
      smtp_use_tls: form.smtp_use_tls,
      notification_from: form.notification_from,
      notification_to: parseRecipients(form.notification_to_raw),
    });
  };

  const handleTest = () => {
    if (!form) return;
    // Test requires an actual password — we can't ship "keep existing"
    // through the test endpoint since it doesn't have the DB state
    if (!form.smtp_password && !config.data?.smtp_password_set) {
      return;
    }
    test.mutate({
      smtp_host: form.smtp_host,
      smtp_port: form.smtp_port,
      smtp_username: form.smtp_username,
      // Fallback for test: if user hasn't typed a new password, we need
      // to tell them to enter one. UI enforces this via disabled state.
      smtp_password: form.smtp_password,
      smtp_use_tls: form.smtp_use_tls,
      notification_from: form.notification_from,
      notification_to: parseRecipients(form.notification_to_raw),
    });
  };

  const canTest =
    form.smtp_host.length > 0 &&
    form.smtp_password.length > 0 &&
    form.notification_from.length > 0 &&
    parseRecipients(form.notification_to_raw).length > 0;

  const server = config.data!;

  return (
    <div className="animate-fade-in max-w-3xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Notifications and account.
        </p>
      </div>

      {/* Notifications section */}
      <div className="rounded-lg border border-border bg-card/40 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border/70 bg-muted/10 flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold">Notifications</h2>
        </div>

        <div className="p-5 space-y-5">
          {/* Status strip */}
          <StatusStrip
            lastSentAt={server.last_sent_at}
            lastErrorAt={server.last_error_at}
            lastErrorMessage={server.last_error_message}
          />

          {/* Enabled toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Enabled</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Send an email for every submission and visitor-side error.
              </div>
            </div>
            <Toggle
              checked={form.enabled}
              onChange={(v) => update_field("enabled", v)}
            />
          </div>

          <Divider />

          {/* SMTP config */}
          <div className="space-y-4">
            <SectionLabel>SMTP</SectionLabel>

            <Row>
              <Field label="Host" className="col-span-2">
                <Input
                  value={form.smtp_host}
                  onChange={(v) => update_field("smtp_host", v)}
                  placeholder="smtp.provider.com"
                />
              </Field>
              <Field label="Port">
                <Input
                  value={String(form.smtp_port)}
                  onChange={(v) => update_field("smtp_port", parseInt(v) || 0)}
                  type="number"
                />
              </Field>
            </Row>

            <Row>
              <Field label="Username" className="col-span-2">
                <Input
                  value={form.smtp_username}
                  onChange={(v) => update_field("smtp_username", v)}
                  placeholder="user@provider.com"
                />
              </Field>
              <Field label="TLS">
                <Toggle
                  checked={form.smtp_use_tls}
                  onChange={(v) => update_field("smtp_use_tls", v)}
                />
              </Field>
            </Row>

            <Field label="Password">
              <div className="relative">
                <Input
                  value={form.smtp_password}
                  onChange={(v) => update_field("smtp_password", v)}
                  type={showPassword ? "text" : "password"}
                  placeholder={
                    server.smtp_password_set
                      ? "•••••• (leave empty to keep current)"
                      : "not set"
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </Field>
          </div>

          <Divider />

          {/* Recipients */}
          <div className="space-y-4">
            <SectionLabel>Delivery</SectionLabel>

            <Field
              label="From"
              hint="Sender address — must match your SMTP provider's allowed senders."
            >
              <Input
                value={form.notification_from}
                onChange={(v) => update_field("notification_from", v)}
                placeholder="notifications@yourdomain.com"
              />
            </Field>

            <Field
              label="To"
              hint="Comma-separated. Multiple recipients supported."
            >
              <Input
                value={form.notification_to_raw}
                onChange={(v) => update_field("notification_to_raw", v)}
                placeholder="you@yourdomain.com, backup@yourdomain.com"
              />
            </Field>
          </div>

          <Divider />

          {/* Actions */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1">
              {test.data && (
                <div
                  className={cn(
                    "flex items-start gap-2 text-xs font-mono px-3 py-2 rounded-md border",
                    test.data.success
                      ? "border-success/40 bg-success/10 text-success"
                      : "border-destructive/40 bg-destructive/10 text-destructive",
                  )}
                >
                  {test.data.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  )}
                  <span className="break-all">{test.data.message}</span>
                </div>
              )}
              {update.isError && (
                <div className="text-xs text-destructive font-mono">
                  {update.error?.message ?? "save failed"}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleTest}
                disabled={!canTest || test.isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card/60 px-3 py-1.5 text-xs font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="h-3 w-3" />
                {test.isPending ? "sending…" : "send test"}
              </button>
              <button
                onClick={handleSave}
                disabled={update.isPending}
                className="rounded-md bg-primary text-primary-foreground px-4 py-1.5 text-xs font-mono uppercase tracking-wider hover:bg-primary/90 transition-colors disabled:opacity-40"
              >
                {update.isPending ? "saving…" : "save"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Local primitives ----

function StatusStrip({
  lastSentAt,
  lastErrorAt,
  lastErrorMessage,
}: {
  lastSentAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
}) {
  const hasError =
    lastErrorAt &&
    (!lastSentAt || new Date(lastErrorAt) > new Date(lastSentAt));

  return (
    <div
      className={cn(
        "flex items-start gap-2 text-xs font-mono px-3 py-2 rounded-md border",
        hasError
          ? "border-destructive/40 bg-destructive/10 text-destructive"
          : lastSentAt
            ? "border-success/40 bg-success/10 text-success"
            : "border-border bg-muted/20 text-muted-foreground",
      )}
    >
      {hasError ? (
        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      ) : lastSentAt ? (
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      ) : (
        <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
      )}
      <div className="flex-1">
        {hasError ? (
          <>
            <div>last error: {new Date(lastErrorAt!).toLocaleString()}</div>
            {lastErrorMessage && (
              <div className="opacity-70 mt-0.5 break-all">
                {lastErrorMessage}
              </div>
            )}
          </>
        ) : lastSentAt ? (
          <>last sent: {new Date(lastSentAt).toLocaleString()}</>
        ) : (
          <>no notifications sent yet</>
        )}
      </div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-muted",
      )}
      role="switch"
      aria-checked={checked}
    >
      <span
        className={cn(
          "inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 mb-1.5">
        {label}
      </label>
      {children}
      {hint && (
        <p className="text-[10px] text-muted-foreground/60 mt-1">{hint}</p>
      )}
    </div>
  );
}

function Input({
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-shadow"
    />
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-3 gap-3">{children}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/60">
      {children}
    </div>
  );
}

function Divider() {
  return <div className="border-t border-border/50" />;
}
