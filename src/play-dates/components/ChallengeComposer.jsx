import { useState } from "react";
import WhenPicker from "./WhenPicker";
import LocationPicker from "./LocationPicker";
import { formatDayLabel, formatTimeLabel } from "../utils/matchTimeLabels";
import { createMatch, sendInvites } from "../services/matches";
import { buildMatchPayloadFromCard } from "../utils/buildMatchPayload";
import { loadRecentLocations, recordRecentLocation } from "../utils/recentLocations";
import { getAvatarInitials } from "../utils/avatar";

// Dedicated "Challenge <player>" flow. Purpose-built so it's obvious you're inviting
// one specific player — but it reuses the exact same loop as the general composer
// (createMatch private → sendInvites) so there's no new backend surface.
const FORMATS = ["Singles", "Doubles"];
const FORMAT_COUNT = { Singles: 2, Doubles: 4 };

const Shell = ({ children }) => (
  <div className="mx-auto flex min-h-[560px] w-full max-w-[440px] flex-col overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-slate-200">
    {children}
  </div>
);

function Field({ label, children }) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-extrabold text-slate-500">{label}</div>
      {children}
    </div>
  );
}

function RowButton({ onClick, value, active }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-xl border px-3.5 py-3 text-sm font-semibold ${
        active ? "border-violet-300 text-slate-900" : "border-slate-200 text-slate-500"
      }`}
    >
      <span className="truncate">{value}</span>
      <span className="text-violet-500">›</span>
    </button>
  );
}

export default function ChallengeComposer({ opponent, currentUser, onCancel, onSent }) {
  const [screen, setScreen] = useState("form"); // form | when | loc | success
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState(null);
  const [longitude, setLongitude] = useState(null);
  const [format, setFormat] = useState("Singles");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [recentLocations] = useState(() => loadRecentLocations());

  const name = opponent?.name || "Player";
  const ntrp = opponent?.ntrp;
  const playerRating = currentUser?.skillLevel || null;
  const scheduled = Boolean(date && startTime);

  if (screen === "when") {
    return (
      <Shell>
        <WhenPicker
          initialDate={date}
          initialTime={startTime}
          onSave={(d, t) => {
            setDate(d);
            setStartTime(t);
            setScreen("form");
          }}
          onCancel={() => setScreen("form")}
        />
      </Shell>
    );
  }

  if (screen === "loc") {
    return (
      <Shell>
        <LocationPicker
          recentLocations={recentLocations}
          onSave={({ label, latitude: la, longitude: lo }) => {
            setLocation(label);
            setLatitude(la);
            setLongitude(lo);
            setScreen("form");
          }}
          onCancel={() => setScreen("form")}
        />
      </Shell>
    );
  }

  if (screen === "success") {
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
          <div className="text-4xl">🎾</div>
          <h2 className="text-lg font-extrabold text-slate-900">Challenge sent</h2>
          <p className="max-w-xs text-sm font-medium leading-relaxed text-slate-500">
            {name} gets a notification with your match details. They can accept, suggest another
            time, or decline.
          </p>
          <button
            type="button"
            onClick={onSent}
            className="mt-2 rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-bold text-white"
          >
            Done
          </button>
        </div>
      </Shell>
    );
  }

  const send = async () => {
    if (sending) return;
    setError(null);
    if (!scheduled) {
      setError("Pick a day and time.");
      return;
    }
    if (!location) {
      setError("Pick a court.");
      return;
    }
    const opponentId = Number(opponent?.id);
    if (!Number.isFinite(opponentId)) {
      setError("This player can't be challenged right now.");
      return;
    }
    setSending(true);
    try {
      const card = {
        format,
        count: FORMAT_COUNT[format] || 2,
        levelMode: "my",
        rMin: playerRating,
        rMax: playerRating,
        date,
        startTime,
        duration: "1.5",
        location,
        latitude,
        longitude,
      };
      const payload = buildMatchPayloadFromCard(card, {
        type: "private",
        playerRating,
        shareChoice: "profile",
        notes: note.trim(),
      });
      const res = await createMatch(payload);
      const created = res?.match || res;
      const matchId = created?.id || created?.match_id;
      if (!matchId) throw new Error("Match created but no ID returned");
      await sendInvites(matchId, { playerIds: [opponentId], phoneNumbers: [] });
      recordRecentLocation(location, latitude, longitude);
      setScreen("success");
    } catch (err) {
      setError(err?.message || "Couldn't send the challenge. Try again.");
    } finally {
      setSending(false);
    }
  };

  const whenLabel = scheduled ? `${formatDayLabel(date)} · ${formatTimeLabel(startTime)}` : "Pick a day & time";

  return (
    <Shell>
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 pb-4 pt-5">
        <div className="grid h-11 w-11 place-items-center rounded-full bg-violet-100 text-sm font-extrabold text-violet-700">
          {getAvatarInitials(name)}
        </div>
        <div className="min-w-0">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-violet-700">Challenge</div>
          <div className="truncate text-base font-extrabold text-slate-900">{name}</div>
          <div className="text-xs font-semibold text-slate-400">{ntrp ? `NTRP ~${ntrp}` : "Invite to a match"}</div>
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
        <Field label="When">
          <RowButton onClick={() => setScreen("when")} value={whenLabel} active={scheduled} />
        </Field>
        <Field label="Court">
          <RowButton onClick={() => setScreen("loc")} value={location || "Pick a court"} active={Boolean(location)} />
        </Field>
        <Field label="Format">
          <div className="flex gap-2">
            {FORMATS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-bold ${
                  format === f ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-500"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Note (optional)">
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            placeholder="Up for a match this week?"
            className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-violet-500"
          />
        </Field>
        {error ? <p className="text-sm font-semibold text-rose-600">{error}</p> : null}
      </div>

      <div className="flex gap-2.5 border-t border-slate-100 px-5 py-4">
        <button
          type="button"
          onClick={onCancel}
          disabled={sending}
          className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-500 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="flex-[2] rounded-xl bg-violet-600 py-3 text-sm font-bold text-white disabled:opacity-60"
        >
          {sending ? "Sending…" : "📨 Send challenge"}
        </button>
      </div>
    </Shell>
  );
}
