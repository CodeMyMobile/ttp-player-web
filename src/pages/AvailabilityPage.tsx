import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import MainLayout from "../components/MainLayout";
import { getMyAvailability, saveMyAvailability } from "../api/availability";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import {
  AVAILABILITY_BUCKETS,
  AVAILABILITY_DAYS,
  slotSet,
  slotsFromSet,
  toggleSlot,
} from "../utils/availabilityGrid";

import "./AvailabilityPage.css";

/**
 * Weekly availability (home v2): a grid of weekday × time of day. League best bets and "You're
 * both free" are worked out from it (ttp-api player_availability). Saving replaces the whole grid.
 */
const AvailabilityPage = () => {
  const { user } = useAuth();
  const token = useMemo(
    () =>
      user?.session?.access_token ??
      user?.access_token ??
      user?.token ??
      getStoredAuthToken({ preferScheme: "token" }) ??
      undefined,
    [user],
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getMyAvailability({ token, signal: controller.signal })
      .then((res) => {
        const initial = slotSet(res.slots ?? []);
        setSelected(initial);
        setSaved([...initial].sort().join("|"));
      })
      .catch((err) => {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Couldn't load your times.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token]);

  const dirty = [...selected].sort().join("|") !== saved;

  const save = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await saveMyAvailability({ token, slots: slotsFromSet(selected) });
      const next = slotSet(res.slots ?? []);
      setSelected(next);
      setSaved([...next].sort().join("|"));
      setNotice("Saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your times.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <MainLayout>
      <div className="availability-page">
        <h1 className="availability-page__title">When you can play</h1>
        <p className="availability-page__lede">
          Tick the times you can usually play. We use them to find times you and other players are both free.
        </p>

        {loading ? (
          <div className="availability-grid availability-grid--loading" aria-busy="true" />
        ) : (
          <table className="availability-grid">
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">Day</span>
                </th>
                {AVAILABILITY_BUCKETS.map((bucket) => (
                  <th key={bucket.key} scope="col" title={bucket.label}>
                    {bucket.hours}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {AVAILABILITY_DAYS.map((day) => (
                <tr key={day.weekday}>
                  <th scope="row">{day.short}</th>
                  {AVAILABILITY_BUCKETS.map((bucket) => {
                    const on = selected.has(`${day.weekday}:${bucket.key}`);
                    return (
                      <td key={bucket.key}>
                        <button
                          type="button"
                          className={`availability-cell${on ? " is-on" : ""}`}
                          aria-pressed={on}
                          aria-label={`${day.long}, ${bucket.label.toLowerCase()} (${bucket.hours})`}
                          onClick={() => {
                            setNotice(null);
                            setSelected((current) => toggleSlot(current, { weekday: day.weekday, bucket: bucket.key }));
                          }}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="availability-page__foot">
          <button type="button" className="availability-page__save" disabled={loading || saving || !dirty} onClick={() => void save()}>
            {saving ? "Saving..." : "Save"}
          </button>
          <p className="availability-page__status" aria-live="polite">
            {error ?? notice ?? (selected.size ? `${selected.size} times a week` : "Nothing ticked yet")}
          </p>
        </div>

        <Link className="availability-page__back" to="/settings/match-profile">
          Back to your match profile
        </Link>
      </div>
    </MainLayout>
  );
};

export default AvailabilityPage;
