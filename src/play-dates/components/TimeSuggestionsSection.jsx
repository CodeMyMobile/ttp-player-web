import React, { useEffect, useState } from "react";
import { CalendarClock } from "lucide-react";
import PlayerAvatar from "./PlayerAvatar";
import { acceptTimeSuggestion, declineTimeSuggestion, listTimeSuggestions } from "../services/matches";
import { formatMatchDateTimeForDisplay } from "../../utils/matchDateTime.js";

const errorCode = (error) =>
  (error?.response?.data?.error || error?.data?.error || "").toString().trim().toLowerCase();

const ACCEPT_ERROR_MESSAGES = {
  match_full: "The match is full now, so there's no spot for them.",
  time_in_past: "That time has already passed.",
  suggestion_closed: "This suggestion was already answered.",
  match_cancelled: "This match has been cancelled.",
  match_archived: "This match has already started.",
};

// Host-only: times players suggested instead of the match's. Accept moves the match to
// that time and adds the player in one tap; Decline leaves the match as it is. The API
// texts the player either way. Renders nothing until someone has suggested.
const TimeSuggestionsSection = ({ match, onAccepted, onToast }) => {
  const matchId = match?.id;
  const [suggestions, setSuggestions] = useState([]);
  const [busy, setBusy] = useState(null);

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
  }, [matchId]);

  if (!suggestions.length) return null;

  const describe = (time) => formatMatchDateTimeForDisplay({ ...match, start_date_time: time });
  const firstNameOf = (suggestion) => (suggestion.player?.full_name || "This player").split(" ")[0];
  const removeRow = (suggestion) => setSuggestions((rows) => rows.filter((row) => row.id !== suggestion.id));

  const accept = async (suggestion, time) => {
    if (busy) return;
    const name = firstNameOf(suggestion);
    const confirmed = window.confirm(
      `Move the match to ${describe(time)} and add ${name}? Anyone already in the match will get a text about the new time.`,
    );
    if (!confirmed) return;
    setBusy(`accept:${suggestion.id}:${time}`);
    try {
      await acceptTimeSuggestion(matchId, suggestion.id, time);
      removeRow(suggestion);
      onToast?.(`${name} is in, and the match is now ${describe(time)}. We've texted everyone.`);
      await onAccepted?.();
    } catch (error) {
      const code = errorCode(error);
      if (code === "suggestion_closed") removeRow(suggestion);
      onToast?.(ACCEPT_ERROR_MESSAGES[code] || "Couldn't accept this time. Please try again.", "error");
    } finally {
      setBusy(null);
    }
  };

  const decline = async (suggestion) => {
    if (busy) return;
    setBusy(`decline:${suggestion.id}`);
    try {
      await declineTimeSuggestion(matchId, suggestion.id);
      removeRow(suggestion);
      onToast?.(`Declined. We've let ${firstNameOf(suggestion)} know the match is staying as it is.`);
    } catch (error) {
      if (errorCode(error) === "suggestion_closed") removeRow(suggestion);
      onToast?.("Couldn't decline this suggestion. Please try again.", "error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50 p-4">
      <div>
        <div className="flex items-center gap-2 text-sm font-black text-violet-900">
          <CalendarClock className="h-4 w-4" />
          Suggested times
        </div>
        <p className="mt-1 text-xs font-semibold text-violet-700">
          Accept to move the match to their time and add them. Only you can see these.
        </p>
      </div>
      <div className="space-y-2">
        {suggestions.map((suggestion) => {
          const name = suggestion.player?.full_name || "A player";
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
                  {name.split(" ")[0]}{" "}
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
                    onClick={() => accept(suggestion, time)}
                    disabled={Boolean(busy)}
                    className="flex-none rounded-xl bg-violet-600 px-4 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy === `accept:${suggestion.id}:${time}` ? "Accepting..." : "Accept"}
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => decline(suggestion)}
                disabled={Boolean(busy)}
                className="text-xs font-bold text-gray-500 transition hover:text-gray-700 disabled:opacity-60"
              >
                {busy === `decline:${suggestion.id}` ? "Declining..." : "Decline"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default TimeSuggestionsSection;
