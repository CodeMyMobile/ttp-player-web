import { useEffect, useMemo, useState } from "react";
import Autocomplete from "react-google-autocomplete";
import { useNavigate, useParams } from "react-router-dom";
import { Trash2, X } from "lucide-react";

import { createLeagueMatchNeed, getLeagueMatchNeeds, type LeagueMatchSuggestion } from "../api/leagues";
import MainLayout from "../components/MainLayout";
import { useAuth } from "../context/AuthContext";
import { getStoredAuthToken } from "../services/authToken";
import { addDaysYmd, formatDateForDisplay, formatTimeForDisplay, todayYmd } from "../utils/dateTime";

import "./LeaguesPage.css";

export interface AvailabilitySlot {
  id: string;
  date: string;
  time: string;
  dateStr: string;
  timeStr: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
}

const placeLabel = (place: google.maps.places.PlaceResult | null, fallback: string) => {
  const name = place?.name?.trim();
  const address = place?.formatted_address?.trim();
  // Venue name first, address for context — falls back gracefully.
  if (name && address && !address.startsWith(name)) return `${name}, ${address}`;
  return name || address || fallback;
};

const PostAvailabilityPage = () => {
  const { id: leagueId = "" } = useParams();
  const navigate = useNavigate();
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

  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [previousCourts, setPreviousCourts] = useState<string[]>([]);
  const [matchDate, setMatchDate] = useState("");
  const [matchTime, setMatchTime] = useState("");
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  // Bumped to remount the (uncontrolled) location input when we set it in code.
  const [locationKey, setLocationKey] = useState(0);
  const [shareWithLeagueOnly, setShareWithLeagueOnly] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Today, Tomorrow, then the next 5 days in chronological order (labelled by
  // weekday) — so the sequence flows naturally instead of jumping to Monday.
  const datePicks = useMemo(() => {
    const picks = [
      { label: "Today", value: todayYmd() },
      { label: "Tomorrow", value: addDaysYmd(1) },
    ];
    for (let i = 2; i <= 6; i += 1) {
      const value = addDaysYmd(i);
      const label = new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" });
      picks.push({ label, value });
    }
    return picks;
  }, []);

  // Previous courts = locations from the user's own past match-needs in this league.
  useEffect(() => {
    if (!leagueId) return undefined;
    const controller = new AbortController();
    getLeagueMatchNeeds({ leagueId, token, signal: controller.signal })
      .then((res) => {
        const seen = new Set<string>();
        const courts: string[] = [];
        (res.myNeeds ?? []).forEach((need) => {
          const text = typeof need.location_text === "string" ? need.location_text.trim() : "";
          if (text && !seen.has(text)) {
            seen.add(text);
            courts.push(text);
          }
        });
        if (!controller.signal.aborted) setPreviousCourts(courts.slice(0, 6));
      })
      .catch(() => {
        if (!controller.signal.aborted) setPreviousCourts([]);
      });
    return () => controller.abort();
  }, [leagueId, token]);

  const clearForm = () => {
    setMatchDate("");
    setMatchTime("");
    setLocation("");
    setLatitude(null);
    setLongitude(null);
    setLocationKey((k) => k + 1);
  };

  const addSlot = (event: React.FormEvent) => {
    event.preventDefault();
    if (!matchDate || !matchTime || !location.trim()) return;
    setSlots((prev) => [
      ...prev,
      {
        id: `${Date.now()}`,
        date: matchDate,
        time: matchTime,
        dateStr: formatDateForDisplay(matchDate),
        timeStr: formatTimeForDisplay(matchTime),
        location: location.trim(),
        latitude,
        longitude,
      },
    ]);
    clearForm();
  };

  const removeSlot = (slotId: string) => setSlots((prev) => prev.filter((s) => s.id !== slotId));

  const submitAvailability = async () => {
    if (!slots.length || !leagueId) return;
    setSubmitting(true);
    setError(null);
    const allSuggestions: LeagueMatchSuggestion[] = [];
    const failed: AvailabilitySlot[] = [];

    for (let i = 0; i < slots.length; i += 1) {
      const slot = slots[i];
      setProgress(`Posting ${i + 1}/${slots.length}…`);
      try {
        // Reuse the real endpoint (request() → base URL + auth). One POST per slot.
        const res = await createLeagueMatchNeed({
          leagueId,
          token,
          body: {
            date: slot.date,
            time: slot.time,
            location: slot.location,
            latitude: slot.latitude,
            longitude: slot.longitude,
            timezone: "America/Los_Angeles",
            visibility: shareWithLeagueOnly ? "league" : "open",
          },
        });
        if (res.suggestions) allSuggestions.push(...res.suggestions);
      } catch (err) {
        console.error(`Failed to post availability slot ${i + 1}`, err);
        failed.push(slot);
      }
    }

    setSubmitting(false);
    setProgress("");

    if (failed.length) {
      setSlots(failed); // keep only the failures for retry
      setError(`Couldn't post ${failed.length} of ${slots.length} time${slots.length === 1 ? "" : "s"}. Please try again.`);
      return;
    }

    navigate(`/leagues/${leagueId}/availability-review`, {
      state: { postedSlots: slots, suggestions: allSuggestions },
    });
  };

  return (
    <MainLayout
      pageClassName="leagues-shell leagues-shell--flow"
      hideMobileNewMatch
      hideMobileLocation
      hideMobileNotifications
      onMobileBack={() => navigate(`/leagues/${leagueId}`)}
    >
      <section className="leagues-page leagues-page--flow">
        <header className="leagues-page__header">
          <div>
            <h1>Post your availability</h1>
            <p>Add the times you&apos;re free to play.</p>
          </div>
        </header>

        {slots.length > 0 ? (
          <div className="availability-list">
            {slots.map((slot) => (
              <div key={slot.id} className="availability-item">
                <div>
                  <strong>
                    {slot.dateStr} · {slot.timeStr}
                  </strong>
                  <p>{slot.location}</p>
                </div>
                <button type="button" className="availability-item__remove" onClick={() => removeSlot(slot.id)} aria-label="Remove time">
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <form className="availability-form" onSubmit={addSlot}>
          <h2 className="availability-form__title">Add a match time</h2>

          <div className="availability-form__label">Quick pick a day</div>
          <div className="quick-pick-grid">
            {datePicks.map((pick) => (
              <button
                key={pick.label}
                type="button"
                className={`quick-pick${matchDate === pick.value ? " active" : ""}`}
                onClick={() => setMatchDate(pick.value)}
              >
                {pick.label}
              </button>
            ))}
          </div>

          <div className="availability-form__row">
            <label className="league-need-field">
              <span>Date</span>
              <input type="date" value={matchDate} min={todayYmd()} onChange={(e) => setMatchDate(e.target.value)} />
            </label>
            <label className="league-need-field">
              <span>Time</span>
              <input type="time" value={matchTime} onChange={(e) => setMatchTime(e.target.value)} />
            </label>
          </div>

          <div className="league-need-field">
            <span>Location</span>
            <Autocomplete
              key={`loc-${locationKey}`}
              apiKey={import.meta.env.VITE_GOOGLE_API_KEY || undefined}
              placeholder="Search court or address"
              defaultValue={location}
              onChange={(event) => {
                setLocation((event.target as HTMLInputElement).value);
                setLatitude(null);
                setLongitude(null);
              }}
              onPlaceSelected={(place) => {
                setLocation(placeLabel(place, location));
                setLocationKey((k) => k + 1);
                const lat = place?.geometry?.location?.lat?.();
                const lng = place?.geometry?.location?.lng?.();
                setLatitude(typeof lat === "number" && Number.isFinite(lat) ? lat : null);
                setLongitude(typeof lng === "number" && Number.isFinite(lng) ? lng : null);
              }}
              options={{
                types: ["geocode", "establishment"],
                fields: ["formatted_address", "geometry", "name", "address_components"],
                componentRestrictions: { country: "us" },
              }}
            />
            {previousCourts.length > 0 ? (
              <div className="previous-courts">
                {previousCourts.map((court) => (
                  <button
                    key={court}
                    type="button"
                    className="court-quick-pick"
                    onClick={() => {
                      setLocation(court);
                      setLatitude(null);
                      setLongitude(null);
                      setLocationKey((k) => k + 1);
                    }}
                  >
                    {court}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <button
            type="submit"
            className="availability-form__add"
            disabled={!matchDate || !matchTime || !location.trim()}
          >
            + Add this time
          </button>
        </form>

        {error ? <div className="leagues-page__state leagues-page__state--error">{error}</div> : null}

        <label className="availability-visibility">
          <input
            type="checkbox"
            checked={shareWithLeagueOnly}
            onChange={(event) => setShareWithLeagueOnly(event.target.checked)}
          />
          <span>
            <strong>Only available to league players</strong>
            <small>Uncheck to also match open, level-verified players in other leagues.</small>
          </span>
        </label>

        <div className="availability-actions">
          <button type="button" className="availability-actions__cancel" onClick={() => navigate(`/leagues/${leagueId}`)}>
            <X size={16} /> Cancel
          </button>
          <button
            type="button"
            className="availability-actions__submit"
            disabled={slots.length === 0 || submitting}
            onClick={submitAvailability}
          >
            {submitting ? progress || "Posting…" : `Post availability${slots.length ? ` (${slots.length})` : ""}`}
          </button>
        </div>
      </section>
    </MainLayout>
  );
};

export default PostAvailabilityPage;
