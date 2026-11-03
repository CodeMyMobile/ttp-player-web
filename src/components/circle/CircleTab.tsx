import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { addToCircle, getMyCircle, removeFromCircle, setCircleWeeklyEmail } from "../../api/circle";
import { forgetCircleMembership } from "../../hooks/useCircleMembership";
import { usableAvatar } from "../../utils/avatar";
import {
  circleCountLabel,
  memberItems,
  suggestionItems,
  type CircleListItem,
  type CircleListResponse,
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

  const add = async (item: CircleListItem) => {
    if (busyId !== null) return;
    setBusyId(item.id);
    setRowError("");
    try {
      const { member } = await addToCircle(item.id);
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
          Your go-to players and coaches. Their open games show on Home. Only you can see who&apos;s in your
          circle.
        </p>

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
                    {item.detail ? <span className="circle-row__detail">{item.detail}</span> : null}
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
            Add the people you play with most. You can add anyone from their profile, or pick from the
            suggestions below.
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
          <p className="settings-card__subtitle">Your coaches and people you&apos;ve played with.</p>
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
                  onClick={() => add(item)}
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
