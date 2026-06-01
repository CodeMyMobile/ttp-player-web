import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { AlertCircle } from "lucide-react";

import { useQuery, useQueryClient } from "../utils/react-query-shim";
import MatchDetailsModal from "../components/MatchDetailsModal.jsx";
import { getMatch } from "../services/matches";
import { ARCHIVE_FILTER_VALUE, isMatchArchivedError } from "../utils/archive";
import { useAuth } from "../../context/AuthContext";

const readStoredObject = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const buildMatchesUser = (authUser) => {
  const personalDetails = readStoredObject("playerPersonalDetails");
  const loginResponse = readStoredObject("authLoginResponse");
  const storedUser = readStoredObject("user");
  const profile =
    storedUser?.profile ||
    authUser ||
    personalDetails ||
    loginResponse?.profile ||
    loginResponse?.user ||
    storedUser ||
    {};

  return {
    ...storedUser,
    ...profile,
    id: profile?.id ?? storedUser?.id ?? loginResponse?.user_id ?? loginResponse?.id ?? null,
    type: profile?.user_type ?? storedUser?.type ?? loginResponse?.user_type ?? 2,
    name:
      profile?.name ||
      profile?.full_name ||
      profile?.fullName ||
      storedUser?.name ||
      loginResponse?.full_name ||
      profile?.email ||
      "Player",
    email: profile?.email || storedUser?.email || loginResponse?.email || "",
    phone: profile?.phone || profile?.mobile || storedUser?.phone || loginResponse?.phone || "",
    skillLevel:
      profile?.skillLevel ||
      profile?.skill_level ||
      profile?.usta_rating ||
      storedUser?.skillLevel ||
      loginResponse?.skillLevel ||
      "",
    profile,
  };
};

const formatDateTime = (date) =>
  date.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

const MatchPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [matchData, setMatchData] = useState(null);
  const currentUser = useMemo(() => buildMatchesUser(user), [user]);

  const fetchMatchDetails = useCallback(async (matchId, options = {}) => {
    if (!matchId) return null;
    const requestFilter = options.includeArchived ? { filter: ARCHIVE_FILTER_VALUE } : {};
    try {
      return await getMatch(matchId, requestFilter);
    } catch (error) {
      if (!options.includeArchived && isMatchArchivedError(error)) {
        return getMatch(matchId, { filter: ARCHIVE_FILTER_VALUE });
      }
      throw error;
    }
  }, []);

  const matchQuery = useQuery({
    queryKey: ["play-dates-match-page", id],
    enabled: Boolean(id),
    retry: false,
    queryFn: async () => fetchMatchDetails(id),
  });

  useEffect(() => {
    if (matchQuery.data) {
      setMatchData(matchQuery.data);
    }
  }, [matchQuery.data]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem("user", JSON.stringify(currentUser));
    } catch {
      // ignore storage errors
    }
  }, [currentUser]);

  const handleReloadMatch = useCallback(
    async (matchId = id, options = {}) => {
      const refreshed = await fetchMatchDetails(matchId, options);
      if (refreshed) {
        setMatchData(refreshed);
        queryClient.setQueryData(["play-dates-match-page", String(matchId)], refreshed);
      }
      return refreshed;
    },
    [fetchMatchDetails, id, queryClient],
  );

  const handleClose = useCallback(() => {
    const from = location.state?.from;
    if (from && typeof from === "string") {
      navigate(from);
      return;
    }
    navigate("/matches");
  }, [location.state, navigate]);

  const handleRequireSignIn = useCallback(() => {
    navigate("/login", { state: { from: location } });
  }, [location, navigate]);

  const handleManageInvites = useCallback(
    (matchId) => {
      if (!matchId) return;
      navigate(`/matches/${matchId}/invite`);
    },
    [navigate],
  );

  const handleMatchRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["play-dates-match-page", id] });
  }, [id, queryClient]);

  if (matchQuery.isLoading && !matchData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 text-sm font-semibold text-slate-600 shadow-sm">
          Loading match details...
        </div>
      </div>
    );
  }

  if (matchQuery.isError && !matchData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start gap-3 text-slate-900">
            <AlertCircle className="mt-0.5 h-5 w-5 text-rose-500" />
            <div className="space-y-2">
              <h1 className="text-lg font-bold">Unable to load this match</h1>
              <p className="text-sm font-medium text-slate-600">
                {matchQuery.error?.message || "The match may have been removed or is temporarily unavailable."}
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => matchQuery.refetch()}
              className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-violet-700"
            >
              Retry
            </button>
            <Link
              to="/matches"
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              Back to matches
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <MatchDetailsModal
        isOpen={Boolean(matchData?.match)}
        matchData={matchData}
        currentUser={currentUser}
        onClose={handleClose}
        onRequireSignIn={handleRequireSignIn}
        onMatchRefresh={handleMatchRefresh}
        onReloadMatch={handleReloadMatch}
        onUpdateMatch={setMatchData}
        onToast={() => {}}
        formatDateTime={formatDateTime}
        onManageInvites={handleManageInvites}
      />
    </div>
  );
};

export default MatchPage;
