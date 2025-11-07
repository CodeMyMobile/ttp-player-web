import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Phone, Plus, Search, Trophy, User, UserPlus, Users, X } from "lucide-react";

import MainLayout from "../components/MainLayout";
import usePlayerIdentity from "../hooks/usePlayerIdentity";
import { mockPlayers } from "../data/mockPlayers";

import "./CreateMatchPage.css";
import "./CreatePrivateMatchInvitePage.css";

type InviteeType = "host" | "member" | "guest";

type Invitee = {
  id: string;
  name: string;
  avatarUrl: string | null;
  initials?: string;
  relationshipLabel: string;
  statusLabel: string;
  type: InviteeType;
};

type GuestFormState = {
  firstName: string;
  lastName: string;
  phone: string;
};

type FormatOption = {
  value: string;
  title: string;
  description: string;
  icon: JSX.Element;
};

const formatPhoneNumber = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (!digits) {
    return "";
  }
  if (digits.length < 4) {
    return `(${digits}`;
  }
  if (digits.length < 7) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const guestFormInitialState: GuestFormState = {
  firstName: "",
  lastName: "",
  phone: "",
};

const quickAddPlayers = mockPlayers.slice(0, 5);

const formatOptions: FormatOption[] = [
  {
    value: "doubles",
    title: "Doubles",
    description: "Two teams of two players.",
    icon: <Users size={22} />,
  },
  {
    value: "singles",
    title: "Singles",
    description: "One-on-one competitive play.",
    icon: <User size={22} />,
  },
  {
    value: "round-robin",
    title: "Round robin",
    description: "Rotate partners across mini-sets.",
    icon: <Trophy size={22} />,
  },
  {
    value: "dingles",
    title: "Dingles",
    description: "Rotate single players on two courts.",
    icon: <UserPlus size={22} />,
  },
  {
    value: "other",
    title: "Other",
    description: "Share your custom match setup.",
    icon: <Plus size={22} />,
  },
];

