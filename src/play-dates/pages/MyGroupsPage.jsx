import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Plus, RefreshCw, Search, Users } from "lucide-react";
import PlayerAvatar from "../components/PlayerAvatar";
import { getMatchGroup, listMatchGroups } from "../services/matchGroups";
import { getAvatarInitials, getAvatarUrlFromPlayer } from "../utils/avatar";

const normalizeGroupPlayer = (player) => {
  const name = player?.full_name || player?.name || player?.email || "Player";
  return {
    id: player?.player_id ?? player?.user_id ?? player?.id ?? name,
    name,
    initials: getAvatarInitials(name, player?.email),
    avatarUrl: getAvatarUrlFromPlayer(player),
  };
};

const formatRelativeLabel = (value) => {
  if (!value) return "Recently updated";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently updated";
  const diffMs = Date.now() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} week${Math.floor(diffDays / 7) === 1 ? "" : "s"} ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} month${Math.floor(diffDays / 30) === 1 ? "" : "s"} ago`;
  return `${Math.floor(diffDays / 365)} year${Math.floor(diffDays / 365) === 1 ? "" : "s"} ago`;
};

function MyGroupsPage({ onBack, onCreateGroup, onOpenGroup }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

  const loadGroups = async ({ silent = false } = {}) => {
    try {
      setError("");
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      const data = await listMatchGroups();
      const baseGroups = Array.isArray(data?.groups) ? data.groups : [];
      const detailGroups = await Promise.all(
        baseGroups.map(async (group) => {
          try {
            const detail = await getMatchGroup(group.id);
            const members = Array.isArray(detail?.members)
              ? detail.members.map(normalizeGroupPlayer)
              : [];
            return {
              ...group,
              ...detail,
              members,
            };
          } catch {
            return {
              ...group,
              members: [],
            };
          }
        }),
      );
      setGroups(detailGroups);
    } catch (loadError) {
      console.error(loadError);
      setError(loadError?.message || "Failed to load match groups.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadGroups();
  }, []);

  const filteredGroups = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return groups;
    return groups.filter((group) => {
      const name = (group?.name || "").toLowerCase();
      const description = (group?.description || "").toLowerCase();
      return name.includes(trimmed) || description.includes(trimmed);
    });
  }, [groups, query]);

  return (
    <main className="mx-auto max-w-[980px] px-4 pb-16 pt-7 sm:px-6 lg:px-10">
      <button
        type="button"
        onClick={onBack}
        className="mb-[18px] inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-200"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
        Back to Match Play
      </button>

      <section className="mb-6 flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-violet-500">
            Profile
          </p>
          <h1 className="text-[30px] font-black tracking-[-0.025em] text-slate-950">
            My groups
          </h1>
          <p className="mt-1.5 max-w-[560px] text-sm font-semibold leading-6 text-slate-500">
            Save reusable rosters of players you invite often. Groups are private to you and only
            visible from your account.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateGroup}
          className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-r from-violet-500 to-purple-600 px-4 py-2.5 text-sm font-black text-white shadow-[0_4px_10px_-4px_rgba(139,92,246,0.5)] transition hover:brightness-105"
        >
          <Plus className="h-4 w-4" />
          New group
        </button>
      </section>

      {groups.length > 3 && (
        <div className="relative mb-4 max-w-[480px]">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search groups by name or description..."
            className="w-full rounded-[10px] border border-slate-200 bg-white py-[11px] pl-10 pr-4 text-[13px] font-semibold text-slate-900 outline-none transition focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
          />
        </div>
      )}

      <div className="mb-3 flex items-center justify-between gap-3 text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
        <span>{query.trim() ? `${filteredGroups.length} of ${groups.length} groups` : `${groups.length} groups`}</span>
        <button
          type="button"
          onClick={() => loadGroups({ silent: true })}
          className="inline-flex items-center gap-1 text-[11px] font-black normal-case tracking-normal text-violet-600 transition hover:text-violet-800"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center rounded-2xl border border-slate-200 bg-white px-6 py-16">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center">
          <Search className="mx-auto h-8 w-8 text-slate-300" />
          <div className="mt-3 text-sm font-bold text-slate-700">No groups found</div>
          <div className="mt-1 text-sm font-semibold text-slate-500">
            Try a different search term.
          </div>
        </div>
      ) : (
        <div className="grid gap-[14px] md:grid-cols-2">
          {filteredGroups.map((group) => {
            const members = Array.isArray(group.members) ? group.members : [];
            const memberCount = Number(group.member_count) || members.length || 0;
            const lastUsedLabel = formatRelativeLabel(
              group.last_used_at || group.updated_at || group.modified_at || group.created_at,
            );

            return (
              <button
                key={group.id}
                type="button"
                onClick={() => onOpenGroup(group.id)}
                className="rounded-[14px] border border-slate-200 bg-white p-[18px] text-left shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:shadow-[0_6px_20px_-6px_rgba(15,23,42,0.12)]"
              >
                <div className="mb-[14px] flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-100 text-violet-500">
                    <Users className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-base font-bold tracking-[-0.01em] text-slate-950">
                      {group.name || "Untitled group"}
                    </div>
                    <div className="mt-0.5 truncate text-xs font-medium text-slate-500">
                      {group.description || "No description"}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center">
                    {members.slice(0, 6).map((member, index) => (
                      <div
                        key={member.id}
                        className={index === 0 ? "" : "-ml-2"}
                      >
                        <PlayerAvatar
                          name={member.name}
                          imageUrl={member.avatarUrl}
                          fallback={member.initials}
                          size="xs"
                          variant="violet"
                          showBadge={false}
                          className="border-2 border-white"
                        />
                      </div>
                    ))}
                    {memberCount > 6 && (
                      <div className="-ml-2 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold text-slate-700">
                        +{memberCount - 6}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-[11px] font-medium text-slate-500">
                    {memberCount} member{memberCount === 1 ? "" : "s"}{" "}
                    <span className="text-slate-400">· Last used {lastUsedLabel}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </main>
  );
}

export default MyGroupsPage;
