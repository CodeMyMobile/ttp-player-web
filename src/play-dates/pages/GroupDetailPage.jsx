import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, Loader2, Plus, Search, Trash2, Users, X } from "lucide-react";
import PlayerAvatar from "../components/PlayerAvatar";
import {
  createMatchGroup,
  deleteMatchGroup,
  getMatchGroup,
  listMatchGroupPlayers,
  updateMatchGroup,
} from "../services/matchGroups";
import { getAvatarInitials, getAvatarUrlFromPlayer } from "../utils/avatar";

const normalizePlayer = (player) => {
  const id = Number(player?.player_id ?? player?.user_id ?? player?.id);
  const name = player?.full_name || player?.name || player?.email || "Player";
  return {
    id,
    name,
    email: player?.email || "",
    ntrp: player?.skill_level || player?.ntrp || "",
    initials: getAvatarInitials(name, player?.email),
    avatarUrl: getAvatarUrlFromPlayer(player),
  };
};

function GroupDetailPage({ groupId, onBack, onSaved }) {
  const isNew = groupId === "new";
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [members, setMembers] = useState([]);
  const [showPlayerPicker, setShowPlayerPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  useEffect(() => {
    if (isNew) {
      setName("");
      setDescription("");
      setMembers([]);
      setError("");
      setShowPlayerPicker(false);
      setSearchQuery("");
      setSearchResults([]);
      setSearching(false);
      setLoading(false);
      return;
    }

    let cancelled = false;
    const loadGroup = async () => {
      try {
        setLoading(true);
        setError("");
        const group = await getMatchGroup(groupId);
        if (cancelled) return;
        setName(group?.name || "");
        setDescription(group?.description || "");
        setMembers(
          Array.isArray(group?.members)
            ? group.members.map(normalizePlayer).filter((player) => Number.isFinite(player.id))
            : [],
        );
      } catch (loadError) {
        if (!cancelled) {
          console.error(loadError);
          setError(loadError?.message || "Failed to load group.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadGroup();
    return () => {
      cancelled = true;
    };
  }, [groupId, isNew]);

  useEffect(() => {
    if (!showPlayerPicker) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }
    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        setSearching(true);
        const data = await listMatchGroupPlayers({
          search: searchQuery.trim(),
          perPage: 8,
        });
        if (cancelled) return;
        const existingIds = new Set(members.map((member) => Number(member.id)));
        const nextResults = Array.isArray(data?.players)
          ? data.players
              .map(normalizePlayer)
              .filter((player) => Number.isFinite(player.id) && !existingIds.has(Number(player.id)))
          : [];
        setSearchResults(nextResults);
      } catch (searchError) {
        if (!cancelled) {
          console.error(searchError);
          setSearchResults([]);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [members, searchQuery, showPlayerPicker]);

  const canSave = name.trim() && members.length > 0 && !saving && !deleting;

  const tips = useMemo(
    () => [
      "Add more players than you usually need so invites fill faster.",
      "Group names stay private to you. Players only see your invite.",
      "You can reuse the same group across private matches and notify flows.",
    ],
    [],
  );

  const addMember = (player) => {
    setMembers((current) => {
      if (current.some((member) => Number(member.id) === Number(player.id))) return current;
      return [...current, player];
    });
    setSearchQuery("");
  };

  const removeMember = (playerId) => {
    setMembers((current) => current.filter((member) => Number(member.id) !== Number(playerId)));
  };

  const handleSave = async () => {
    if (!canSave) return;
    try {
      setSaving(true);
      setError("");
      const playerIds = members.map((member) => Number(member.id)).filter(Number.isFinite);
      const payload = {
        name: name.trim(),
        description: description.trim() || null,
        playerIds,
        player_ids: playerIds,
      };
      if (isNew) {
        await createMatchGroup(payload);
      } else {
        await updateMatchGroup(groupId, payload);
      }
      onSaved?.();
    } catch (saveError) {
      console.error(saveError);
      setError(saveError?.message || "Failed to save group.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (isNew) return;
    if (!window.confirm("Delete this match group?")) return;
    try {
      setDeleting(true);
      setError("");
      await deleteMatchGroup(groupId);
      onSaved?.();
    } catch (deleteError) {
      console.error(deleteError);
      setError(deleteError?.message || "Failed to delete group.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <main className="mx-auto max-w-[880px] px-4 pb-16 pt-7 sm:px-6 lg:px-10">
      <button
        type="button"
        onClick={onBack}
        className="mb-[18px] inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to groups
      </button>

      <section className="mb-6 flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-violet-500">
            {isNew ? "New group" : "Edit group"}
          </p>
          <h1 className="text-[28px] font-black tracking-[-0.025em] text-slate-950">
            {isNew ? "Create a group" : name || "Untitled group"}
          </h1>
        </div>
        {!isNew && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-red-50 px-4 py-2.5 text-sm font-black text-red-600 transition hover:bg-red-100 disabled:opacity-60"
          >
            <Trash2 className="h-4 w-4" />
            {deleting ? "Deleting" : "Delete"}
          </button>
        )}
      </section>

      {loading ? (
        <div className="flex justify-center rounded-2xl border border-slate-200 bg-white px-6 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <section className="mb-4 rounded-[14px] border border-slate-200 bg-white p-[18px]">
              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Group name
                  </label>
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Sat AM 4.0 regulars"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
                <div>
                  <label className="mb-2 block text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Description
                  </label>
                  <input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="e.g. Weekly doubles crew, 8am Penmar"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-[14px] border border-slate-200 bg-white">
              <div className="flex items-center justify-between px-[18px] pb-2 pt-[14px]">
                <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Members ({members.length})
                </div>
                <button
                  type="button"
                  onClick={() => setShowPlayerPicker((current) => !current)}
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-violet-600 transition hover:text-violet-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add player
                </button>
              </div>
              <div className="px-[18px] pb-[18px]">
                {showPlayerPicker && (
                  <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate-400" />
                      <input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder="Search players to add"
                        className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                      />
                      {searching && (
                        <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-violet-500" />
                      )}
                    </div>
                    <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
                      {searchResults.length === 0 && !searching ? (
                        <div className="px-4 py-5 text-center text-sm font-semibold text-slate-500">
                          {searchQuery.trim()
                            ? "No players match that search."
                            : "Start with suggested players or search by name."}
                        </div>
                      ) : (
                        searchResults.map((player, index) => (
                          <button
                            key={player.id}
                            type="button"
                            onClick={() => addMember(player)}
                            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-violet-50 ${
                              index > 0 ? "border-t border-slate-100" : ""
                            }`}
                          >
                            <PlayerAvatar
                              name={player.name}
                              imageUrl={player.avatarUrl}
                              fallback={player.initials}
                              size="sm"
                              variant="violet"
                              showBadge={false}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-bold text-slate-950">
                                {player.name}
                              </div>
                              <div className="truncate text-xs font-medium text-slate-500">
                                {player.ntrp ? `NTRP ${player.ntrp}` : "Player"}
                                {player.email ? ` · ${player.email}` : ""}
                              </div>
                            </div>
                            <div className="inline-flex items-center gap-1 text-xs font-bold text-violet-600">
                              <Plus className="h-3.5 w-3.5" />
                              Add
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {members.length === 0 ? (
                  <div className="px-[18px] py-10 text-center">
                    <div className="mx-auto mb-2 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-slate-100 text-slate-400">
                      <Users className="h-[22px] w-[22px]" />
                    </div>
                    <div className="mb-1 text-sm font-bold text-slate-700">No members yet</div>
                    <div className="text-xs font-semibold text-slate-500">
                      Add players by name, email, or phone number.
                    </div>
                  </div>
                ) : (
                  <div>
                    {members.map((member, index) => (
                      <div
                        key={member.id}
                        className={`flex items-center gap-3 py-2.5 ${index > 0 ? "border-t border-slate-100" : ""}`}
                      >
                        <PlayerAvatar
                          name={member.name}
                          imageUrl={member.avatarUrl}
                          fallback={member.initials}
                          size="sm"
                          variant="violet"
                          showBadge={false}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-bold text-slate-950">{member.name}</div>
                          <div className="text-xs font-medium text-slate-500">
                            {member.ntrp ? `NTRP ${member.ntrp}` : "Player"}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMember(member.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="self-start lg:sticky lg:top-24">
            <section className="mb-4 rounded-[14px] border border-violet-100 bg-violet-50/70 p-4">
              <div className="mb-2 flex items-start gap-2.5">
                <div className="mt-0.5 text-violet-500">
                  <Users className="h-4 w-4" />
                </div>
                <div className="text-sm font-bold text-slate-900">Privacy</div>
              </div>
              <p className="text-sm font-semibold leading-6 text-slate-700">
                Groups are private to you. Members don&apos;t see the group name, they just see your
                match invites. Only you can edit or delete this group.
              </p>
            </section>

            <section className="rounded-[14px] border border-slate-200 bg-white p-4">
              <div className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
                Tips
              </div>
              <ul className="space-y-2 text-sm font-semibold leading-6 text-slate-700">
                {tips.map((tip) => (
                  <li key={tip} className="flex gap-2">
                    <span className="text-violet-500">•</span>
                    <span>{tip}</span>
                  </li>
                ))}
              </ul>
            </section>

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                {error}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={onBack}
                className="basis-[36%] rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!canSave}
                className="flex-1 rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-700 disabled:bg-slate-200 disabled:text-slate-400"
              >
                {saving ? "Saving..." : isNew ? "Create group" : "Save changes"}
              </button>
            </div>
          </aside>
        </div>
      )}
    </main>
  );
}

export default GroupDetailPage;