const CreatePrivateMatchInvitePage = () => {
  const navigate = useNavigate();
  const { displayName, initials: hostInitials, avatarUrl: hostAvatar } = usePlayerIdentity();

  const [invitedPlayers, setInvitedPlayers] = useState<Invitee[]>([
    {
      id: "host",
      name: displayName || "You",
      avatarUrl: hostAvatar,
      initials: hostInitials,
      relationshipLabel: "Organizer",
      statusLabel: "Confirmed",
      type: "host",
    },
    {
      id: "grant-hawkins",
      name: "Grant Hawkins",
      avatarUrl:
        "https://images.unsplash.com/photo-1619895862022-09114b41f16f?auto=format&fit=facearea&facepad=3&w=400&h=400&q=80",
      relationshipLabel: "Played recently • Active",
      statusLabel: "Pending invite",
      type: "member",
    },
  ]);

  const [searchQuery, setSearchQuery] = useState("");
  const [guestForm, setGuestForm] = useState<GuestFormState>(guestFormInitialState);
  const [format, setFormat] = useState(formatOptions[0]?.value ?? "doubles");

  const totalNeeded = 8;
  const confirmedCount = invitedPlayers.length;
  const remainingSpots = Math.max(0, totalNeeded - confirmedCount);

  const invitedIds = useMemo(() => new Set(invitedPlayers.map((player) => player.id)), [invitedPlayers]);

  const filteredPlayers = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return mockPlayers
      .filter((player) => !invitedIds.has(player.id))
      .filter((player) => player.name.toLowerCase().includes(normalizedQuery))
      .slice(0, 5)
      .map((player) => ({
        id: player.id,
        name: player.name,
        avatarUrl: player.profileImageUrl,
        relationshipLabel: `${player.lastActive} • ${player.level}`,
        statusLabel: "Invite", // placeholder status for search results
        type: "member" as InviteeType,
      }));
  }, [invitedIds, searchQuery]);

  const availableQuickAdds = useMemo(
    () =>
      quickAddPlayers
        .filter((player) => !invitedIds.has(player.id))
        .map((player) => ({
          id: player.id,
          name: player.name,
          avatarUrl: player.profileImageUrl,
          relationshipLabel: player.lastActive,
          statusLabel: "Add",
          type: "member" as InviteeType,
        })),
    [invitedIds],
  );

  const handleAddInvitee = (player: Invitee) => {
    setInvitedPlayers((previous) => {
      if (previous.some((invitee) => invitee.id === player.id)) {
        return previous;
      }
      return [
        ...previous,
        {
          ...player,
          statusLabel: player.type === "guest" ? "SMS link ready" : "Pending invite",
        },
      ];
    });
    setSearchQuery("");
  };

  const handleRemoveInvitee = (id: string) => {
    setInvitedPlayers((previous) => previous.filter((invitee) => invitee.id !== id));
  };

  const handleGuestInputChange = (field: keyof GuestFormState, value: string) => {
    setGuestForm((current) => ({
      ...current,
      [field]: field === "phone" ? formatPhoneNumber(value) : value,
    }));
  };

  const canSubmitGuest =
    guestForm.firstName.trim() &&
    guestForm.lastName.trim() &&
    guestForm.phone.replace(/\D/g, "").length === 10;

  const handleAddGuest = () => {
    if (!canSubmitGuest) {
      return;
    }
    const guestId = `guest-${Date.now()}`;
    handleAddInvitee({
      id: guestId,
      name: `${guestForm.firstName.trim()} ${guestForm.lastName.trim()}`,
      avatarUrl: null,
      initials: `${guestForm.firstName[0] ?? ""}${guestForm.lastName[0] ?? ""}`.toUpperCase(),
      relationshipLabel: "Guest via SMS",
      statusLabel: "SMS link ready",
      type: "guest",
    });
    setGuestForm(guestFormInitialState);
  };

  const handleNavigateBack = () => {
    navigate(-1);
  };

  return (
    <MainLayout>
      <div className="create-match-page">
        <div className="create-match-page__header">
          <div>
            <p className="create-match-page__eyebrow">Create a Match</p>
            <h1 className="create-match-page__title">Invite players</h1>
            <p className="create-match-page__subtitle">
              Hand-pick partners for your private match. Players you invite will receive a direct link to RSVP.
            </p>
          </div>
          <div className="create-match-page__progress" aria-label="Match creation progress">
            <div className="progress-step progress-step--complete">
              <span className="progress-step__number">
                <Check size={18} aria-hidden />
              </span>
              <span className="progress-step__label">Match details</span>
            </div>
            <div className="progress-connector" aria-hidden="true" />
            <div className="progress-step progress-step--active">
              <span className="progress-step__number">2</span>
              <span className="progress-step__label">Invite players</span>
            </div>
            <div className="progress-connector" aria-hidden="true" />
            <div className="progress-step progress-step--upcoming">
              <span className="progress-step__number">3</span>
              <span className="progress-step__label">Review &amp; publish</span>
            </div>
          </div>
        </div>

        <section className="create-match-card" aria-labelledby="invited-players-heading">
          <div className="create-match-card__header">
            <div>
              <h2 id="invited-players-heading">Invited players</h2>
              <p className="create-match-card__subtitle">Share updates with confirmed teammates and keep everyone in sync.</p>
            </div>
            <div className="invite-summary" aria-live="polite">
              <span className="invite-summary__count">{confirmedCount} invited</span>
              <span className="invite-summary__helper">{remainingSpots} spots open</span>
            </div>
          </div>

          <div className="invitee-list">
            {invitedPlayers.map((player) => (
              <div key={player.id} className="invitee-row">
                <div className="invitee-row__details">
                  <div
                    className={`invitee-avatar${player.avatarUrl ? " invitee-avatar--image" : ""}`}
                    aria-hidden="true"
                  >
                    {player.avatarUrl ? (
                      <img src={player.avatarUrl} alt="" />
                    ) : (
                      <span>{player.initials ?? player.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="invitee-row__text">
                    <span className="invitee-row__name">{player.type === "host" ? `${player.name} (Host)` : player.name}</span>
                    <span className="invitee-row__meta">{player.relationshipLabel}</span>
                  </div>
                </div>
                <div className="invitee-row__actions">
                  <span className={`invitee-status invitee-status--${player.type}`}>{player.statusLabel}</span>
                  {player.type !== "host" && (
                    <button
                      type="button"
                      className="invitee-row__remove"
                      onClick={() => handleRemoveInvitee(player.id)}
                      aria-label={`Remove ${player.name}`}
                    >
                      <X size={16} aria-hidden />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="create-match-card" aria-labelledby="add-players-heading">
          <div className="create-match-card__header">
            <div>
              <h2 id="add-players-heading">Add more players</h2>
              <p className="create-match-card__subtitle">
                Invite at least three more players to guarantee a full match. Everyone gets a personalized RSVP link.
              </p>
            </div>
            <div className="spotlight">
              <UserPlus size={18} aria-hidden />
              <span>
                {remainingSpots === 0
                  ? "Roster complete"
                  : `Need ${remainingSpots} more ${remainingSpots === 1 ? "player" : "players"}`}
              </span>
            </div>
          </div>

          <div className="invite-actions">
            <div className="invite-search">
              <label className="input-field" htmlFor="player-search">
                <span className="input-field__label">Search Matchplay players</span>
                <div className="input-wrapper">
                  <Search size={18} aria-hidden />
                  <input
                    id="player-search"
                    type="search"
                    placeholder="Search by name or username"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                  />
                </div>
              </label>

              {searchQuery && (
                <div className="invite-search__results" role="listbox" aria-label="Search results">
                  {filteredPlayers.length > 0 ? (
                    filteredPlayers.map((player) => (
                      <button
                        key={player.id}
                        type="button"
                        className="invite-result"
                        onClick={() => handleAddInvitee(player)}
                      >
                        <div className="invite-result__details">
                          <div
                            className={`invitee-avatar${player.avatarUrl ? " invitee-avatar--image" : ""}`}
                            aria-hidden="true"
                          >
                            {player.avatarUrl ? (
                              <img src={player.avatarUrl} alt="" />
                            ) : (
                              <span>{player.name.slice(0, 2).toUpperCase()}</span>
                            )}
                          </div>
                          <div className="invite-result__text">
                            <span className="invite-result__name">{player.name}</span>
                            <span className="invite-result__meta">{player.relationshipLabel}</span>
                          </div>
                        </div>
                        <span className="invite-result__action">Add</span>
                      </button>
                    ))
                  ) : (
                    <p className="invite-search__empty">No players found. Try a different name.</p>
                  )}
                </div>
              )}
            </div>

            <div className="quick-add">
              <div className="quick-add__header">
                <span>Frequent teammates</span>
                <span className="quick-add__hint">Quick add</span>
              </div>
              <div className="quick-add__list">
                {availableQuickAdds.map((player) => (
                  <button
                    key={player.id}
                    type="button"
                    className="quick-add-card"
                    onClick={() => handleAddInvitee(player)}
                  >
                    <div className="quick-add-card__profile">
                      <div
                        className={`invitee-avatar${player.avatarUrl ? " invitee-avatar--image" : ""}`}
                        aria-hidden="true"
                      >
                        {player.avatarUrl ? (
                          <img src={player.avatarUrl} alt="" />
                        ) : (
                          <span>{player.name.slice(0, 2).toUpperCase()}</span>
                        )}
                      </div>
                      <div className="quick-add-card__text">
                        <span className="quick-add-card__name">{player.name}</span>
                        <span className="quick-add-card__meta">{player.relationshipLabel}</span>
                      </div>
                    </div>
                    <span className="quick-add-card__action" aria-hidden="true">
                      <Plus size={18} />
                    </span>
                  </button>
                ))}
                {availableQuickAdds.length === 0 && <p className="quick-add__empty">Everyone is already on your list.</p>}
              </div>
            </div>
          </div>

          <div className="guest-invite" aria-labelledby="guest-invite-heading">
            <div className="guest-invite__header">
              <div>
                <h3 id="guest-invite-heading">Invite by phone number</h3>
                <p>Create a magic SMS link so players without accounts can join instantly.</p>
              </div>
            </div>
            <div className="guest-invite__form">
              <label className="input-field" htmlFor="guest-first-name">
                <span className="input-field__label">First name</span>
                <div className="input-wrapper">
                  <UserPlus size={18} aria-hidden />
                  <input
                    id="guest-first-name"
                    type="text"
                    placeholder="e.g. Jordan"
                    value={guestForm.firstName}
                    onChange={(event) => handleGuestInputChange("firstName", event.target.value)}
                  />
                </div>
              </label>
              <label className="input-field" htmlFor="guest-last-name">
                <span className="input-field__label">Last name</span>
                <div className="input-wrapper">
                  <UserPlus size={18} aria-hidden />
                  <input
                    id="guest-last-name"
                    type="text"
                    placeholder="e.g. Rivers"
                    value={guestForm.lastName}
                    onChange={(event) => handleGuestInputChange("lastName", event.target.value)}
                  />
                </div>
              </label>
              <label className="input-field" htmlFor="guest-phone">
                <span className="input-field__label">SMS phone number</span>
                <div className="input-wrapper">
                  <Phone size={18} aria-hidden />
                  <input
                    id="guest-phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={guestForm.phone}
                    onChange={(event) => handleGuestInputChange("phone", event.target.value)}
                  />
                </div>
              </label>
            </div>
            <div className="guest-invite__footer">
              <p>New players will receive an SMS invite instantly.</p>
              <button
                type="button"
                className="guest-invite__submit"
                onClick={handleAddGuest}
                disabled={!canSubmitGuest}
              >
                Send invite
              </button>
            </div>
          </div>
        </section>

        <section className="create-match-card" aria-labelledby="format-heading">
          <h2 id="format-heading">Match format</h2>
          <p className="create-match-card__subtitle">Let teammates know what to expect so they can prepare.</p>
          <div className="match-format-options" role="radiogroup" aria-label="Match format">
            {formatOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`match-type-card${format === option.value ? " match-type-card--active" : ""}`}
                onClick={() => setFormat(option.value)}
                aria-pressed={format === option.value}
              >
                <div className="match-type-card__icon" aria-hidden="true">
                  {option.icon}
                </div>
                <div className="match-type-card__content">
                  <span className="match-type-card__title">{option.title}</span>
                  <span className="match-type-card__description">{option.description}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="create-match-card" aria-labelledby="notes-heading">
          <div className="create-match-card__header">
            <div>
              <h2 id="notes-heading">Additional notes</h2>
              <p className="create-match-card__subtitle">Share parking tips or what to bring so everyone arrives ready.</p>
            </div>
          </div>
          <div className="input-field">
            <label className="input-field__label" htmlFor="additional-notes">
              Message to invited players
            </label>
            <div className="textarea-wrapper">
              <textarea
                id="additional-notes"
                placeholder="Bring a new can of balls and arrive 10 minutes early."
                defaultValue="Bring a new can of balls and arrive 10 minutes early."
              />
            </div>
          </div>
        </section>

        <div className="create-match-actions">
          <button type="button" className="create-match-actions__secondary" onClick={handleNavigateBack}>
            Back
          </button>
          <button
            type="button"
            className="create-match-actions__primary"
            onClick={() => navigate("/matches/create/review")}
          >
            Next
          </button>
        </div>
      </div>
    </MainLayout>
  );
};

export default CreatePrivateMatchInvitePage;
