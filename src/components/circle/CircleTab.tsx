import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { addToCircle, getMyCircle, removeFromCircle, searchCircle, setCircleWeeklyEmail } from "../../api/circle";
import { forgetCircleMembership } from "../../hooks/useCircleMembership";
import { usableAvatar } from "../../utils/avatar";
import { ANALYTICS_EVENTS, track } from "../../utils/analytics";
import {
  CIRCLE_SEARCH_MIN_LENGTH,
  circleCountLabel,
  circleSearchQuery,
  memberItems,
  searchItems,
  suggestionItems,
  type CircleListItem,
  type CircleListResponse,
  type CircleSearchResponse,
} from "../../utils/circleMembers";
import "./CircleTab.css";

function CircleAvatar({ item }: { item: CircleListItem }) {
  // Tracked per row so one missing photo can't hide another.
  const [imageFailed, setImageFailed] = useState(false);
  const url = imageFailed ? null : usableAvatar(item.avatarUrl);
  return (
    <span className="circle-row__avatar" aria-hidden="true">
      {url ? <img src={url} alt="" onError={() => setImageFailed(true)} /> : <span>{item.initials}</span>}
    </span>
  );
}

/**
 * The "Circle" tab on the profile: the friends and coaches the player picked as their go-to
 * people. One-way and private, like a favourites list: only the player sees it and nobody is
 * told they were added. Home's "Your tennis circle" and the Monday email draw from it.
 */
