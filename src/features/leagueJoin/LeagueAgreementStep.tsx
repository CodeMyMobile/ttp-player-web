import { useMemo, useState } from "react";
import { FileText } from "lucide-react";

import type { League, LeagueRuleVersion } from "../../api/leagues";
import { getAgreementNudges } from "./paymentState";

export interface LeagueAgreementStepProps {
  league: League;
  rule: LeagueRuleVersion | null;
  defaultName?: string;
  onBack: () => void;
  onContinue: (agreement: { signedName: string; agreedAt: Date; rulesVersion: string }) => void;
}

const LeagueAgreementStep = ({
  league,
  rule,
  defaultName = "",
  onBack,
  onContinue,
}: LeagueAgreementStepProps) => {
  const [signedName, setSignedName] = useState(defaultName);
  const [agreed, setAgreed] = useState(false);
  const [nudged, setNudged] = useState(false);
  const rulesVersion = rule?.version ?? league.current_rules_version ?? "v1";
  const nudges = useMemo(
    () => getAgreementNudges({ signedName, agreed }),
    [agreed, signedName],
  );
  const canContinue = !nudges.signedName && !nudges.agreed;

  const submit = () => {
    if (!canContinue) {
      setNudged(true);
      return;
    }

    onContinue({
      signedName: signedName.trim(),
      agreedAt: new Date(),
      rulesVersion,
    });
  };

  return (
    <section className="league-join-step" aria-labelledby="league-agreement-title">
      <div className="league-join-step__header">
        <FileText size={20} />
        <div>
          <h2 id="league-agreement-title">Sign the league agreement</h2>
          <p>{league.name} · Rules {rulesVersion}</p>
        </div>
      </div>

      <div className="league-join-step__summary">
        <p>By joining, you confirm that you are at least 18, understand the league rules, and accept responsibility for safe match play.</p>
        {rule?.content ? (
          <details>
            <summary>View full rules</summary>
            <p>{rule.content}</p>
          </details>
        ) : null}
      </div>

      <label className="league-join-sheet__select-field" htmlFor="league-agreement-name">
        <span>Signed name</span>
        <input
          id="league-agreement-name"
          value={signedName}
          onChange={(event) => setSignedName(event.target.value)}
          className={nudged && nudges.signedName ? "is-invalid" : undefined}
        />
      </label>

      <label className={`league-join-check ${nudged && nudges.agreed ? "is-invalid" : ""}`}>
        <input
          type="checkbox"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        <span>I agree to the liability waiver and league rules.</span>
      </label>

      <div className="league-join-sheet__actions">
        <button type="button" className="league-join-sheet__secondary" onClick={onBack}>
          Back
        </button>
        <button type="button" className="league-join-sheet__primary" onClick={submit}>
          Continue to payment
        </button>
      </div>
    </section>
  );
};

export default LeagueAgreementStep;
