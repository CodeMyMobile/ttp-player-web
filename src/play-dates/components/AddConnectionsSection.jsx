import React, { useState } from "react";
import { Check, UserPlus } from "lucide-react";
import PlayerAvatar from "./PlayerAvatar";
import { addMatchParticipant, listMatchConnections } from "../services/matches";

const errorCode = (error) =>
  (error?.response?.data?.error || error?.data?.error || "").toString().trim().toLowerCase();

const ADD_ERROR_MESSAGES = {
  match_full: "The match is full.",
  already_joined: "They're already in this match.",
  slot_choice_required: "This match still has more than one time. Send an invite so they can pick.",
  not_connected: "You can only add players you've played with. Send an invite instead.",
};

const connectionLabel = (player) => {
  if (player.played_together && player.hit_connected) return "Played together · Hit partner";
  if (player.played_together) return "Played together";
  return "Hit partner";
};

// Host-only: seat someone they already play with, no invite needed. The list
// loads on first open so the match screen doesn't pay for it up front.
const AddConnectionsSection = ({ matchId, onAdded, onToast, onInviteOthers }) => {
  const [open, setOpen] = useState(false);
  const [connections, setConnections] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [addingId, setAddingId] = useState(null);

  const load = async () => {
    setLoadError(false);
    try {
      const data = await listMatchConnections(matchId);
      setConnections(Array.isArray(data?.connections) ? data.connections : []);
    } catch {
      setLoadError(true);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && connections === null) load();
  };

  const add = async (player) => {
    if (addingId) return;
    setAddingId(player.id);
    try {
      await addMatchParticipant(matchId, player.id);
      setConnections((rows) => rows.map((row) => (row.id === player.id ? { ...row, in_match: true } : row)));
      onToast?.(`${player.full_name} is in. We've texted them.`);
      await onAdded?.();
    } catch (error) {
      onToast?.(ADD_ERROR_MESSAGES[errorCode(error)] || "Couldn't add this player. Please try again.", "error");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-violet-100 bg-violet-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-black text-violet-900">
            <UserPlus className="h-4 w-4" />
            Add a player
          </div>
          <p className="mt-1 text-xs font-semibold text-violet-700">
            Add someone you&apos;ve played with. They&apos;re in right away and get a text.
          </p>
        </div>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="shrink-0 rounded-xl bg-violet-600 px-4 py-2 text-sm font-black text-white shadow-sm transition hover:bg-violet-700"
        >
          {open ? "Done" : "Add player"}
        </button>
      </div>

      {open && (
        <div className="rounded-xl border border-violet-100 bg-white">
          {loadError ? (
            <div className="flex items-center justify-between gap-3 p-3 text-sm font-semibold text-gray-600">
              Couldn&apos;t load your players.
              <button type="button" onClick={load} className="font-black text-violet-700">
                Retry
              </button>
            </div>
          ) : connections === null ? (
            <p className="p-3 text-sm font-semibold text-gray-500">Loading your players...</p>
          ) : connections.length === 0 ? (
            <p className="p-3 text-sm font-semibold text-gray-600">
              Players you&apos;ve played a match with, or connected with through a hit request, show up here.
            </p>
          ) : (
            <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
              {connections.map((player) => (
                <li key={player.id} className="flex items-center gap-3 p-3">
                  <PlayerAvatar name={player.full_name} imageUrl={player.profile_picture} size="sm" showBadge={false} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">{player.full_name}</p>
                    <p className="text-xs font-semibold text-gray-500">{connectionLabel(player)}</p>
                  </div>
                  {player.in_match ? (
                    <span className="inline-flex items-center gap-1 text-xs font-black text-emerald-700">
                      <Check className="h-3.5 w-3.5" /> In match
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => add(player)}
                      disabled={Boolean(addingId)}
                      className="rounded-lg border border-violet-200 px-3 py-1.5 text-xs font-black text-violet-700 transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {addingId === player.id ? "Adding..." : "Add"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {onInviteOthers && (
            <button
              type="button"
              onClick={onInviteOthers}
              className="w-full border-t border-violet-100 p-3 text-left text-xs font-black text-violet-700"
            >
              Someone else? Send an invite instead
            </button>
          )}
        </div>
      )}
    </section>
  );
};

export default AddConnectionsSection;
