import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, MapPin, XCircle } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Avatar, PrimaryButton } from "./ui";
import { Shell } from "./Shell";
import { confirmMatchResult, getMatchResult, rejectMatchResult, useCurrentUser } from "./data";
import type { MatchResultDetail } from "./data";

const formatDate = (value?: string | null) => {
  if (!value) return "Match date";
  return new Date(`${value}`.slice(0, 10) + "T00:00:00").toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getErrorMessage = (error: unknown) => {
  const apiError = error as { data?: { error?: string; errors?: string[] }; message?: string };
  if (apiError.data?.errors?.length) return apiError.data.errors.join(", ");
  return apiError.data?.error || apiError.message || "Could not update result.";
};

export default function ConfirmResultPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const me = useCurrentUser(user);
  const [matchResult, setMatchResult] = useState<MatchResultDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<"confirm" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    getMatchResult(id)
      .then((data) => {
        if (!alive) return;
        setMatchResult(data.match_result);
      })
      .catch((err) => {
        if (!alive) return;
        setError(getErrorMessage(err));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [id]);

  const status = matchResult?.status || "pending";
  const isPending = status === "pending";
  const statusClass = useMemo(() => {
    if (status === "confirmed") return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (status === "disputed") return "bg-rose-100 text-rose-700 border-rose-200";
    return "bg-amber-100 text-amber-700 border-amber-200";
  }, [status]);

  const respond = async (action: "confirm" | "reject") => {
    setWorking(action);
    setError(null);
    try {
      const response = action === "confirm"
        ? await confirmMatchResult(id)
        : await rejectMatchResult(id);
      setMatchResult(response.match_result);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setWorking(null);
    }
  };

  return (
    <Shell title="Confirm score" me={me} onBack={() => navigate("/log-result")}>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-md shadow-slate-200/60">
        {loading ? (
          <p className="text-sm font-semibold text-slate-500">Loading result...</p>
        ) : matchResult ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Opponent review</p>
                <h2 className="mt-1 text-xl font-extrabold text-slate-900">Is this score correct?</h2>
              </div>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${statusClass}`}>
                {status}
              </span>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
                <div className="min-w-0 text-center">
                  <Avatar name={matchResult.player_a_name || "Reporter"} />
                  <p className="mt-2 truncate text-sm font-bold text-slate-900">{matchResult.player_a_name || "Reporter"}</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-black tabular-nums text-slate-900">{matchResult.score || "Score"}</p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">reported</p>
                </div>
                <div className="min-w-0 text-center">
                  <Avatar name={matchResult.player_b_name || "Opponent"} color="bg-indigo-100 text-indigo-700" />
                  <p className="mt-2 truncate text-sm font-bold text-slate-900">{matchResult.player_b_name || "Opponent"}</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3 text-xs font-semibold text-slate-500">
                <span>{formatDate(matchResult.played_at)}</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-violet-500" />
                  {matchResult.court_name || "Court"}{matchResult.court_area ? `, ${matchResult.court_area}` : ""}
                </span>
              </div>
            </div>

            {error ? (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {error}
              </p>
            ) : null}

            {status === "confirmed" ? (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                Score confirmed. Rating update has been triggered.
              </p>
            ) : null}

            {status === "disputed" ? (
              <p className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                Score disputed. Admin can resolve it from CMS.
              </p>
            ) : null}

            {isPending ? (
              <>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <PrimaryButton disabled={!!working} onClick={() => respond("confirm")}>
                    {working === "confirm" ? "Confirming..." : "Confirm score"}
                  </PrimaryButton>
                  <button
                    disabled={!!working}
                    onClick={() => respond("reject")}
                    className="rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-bold text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-60"
                  >
                    {working === "reject" ? "Working..." : "That's not right"}
                  </button>
                </div>
                <p className="mt-3 text-center text-xs font-semibold text-slate-400">
                  Auto-confirms in 48 hours if you don&apos;t respond — you can dispute in that window.
                </p>
              </>
            ) : null}
          </>
        ) : (
          <p className="text-sm font-semibold text-slate-500">Result not found.</p>
        )}

        {!loading && !matchResult && error ? (
          <p className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</p>
        ) : null}
      </div>
    </Shell>
  );
}
