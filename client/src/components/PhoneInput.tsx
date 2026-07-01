import PhoneInputBase from "react-phone-number-input";
import type { Value } from "react-phone-number-input";
import "react-phone-number-input/style.css";

interface CaragicPhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  accent: string;
  disabled?: boolean;
}

/**
 * Cyberpunk-styled wrapper around react-phone-number-input.
 *
 * Defaults to Turkey (matches North Cyprus demographic). Visitor can
 * switch country via the flag dropdown — libphonenumber-js validates
 * on the client, backend re-validates and canonicalizes to E.164.
 *
 * Emits E.164 strings (e.g. "+905331234567") when valid, or the raw
 * partial when the number isn't yet complete.
 */
export function CaragicPhoneInput({
  value,
  onChange,
  accent,
  disabled = false,
}: CaragicPhoneInputProps) {
  return (
    <div className="caragic-phone-input" style={{ width: "100%" }}>
      <PhoneInputBase
        international
        defaultCountry="TR"
        countryCallingCodeEditable={false}
        value={value as Value}
        onChange={(v) => onChange((v as string) ?? "")}
        disabled={disabled}
        placeholder="your number"
      />
      <style>{`
        .caragic-phone-input .PhoneInput {
          display: flex;
          gap: 8px;
          align-items: stretch;
          padding: 12px 14px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid ${accent}88;
          border-radius: 4px;
          box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.5);
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .caragic-phone-input .PhoneInput:focus-within {
          border-color: ${accent};
          box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.5), 0 0 12px ${accent}66;
        }
        .caragic-phone-input .PhoneInputCountry {
          display: flex;
          align-items: center;
          padding-right: 8px;
          border-right: 1px solid ${accent}44;
        }
        .caragic-phone-input .PhoneInputCountrySelect {
          background: transparent;
          color: white;
          border: none;
          font-family: monospace;
          font-size: 14px;
          cursor: pointer;
          padding-right: 4px;
        }
        .caragic-phone-input .PhoneInputCountrySelect option {
          background: #0a0a1f;
          color: white;
        }
        .caragic-phone-input .PhoneInputCountryIcon {
          box-shadow: 0 0 4px ${accent}66;
        }
        .caragic-phone-input .PhoneInputInput {
          flex: 1;
          background: transparent;
          border: none;
          color: white;
          font-size: 15px;
          font-family: monospace;
          letter-spacing: 0.5px;
          outline: none;
          min-width: 0;
        }
        .caragic-phone-input .PhoneInputInput::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }
        .caragic-phone-input .PhoneInputInput:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
