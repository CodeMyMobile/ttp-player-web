import React, { useEffect, useRef, useState } from "react";
import { CalendarClock, Plus, X } from "lucide-react";
import { listTimeSuggestions, suggestMatchTime } from "../services/matches";
import { combineDateAndTimeToIso } from "../utils/datetime";
import { formatMatchDateTimeForDisplay } from "../../utils/matchDateTime.js";

const NOTE_MAX_LENGTH = 200;

const errorCode = (error) =>
  (error?.response?.data?.error || error?.data?.error || "").toString().trim().toLowerCase();

const SUGGEST_ERROR_MESSAGES = {
  already_suggested: "You've already suggested a time for this match.",
  not_invited: "Only invited players can suggest a time.",
  time_in_past: "Pick a time that hasn't passed yet.",
  time_too_far: "Pick a time within the next six months.",
  same_as_current_time: "That's the match's current time. Pick a different one.",
  match_cancelled: "This match has been cancelled.",
  match_archived: "This match has already started.",
  match_full: "This match is full. Join the waitlist instead.",
  already_joined: "You're already in this match.",
  suggestion_limit_reached: "This match has enough suggestions for now.",
  cannot_suggest: "You can't suggest a time for this match.",
};

const todayInput = () => {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
};

const emptySlot = () => ({ date: "", time: "" });

// For an invitee, or a player who could join an open match, who can't make its time:
// suggest one or two others. Only the organizer sees it; the match doesn't change
// unless they choose to move it.
const SuggestTimeSection = ({ match, hostFirstName, onToast, initiallyOpen = false }) => {
  const matchId = match?.id;
  const [mine, setMine] = useState(undefined);
  const [open, setOpen] = useState(initiallyOpen);
  const formRef = useRef(null);
  const [slots, setSlots] = useState([emptySlot()]);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!matchId) return undefined;
    let cancelled = false;
    listTimeSuggestions(matchId)
      .then((data) => {
        if (!cancelled) setMine(data?.mine || null);
      })
      .catch(() => {
        // Without the lookup, still offer the form; the API refuses a second suggestion.
        if (!cancelled) setMine(null);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId]);

  // Arriving from a "Suggest another" link elsewhere: bring the open form into view.
  const shouldScroll = initiallyOpen && open && mine === null;
  useEffect(() => {
    if (shouldScroll) formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [shouldScroll]);

  if (!matchId || mine === undefined) return null;

  const organizer = hostFirstName || "The organizer";
  const describe = (time) => formatMatchDateTimeForDisplay({ ...match, start_date_time: time });

  if (mine) {
    return (
      <div className="mt-4 flex items-start gap-3 rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3 text-left">
        <CalendarClock className="mt-0.5 h-4 w-4 flex-shrink-0 text-violet-600" />
        <p className="text-xs font-semibold text-violet-800">
          {mine.status === "declined"
            ? `${organizer} can't do ${(mine.suggested_times || []).map(describe).join(" or ")}, so the match is staying at this time.`
            : `You suggested ${(mine.suggested_times || []).map(describe).join(" or ")}. ${organizer} can see it.`}
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex w-full items-center justify-center gap-2 text-sm font-bold text-violet-700 transition hover:text-violet-800"
      >
        <CalendarClock className="h-4 w-4" />
        Can&apos;t make this time? Suggest another
      </button>
    );
  }

  const updateSlot = (index, field, value) => {
    setSlots((rows) => rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (sending) return;
    const filled = slots.filter((slot) => slot.date || slot.time);
    if (!filled.length || filled.some((slot) => !slot.date || !slot.time)) {
      setError("Pick a date and a time.");
      return;
    }
    const times = filled.map((slot) => combineDateAndTimeToIso(slot.date, slot.time));
    if (times.some((time) => !time)) {
      setError("Pick a date and a time.");
      return;
    }
    if (times.some((time) => new Date(time).getTime() <= Date.now())) {
      setError(SUGGEST_ERROR_MESSAGES.time_in_past);
      return;
    }
    setError("");
    setSending(true);
    try {
      const data = await suggestMatchTime(matchId, { times, note: note.trim() || undefined });
      setMine(data?.suggestion || { suggested_times: times });
      setOpen(false);
      onToast?.(`Sent. ${organizer} will see your suggestion.`);
    } catch (err) {
      setError(SUGGEST_ERROR_MESSAGES[errorCode(err)] || "Couldn't send your suggestion. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      ref={formRef}
      onSubmit={submit}
      className="mt-4 space-y-3 rounded-2xl border border-violet-100 bg-violet-50 p-4 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-sm font-black text-violet-900">
            <CalendarClock className="h-4 w-4" />
            Suggest another time
          </p>
          <p className="mt-1 text-xs font-semibold text-violet-700">
            Only {organizer} sees this. The match stays as it is unless they move it.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError("");
          }}
          aria-label="Close"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-violet-400 transition hover:bg-violet-100 hover:text-violet-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {slots.map((slot, index) => (
        <div key={index} className="flex items-center gap-2">
          <input
            type="date"
            min={todayInput()}
            value={slot.date}
            onChange={(event) => updateSlot(index, "date", event.target.value)}
            aria-label={index === 0 ? "Date" : "Second date"}
            className="min-w-0 flex-1 rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          <input
            type="time"
            step={900}
            value={slot.time}
            onChange={(event) => updateSlot(index, "time", event.target.value)}
            aria-label={index === 0 ? "Time" : "Second time"}
            className="w-32 flex-none rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
          {index > 0 && (
            <button
              type="button"
              onClick={() => setSlots((rows) => rows.filter((_, i) => i !== index))}
              aria-label="Remove second time"
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-gray-400 transition hover:bg-white hover:text-red-500"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      ))}
      {slots.length < 2 && (
        <button
          type="button"
          onClick={() => setSlots((rows) => [...rows, emptySlot()])}
          className="flex items-center gap-1 text-xs font-bold text-violet-700 hover:text-violet-800"
        >
          <Plus className="h-3.5 w-3.5" />
          Add another time
        </button>
      )}
      <textarea
        rows={2}
        maxLength={NOTE_MAX_LENGTH}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Add a note (optional)"
        className="w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm font-semibold text-gray-800 focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-200"
      />
      {error && <p className="text-xs font-semibold text-rose-600">{error}</p>}
      <button
        type="submit"
        disabled={sending}
        className="w-full rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {sending ? "Sending..." : `Send to ${organizer}`}
      </button>
    </form>
  );
};

export default SuggestTimeSection;