const CircleTab = () => {
  const [data, setData] = useState<CircleListResponse | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [rowError, setRowError] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState("");
  // Adding someone by name.
  const [typed, setTyped] = useState("");
  const [search, setSearch] = useState<
    { status: "idle" } | { status: "loading" } | { status: "done"; response: CircleSearchResponse } | { status: "error" }
  >({ status: "idle" });
  const [searchAttempt, setSearchAttempt] = useState(0);

  const load = useCallback((signal?: AbortSignal) => {
    setLoadFailed(false);
    return getMyCircle({ signal })
      .then((response) => setData(response ?? {}))
      .catch(() => {
        if (!signal?.aborted) setLoadFailed(true);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const members = useMemo(() => memberItems(data), [data]);
  const memberIds = useMemo(() => new Set(members.map((member) => member.id)), [members]);
  const suggestions = useMemo(() => suggestionItems(data, memberIds), [data, memberIds]);
  const searchQuery = circleSearchQuery(typed);
  const results = useMemo(
    () => (search.status === "done" ? searchItems(search.response, memberIds) : []),
    [search, memberIds],
  );

  // Searches once typing pauses; a newer query cancels the one in flight.
  useEffect(() => {
    if (!searchQuery) {
      setSearch({ status: "idle" });
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setSearch({ status: "loading" });
      searchCircle(searchQuery, { signal: controller.signal })
        .then((response) => setSearch({ status: "done", response: response ?? {} }))
        .catch(() => {
          if (!controller.signal.aborted) setSearch({ status: "error" });
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchQuery, searchAttempt]);

  const add = async (item: CircleListItem, source: "search" | "suggestion") => {
    if (busyId !== null) return;
    setBusyId(item.id);
    setRowError("");
    try {
      const { member } = await addToCircle(item.id);
      track(ANALYTICS_EVENTS.circleAdd, { source });
      forgetCircleMembership();
      setData((current) => ({
        ...current,
        members: [member, ...(current?.members ?? []).filter((row) => Number(row.id) !== item.id)],
      }));
    } catch {
      setRowError(`Couldn't add ${item.name}. Try again.`);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item: CircleListItem) => {
    if (busyId !== null) return;
    setBusyId(item.id);
    setRowError("");
    try {
      await removeFromCircle(item.id);
      forgetCircleMembership();
      setData((current) => ({
        ...current,
        members: (current?.members ?? []).filter((row) => Number(row.id) !== item.id),
      }));
    } catch {
      setRowError(`Couldn't remove ${item.name}. Try again.`);
    } finally {
      setBusyId(null);
    }
  };

  const weeklyEmail = data?.weekly_email !== false;

  const toggleEmail = async () => {
    if (!data || emailSaving) return;
    setEmailSaving(true);
    setEmailError("");
    try {
      const result = await setCircleWeeklyEmail(!weeklyEmail);
      setData((current) => ({ ...current, weekly_email: result.weekly_email }));
    } catch {
      setEmailError("Couldn't save. Please try again.");
    } finally {
      setEmailSaving(false);
    }
  };

  if (loadFailed) {
    return (
      <div className="settings-card">
        <h2 className="settings-card__title">Your tennis circle</h2>
        <p className="settings-card__subtitle">We couldn&apos;t load your circle right now.</p>
        <button type="button" className="circle-retry" onClick={() => load()}>
          Try again
        </button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="settings-card">
        <h2 className="settings-card__title">Your tennis circle</h2>
        <p className="settings-card__subtitle">Loading…</p>
      </div>
    );
  }

  return (
    <>
      <div className="settings-card">
        <div className="circle-head">
          <h2 className="settings-card__title">Your tennis circle</h2>
          <span className="circle-head__count">{circleCountLabel(members.length)}</span>
        </div>
        <p className="settings-card__subtitle">
          Everyone you&apos;ve played is added for you, and you can add anyone else. Their open games show on
          Home. Only you can see who&apos;s in your circle.
        </p>

        <div className="circle-search">
          <label className="circle-search__field">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder="Add someone by name"
              aria-label="Add someone to your circle by name"
              autoComplete="off"
              enterKeyHint="search"
            />
          </label>
          {typed.trim() && !searchQuery ? (
            <p className="circle-search__hint">Type at least {CIRCLE_SEARCH_MIN_LENGTH} letters.</p>
          ) : null}
          {searchQuery && search.status === "loading" ? <p className="circle-search__hint">Searching…</p> : null}
          {searchQuery && search.status === "error" ? (
            <p className="circle-search__hint circle-search__hint--error" role="alert">
              Couldn&apos;t search right now.{" "}
              <button type="button" className="circle-search__retry" onClick={() => setSearchAttempt((count) => count + 1)}>
                Retry
              </button>
            </p>
          ) : null}
          {searchQuery && search.status === "done" && !results.length ? (
            <p className="circle-search__hint">No players match “{searchQuery}”.</p>
          ) : null}
          {results.length ? (
            <ul className="circle-list circle-search__results" aria-label="Players matching your search">
              {results.map((item) => (
                <li key={item.id} className="circle-row">
                  <Link to={item.href} className="circle-row__person">
                    <CircleAvatar item={item} />
                    <span className="circle-row__text">
                      <span className="circle-row__name">{item.name}</span>
                      {item.detail ? <span className="circle-row__detail">{item.detail}</span> : null}
                    </span>
                  </Link>
                  {item.inCircle ? (
                    <span className="circle-row__in">In your circle</span>
                  ) : (
                    <button
                      type="button"
                      className="circle-row__action"
                      onClick={() => add(item, "search")}
                      disabled={busyId !== null}
                      aria-label={`Add ${item.name} to your circle`}
                    >
                      {busyId === item.id ? "Adding…" : "Add"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {rowError ? (
          <p className="circle-error" role="alert">
            {rowError}
          </p>
        ) : null}

        {members.length ? (
          <ul className="circle-list">
            {members.map((item) => (
              <li key={item.id} className="circle-row">
                <Link to={item.href} className="circle-row__person">
                  <CircleAvatar item={item} />
                  <span className="circle-row__text">
                    <span className="circle-row__name">{item.name}</span>
                    {[item.reason, item.detail].filter(Boolean).length ? (
                      <span className="circle-row__detail">{[item.reason, item.detail].filter(Boolean).join(" · ")}</span>
                    ) : null}
                  </span>
                </Link>
                <button
                  type="button"
                  className="circle-row__action circle-row__action--remove"
                  onClick={() => remove(item)}
                  disabled={busyId !== null}
                  aria-label={`Remove ${item.name} from your circle`}
                >
                  {busyId === item.id ? "Removing…" : "Remove"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="circle-empty">
            Play a match and your opponents join your circle. You can also add anyone from their profile, or
            pick from the suggestions below.
          </p>
        )}

        <div className="circle-links">
          <Link to="/find-players" className="circle-link">
            Find players
          </Link>
          <Link to="/find-coaches" className="circle-link">
            Find coaches
          </Link>
        </div>
      </div>

      {suggestions.length ? (
        <div className="settings-card">
          <h2 className="settings-card__title">People you might add</h2>
          <p className="settings-card__subtitle">Your coaches.</p>
          <ul className="circle-list">
            {suggestions.map((item) => (
              <li key={item.id} className="circle-row">
                <Link to={item.href} className="circle-row__person">
                  <CircleAvatar item={item} />
                  <span className="circle-row__text">
                    <span className="circle-row__name">{item.name}</span>
                    {[item.reason, item.detail].filter(Boolean).length ? (
                      <span className="circle-row__detail">{[item.reason, item.detail].filter(Boolean).join(" · ")}</span>
                    ) : null}
                  </span>
                </Link>
                <button
                  type="button"
                  className="circle-row__action"
                  onClick={() => add(item, "suggestion")}
                  disabled={busyId !== null}
                  aria-label={`Add ${item.name} to your circle`}
                >
                  {busyId === item.id ? "Adding…" : "Add"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="settings-card">
        <div className="circle-setting">
          <div>
            <h2 className="settings-card__title" id="circle-email-label">
              Weekly circle email
            </h2>
            <p className="settings-card__subtitle" id="circle-email-help">
              {weeklyEmail
                ? "On Mondays: open games your circle is in, your coaches' classes, and your circle's results from last week. Sent only when there's something to tell you."
                : "Off. You won't get the Monday email about your circle."}
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={weeklyEmail}
            aria-labelledby="circle-email-label"
            aria-describedby="circle-email-help"
            className={`circle-switch${weeklyEmail ? " circle-switch--on" : ""}`}
            onClick={toggleEmail}
            disabled={emailSaving}
          >
            <span className="circle-switch__knob" aria-hidden="true" />
          </button>
        </div>
        {emailError ? (
          <p className="circle-error" role="alert">
            {emailError}
          </p>
        ) : null}
      </div>
    </>
  );
};

export default CircleTab;
