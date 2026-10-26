import React, { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import PlayerAvatar from "./PlayerAvatar";
import { listTimeSuggestions, respondToTimeSuggestion } from "../services/matches";
import { formatMatchDateTimeForDisplay } from "../../utils/matchDateTime.js";

// Host-only: times invitees suggested instead of the match's. "Use this time" hands
// the time to the edit form, so the host still chooses whether players are told.
// Renders nothing until someone has suggested.
const TimeSuggestionsSection = ({ match, reloadKey, onUseTime, onToast }) => {
  const matchId = match?.id;
  const [suggestions, setSuggestions] = useState([]);
  const [dismissingId, setDismissingId] = useState(null);

  useEffect(() => {
    if (!matchId) return undefined;
    let cancelled = false;
    listTimeSuggestions(matchId)
      .then((data) => {
        if (!cancelled) setSuggestions(Array.isArray(data?.suggestions) ? data.suggestions : []);
      })
      .catch((error) => {
        console.warn("Failed to load time suggestions", error);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId, reloadKey]);

  if (!suggestions.length) return null;

  const describe = (time) => formatMatchDateTimeForDisplay({ ...match, start_date_time: time });

  const dismiss = async (suggestion) => {
    if (dismissingId) return;
    setDismissingId(suggestion.id);
    try {
      await respondToTimeSuggestion(matchId, suggestion.id, "dismissed");
      setSuggestions((rows) => rows.filter((row) => row.id !== suggestion.id));
    } catch {
      onToast?.("Couldn't dismiss this suggestion. Please try again.", "error");
    } finally {
      setDismissingId(null);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-violet-100 bg-violet-50 p-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-black text-violet-900">
          <CalendarClock className="h-4 w-4" />
          Suggested times
        </div>
        <p className="mt-1 text-xs font-semibold text-violet-700">
          Players who can&apos;t make this time suggested these. Only you can see them.
        </p>
      </div>
      <div className="space-y-2">
        {suggestions.map((suggestion) => {
          const name = suggestion.player?.full_name || "An invited player";
          const firstName = name.split(" ")[0];
          return (
            <div key={suggestion.id} className="space-y-2 rounded-xl bg-white p-3 shadow-sm">
              <div className="flex items-center gap-3">
                <PlayerAvatar
                  name={name}
                  imageUrl={suggestion.player?.profile_picture}
                  size="sm"
                  showBadge={false}
                />
                <p className="min-w-0 flex-1 text-sm font-bold text-gray-900">
                  {firstName}{" "}
                  <span className="font-semibold text-gray-500">
                    {suggestion.invited === false
                      ? "wants to play and suggested"
                      : "can’t make it and suggested"}
                  </span>
                </p>
              </div>
              {suggestion.note && (
                <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs font-medium italic text-gray-600">
                  &ldquo;{suggestion.note}&rdquo;
                </p>
              )}
              {(suggestion.suggested_times || []).map((time) => (
                <div key={time} className="flex items-center justify-between gap-2">
                  <span className="text-sm font-black text-gray-800">{describe(time)}</span>
                  <button
                    type="button"
                    onClick={() => onUseTime?.(suggestion, time)}
                    className="flex-none rounded-xl bg-violet-600 px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-violet-700"
                  >
                    Use this time
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => dismiss(suggestion)}
                disabled={dismissingId === suggestion.id}
                className="text-xs font-bold text-gray-500 transition hover:text-gray-700 disabled:opacity-60"
              >
                {dismissingId === suggestion.id ? "Dismissing..." : "Dismiss"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default TimeSuggestionsSection;
