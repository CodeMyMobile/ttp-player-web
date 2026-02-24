import { useCallback, useState } from "react";

export type LessonInviteStep = "preview" | "quickSignup" | "payment" | "done";

export const useLessonInviteStepMachine = (initialStep: LessonInviteStep = "preview") => {
  const [step, setStep] = useState<LessonInviteStep>(initialStep);

  const goPreview = useCallback(() => setStep("preview"), []);
  const goQuickSignup = useCallback(() => setStep("quickSignup"), []);
  const goPayment = useCallback(() => setStep("payment"), []);
  const goDone = useCallback(() => setStep("done"), []);

  return {
    step,
    setStep,
    goPreview,
    goQuickSignup,
    goPayment,
    goDone,
  };
};

