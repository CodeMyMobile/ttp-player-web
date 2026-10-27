import React, { useMemo, useState } from "react";
import { Check, Search, UserPlus, X } from "lucide-react";
import PlayerAvatar from "./PlayerAvatar";
import { addMatchParticipant, listMatchConnections } from "../services/matches";
import { filterPlayersByName } from "../utils/playerSearch";

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

// Short lists fit on screen; past this a search box earns its space.
const SEARCH_THRESHOLD = 6;

// Host-only: seat someone they already play with, no invite needed. The list
// loads on first open so the match screen doesn't pay for it up front.
const AddConnectionsSection = ({ matchId, onAdded, onToast, onInviteOthers }) => {
  const [open, setOpen] = useState(false);
  const [connections, setConnections] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [addingId, setAddingId] = useState(null);
  const [query, setQuery] = useState("");

  const visibleConnections = useMemo(
    () => filterPlayersByName(connections || [], query),
    [connections, query],
  );
  const showSearch = (connections?.length || 0) >= SEARCH_THRESHOLD;

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
    if (!next) setQuery("");
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
            <>
              {showSearch && (
                <div className="border-b border-gray-100 p-2">
                  <label className="relative block">
                    <span className="sr-only">Search your players</span>
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="search"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={`Search ${connections.length} players`}
                      autoComplete="off"
                      enterKeyHint="search"
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-10 text-base font-semibold text-gray-900 placeholder:text-gray-400 focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100 sm:text-sm [&::-webkit-search-cancel-button]:hidden"
                    />
                    {query && (
                      <button
                        type="button"
                        onClick={() => setQuery("")}
                        aria-label="Clear search"
                        className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </label>
                </div>
              )}
              {visibleConnections.length === 0 ? (
                <p className="p-3 text-sm font-semibold text-gray-600">
                  No one matching &ldquo;{query.trim()}&rdquo;. Try part of their first or last name.
                </p>
              ) : (
                <ul className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
                  {visibleConnections.map((player) => (
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
            </>
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
