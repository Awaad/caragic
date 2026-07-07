import { useEffect, useState } from "react";
import { KeyRound, Phone } from "lucide-react";
import { useStartVerification, useCheckVerification } from "../api/mutations";
import { CaragicPhoneInput } from "../components/PhoneInput";
import { isValidPhoneNumber } from "libphonenumber-js";
import { useFlowPersistStore } from "../flow/persistStore";


type Step = "phone" | "code";

export function PhoneVerifyGate() {
  const [step, setStep] = useState<Step>("phone");
  const persistedPhone = useFlowPersistStore((s) => s.lastPhone);
  const [phone, setPhone] = useState(persistedPhone ?? "");
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [resendTick, setResendTick] = useState(0);
  const [code, setCode] = useState("");

  const start = useStartVerification();
  const check = useCheckVerification();

  useEffect(() => {
    if (persistedPhone && !phone) setPhone(persistedPhone);
  }, [persistedPhone]);

  const phoneValid = phone ? isValidPhoneNumber(phone) : false;

  // Start the 30s countdown whenever a new verification is issued.
  useEffect(() => {
    if (!verificationId) return;
    setResendIn(30);
    const interval = setInterval(() => {
      setResendIn((n) => (n <= 1 ? 0 : n - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [verificationId, resendTick]);

  const handleSendCode = () => {
    if (!phoneValid) return;
    start.mutate(
      { phone },
      {
        onSuccess: (data) => {
          setVerificationId(data.verification_id);
          setStep("code");
        },
      },
    );
  };

  const handleResend = () => {
    if (resendIn > 0 || !phoneValid) return;
    start.mutate(
      { phone },
      {
        onSuccess: (data) => {
          setVerificationId(data.verification_id);
          setCode("");
          setResendTick((n) => n + 1); 
        },
      },
    );
  };


  const handleCheck = () => {
    console.log("phone at check:", phone, typeof phone);
    if (!verificationId || code.length !== 6) return;
    check.mutate(
      { verification_id: verificationId, code, phone: phone ?? ""  },
      {
        onSuccess: () => {
          // ChatPage re-reads content, will flip to verified view
        },
      },
    );
  };

  const errorMessage = check.error?.message ?? start.error?.message ?? null;

  return (
    <div style={{ maxWidth: 400, width: "100%" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div
          style={{
            fontSize: 10,
            fontFamily: "monospace",
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "rgba(160, 200, 255, 0.5)",
            marginBottom: 12,
          }}
        >
          — Awad Says Hey  ✌️—
        </div>
        <h1
          style={{
            fontSize: 22,
            color: "rgba(240,240,255,0.95)",
            fontWeight: 300,
            letterSpacing: 0.5,
            marginBottom: 8,
          }}
        >
          {step === "phone" ? "verify your phone" : "enter the code"}
        </h1>
        <p
          style={{
            fontSize: 13,
            color: "rgba(200,200,220,0.5)",
            lineHeight: 1.5,
          }}
        >
          {step === "phone"
            ? "the number you left on the card"
            : `sent to ${phone}`}
        </p>
      </div>

      <div
        style={{
          background: "rgba(6, 4, 22, 0.85)",
          border: "1px solid rgba(120, 150, 255, 0.25)",
          borderRadius: 10,
          padding: 20,
          boxShadow: "0 0 24px rgba(80, 100, 200, 0.15)",
        }}
      >
        {step === "phone" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>
                <Phone size={11} style={{ marginRight: 6 }} />
                phone
              </label>
              <CaragicPhoneInput
                value={phone}
                onChange={setPhone}
                accent="#7faaff"
                disabled={start.isPending}
              />
            </div>
            <button
              onClick={handleSendCode}
              disabled={!phoneValid || start.isPending}
              style={{
                ...buttonStyle,
                opacity: !phoneValid || start.isPending ? 0.4 : 1,
                cursor:
                  !phoneValid || start.isPending ? "not-allowed" : "pointer",
              }}
            >
              {start.isPending ? "sending code…" : "send code"}
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}>
                <KeyRound size={11} style={{ marginRight: 6 }} />
                code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                  if (v.length === 6 && verificationId && !check.isPending) {
                    check.mutate({ verification_id: verificationId, code: v, phone });
                  }
                }}
                placeholder="000000"
                autoFocus
                style={{
                  width: "100%",
                  padding: "12px 14px",
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "1px solid rgba(127, 170, 255, 0.35)",
                  borderRadius: 4,
                  color: "white",
                  fontSize: 20,
                  fontFamily: "monospace",
                  outline: "none",
                  letterSpacing: 8,
                  textAlign: "center",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <button
              onClick={handleCheck}
              disabled={!phone || code.length !== 6 || check.isPending}
              style={{
                ...buttonStyle,
                opacity: code.length !== 6 || check.isPending ? 0.4 : 1,
                cursor:
                  code.length !== 6 || check.isPending
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {check.isPending ? "verifying…" : "verify"}
            </button>

            <button
              onClick={handleResend}
              disabled={resendIn > 0 || start.isPending || check.isPending}
              style={{
                background: "transparent",
                border: "none",
                color:
                  resendIn > 0 ? "rgba(200,200,220,0.3)" : "rgba(180, 210, 255, 0.75)",
                fontSize: 11,
                fontFamily: "monospace",
                cursor: resendIn > 0 ? "not-allowed" : "pointer",
                letterSpacing: 1,
                padding: 0,
                marginTop: 4,
              }}
            >
              {resendIn > 0
                ? `resend in ${resendIn}s`
                : start.isPending
                  ? "sending…"
                  : "resend code"}
            </button>

            <button
              onClick={() => {
                setStep("phone");
                setCode("");
                setVerificationId(null);
              }}
              disabled={check.isPending}
              style={{
                background: "transparent",
                border: "none",
                color: "rgba(200,200,220,0.5)",
                fontSize: 11,
                fontFamily: "monospace",
                cursor: "pointer",
                marginTop: 4,
                letterSpacing: 1,
              }}
            >
              ← use a different number
            </button>
          </div>
        )}

        {errorMessage && (
          <div
            style={{
              marginTop: 14,
              padding: "10px 12px",
              background: "rgba(200, 60, 80, 0.15)",
              border: "1px solid rgba(255, 100, 120, 0.4)",
              borderRadius: 4,
              color: "rgba(255, 180, 190, 0.95)",
              fontSize: 12,
              fontFamily: "monospace",
              lineHeight: 1.4,
            }}
          >
            {errorMessage}
          </div>
        )}
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  fontSize: 9,
  fontFamily: "monospace",
  letterSpacing: 2,
  textTransform: "uppercase",
  color: "rgba(200, 200, 220, 0.45)",
  marginBottom: 6,
};

const buttonStyle: React.CSSProperties = {
  padding: "12px 14px",
  background: "rgba(127, 170, 255, 0.12)",
  border: "1px solid rgba(127, 170, 255, 0.6)",
  borderRadius: 4,
  color: "rgba(180, 210, 255, 1)",
  fontSize: 12,
  fontFamily: "monospace",
  letterSpacing: 2,
  textTransform: "uppercase",
  fontWeight: 600,
  boxShadow: "0 0 12px rgba(127, 170, 255, 0.3)",
  transition: "opacity 0.2s",
};