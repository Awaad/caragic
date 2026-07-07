import { useState } from "react";
import { useFlow } from "../../flow/useFlow";
import { useContent } from "../../api/hooks";
import { useSubmitCapture } from "../../api/mutations";
import { PanelFrame } from "./PanelFrame";
import { TypewriterText } from "./TypewriterText";
import { CaptureFormOverlay } from "./CaptureFormOverlay";
import { isValidPhoneNumber } from "libphonenumber-js";
import { useResponsiveScale } from "../hooks/useResponsiveScale";

import { useFlowPersistStore } from "../../flow/persistStore";
import { useModalStore } from "../../components/modal/modalStore";
import { getAccentColors } from "../../modes/accents";
import { ProfilePreviewOverlay } from "../../components/overlay/ProfilePreviewOverlay";



const HEADER_WIDTH = 2.4;
const HEADER_HEIGHT = 0.55;
const BUTTON_WIDTH = 2.0;
const BUTTON_HEIGHT = 0.42;
const HEADER_Y = 0.85;
const RECONSIDER_HEADER_TEXT = "changed your mind?";


export function CaptureFormPanel() {
  const { phase, mode, roundIndex, answers, setPhase, lastOutcome } = useFlow();
  const responsiveScale = useResponsiveScale();
  const { data: content } = useContent();

  const setSubmitConfirmPending = useModalStore((s) => s.setSubmitConfirmPending);
  const openSubmitConfirm = useModalStore((s) => s.openSubmitConfirm);
  const closeSubmitConfirm = useModalStore((s) => s.closeSubmitConfirm);

  const submit = useSubmitCapture();

  const [step, setStep] = useState<
    "choice" | "reconsider" | "form" | "declined"
  >(lastOutcome === "declined" ? "reconsider" : "choice");

  const [name, setName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [showProfile, setShowProfile] = useState(false);

  if (phase !== "capturing") return null;
  if (!content) return null;

  const round = content.rounds[roundIndex];
  if (!round || round.type !== "capture") return null;

  const { prompt, acceptLabel, declineLabel, declineMessage } = round.data;
  const { primary: accent, secondary } = getAccentColors(mode);

  const phoneValid = phoneNumber ? isValidPhoneNumber(phoneNumber) : false;
  const canSubmit =
    name.trim().length > 0 && phoneValid && !submit.isPending;

  const doSubmit = async () => {
    try {
      await submit.mutateAsync({
        outcome: "submitted",
        name: name.trim(),
        phone: phoneNumber,
        answers: answers.map((a) => ({
          round_id: a.roundId,
          option_id: a.optionId,
        })),
      });
      closeSubmitConfirm();
      setPhase("reveal");
    } catch {
      setSubmitConfirmPending(false);
      // Modal closes; overlay's inline error surface (submit.isError)
      // shows the message. User can re-submit → re-confirm.
      //closeSubmitConfirm();
    }
  };

  const openConfirm = () => {
    if (!canSubmit) return;
    openSubmitConfirm({
      name: name.trim(),
      phone: phoneNumber,
      mode,
      accentColor: accent,
      onConfirm: doSubmit,
    });
  };

  const handleDecline = () => {
    submit.mutate({
      outcome: "declined",
      answers: answers.map((a) => ({
        round_id: a.roundId,
        option_id: a.optionId,
      })),
    });
    setStep("declined");
  };

  

  return (
    <group scale={responsiveScale}>
      {/* 3D header — hidden when the form overlay is up, since the
          overlay carries its own prompt line and covers the scene. */}
      <PanelFrame
        width={HEADER_WIDTH}
        height={HEADER_HEIGHT}
        text={
          step === "declined"
            ? declineMessage
            : step === "reconsider"
              ? RECONSIDER_HEADER_TEXT
              : prompt
        }
        textSize={0.085}
        position={[0, HEADER_Y, 1.2]}
        rotation={[-0.08, 0.18, 0]}
        visible={step !== "form"}
        accentColor={accent}
        accentColorSecondary={secondary}
        variant="header"
      />

      {step === "reconsider" && (
        <>
          <PanelFrame
            width={BUTTON_WIDTH}
            height={BUTTON_HEIGHT}
            text="leave your number"
            textSize={0.07}
            position={[0, 0.2, 1.2]}
            rotation={[-0.08, 0.22, 0]}
            visible
            accentColor={accent}
            accentColorSecondary={secondary}
            variant="choice"
            selected
            onClick={() => setStep("form")}
          />
          <PanelFrame
            width={BUTTON_WIDTH}
            height={BUTTON_HEIGHT}
            text="who are you?!"
            textSize={0.07}
            position={[0, -0.35, 1.2]}
            rotation={[-0.08, 0.22, 0]}
            visible
            accentColor={accent}
            accentColorSecondary={secondary}
            variant="choice"
            onClick={() => setShowProfile(true)}
          />
        </>
      )}

      {showProfile && (
          <ProfilePreviewOverlay
            accent={accent}
            name={content.reveal.name}
            tagline={content.reveal.tagline}
            onClose={() => setShowProfile(false)}
          />
        )}

      {step === "choice" && (
        <>
          <PanelFrame
            width={BUTTON_WIDTH}
            height={BUTTON_HEIGHT}
            text={declineLabel}
            textSize={0.07}
            position={[0, 0.15, 1.2]}
            rotation={[-0.08, 0.22, 0]}
            visible
            accentColor={accent}
            accentColorSecondary={secondary}
            variant="choice"
            onClick={handleDecline}
          />
          <PanelFrame
            width={BUTTON_WIDTH}
            height={BUTTON_HEIGHT}
            text={acceptLabel}
            textSize={0.07}
            position={[0, -0.4, 1.2]}
            rotation={[-0.08, 0.22, 0]}
            visible
            accentColor={accent}
            accentColorSecondary={secondary}
            variant="choice"
            selected
            onClick={() => setStep("form")}
          />
        </>
      )}

      {step === "form" && (
        <CaptureFormOverlay
          accent={accent}
          prompt={prompt}
          name={name}
          onNameChange={setName}
          phoneNumber={phoneNumber}
          onPhoneChange={setPhoneNumber}
          canSubmit={canSubmit}
          isPending={submit.isPending}
          isError={submit.isError}
          errorMessage={submit.error?.message}
          onSubmit={openConfirm}
        />
      )}

      {step === "declined" && (
        <group position={[0, -0.1, 1.3]} rotation={[-0.08, 0.18, 0]}>
          <TypewriterText
            text="thanks for tapping. ✌️"
            fontSize={0.085}
            color={accent}
            maxWidth={2}
            charDelay={45}
            startDelay={300}
          />
        </group>
      )}
    </group>
  );
}