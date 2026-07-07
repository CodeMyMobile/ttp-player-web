import { useEffect, useState } from "react";

import { fetchPackageCredits, type PackagePurchase } from "../api/playerPackages";
import { fetchCoachProfile } from "../api/coachProfile";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";

const extractCoachName = (record: unknown): string => {
  if (!record || typeof record !== "object") return "";
  const r = record as Record<string, unknown>;
  const candidates = [
    r.fullName,
    r.full_name,
    r.name,
    r.display_name,
    [r.first_name, r.last_name].filter(Boolean).join(" ").trim(),
  ];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return "";
};

export interface UsePackagePurchasesResult {
  purchases: PackagePurchase[];
  coachNames: Record<string, string>;
  loading: boolean;
  error: string | null;
}

// Loads the player's lesson-package purchase history across all coaches for read-only
// display. Fetches with includeExpired: true and keeps every PAID purchase — used-up and
// expired records intentionally stay in the list. It deliberately does NOT use
// isActivePackagePurchase (which whitelists statuses and would silently drop a distinct
// `expired` status) and applies no remaining > 0 filter.
export const usePackagePurchases = (): UsePackagePurchasesResult => {
  const { user } = useAuth();
  const token =
    user?.session?.access_token ??
    user?.access_token ??
    user?.token ??
    getStoredAuthToken({ preferScheme: "Token" }) ??
    getStoredAuthToken({ preferScheme: "token" }) ??
    undefined;

  const [purchases, setPurchases] = useState<PackagePurchase[]>([]);
  const [coachNames, setCoachNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetchPackageCredits({ token, includeExpired: true, signal: controller.signal })
      .then(async (res) => {
        if (controller.signal.aborted) return;
        const paid = (res.purchases ?? []).filter((purchase) => purchase.paid === true);
        setPurchases(paid);

        // Resolve coach names — one call per distinct coach, failures degrade quietly to
        // no coach name (never blocks or errors a row).
        const coachIds = [
          ...new Set(paid.map((p) => Number(p.coach_id)).filter((id) => Number.isFinite(id) && id > 0)),
        ];
        const entries = await Promise.all(
          coachIds.map((id) =>
            fetchCoachProfile(id, { token, signal: controller.signal })
              .then((profile) => [String(id), extractCoachName(profile)] as const)
              .catch(() => [String(id), ""] as const),
          ),
        );
        if (controller.signal.aborted) return;
        const map: Record<string, string> = {};
        entries.forEach(([id, name]) => {
          if (name) map[id] = name;
        });
        setCoachNames(map);
      })
      .catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Couldn't load your purchase history.");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token]);

  return { purchases, coachNames, loading, error };
};

export default usePackagePurchases;
