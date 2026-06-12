import { useState } from "react";
import { ShieldAlert, ShieldX, UserMinus } from "lucide-react";
import MainLayout from "../components/MainLayout";

import "./PlayerSettingsPages.css";

interface BlockedUser {
  id: string;
  name: string;
  reason: string;
  blockedOn: string;
  avatarColor: string;
}

const initialBlockedUsers: BlockedUser[] = [
  {
    id: "blocked-1",
    name: "Jamie Wright",
    reason: "Repeated no-shows",
    blockedOn: "March 4, 2024",
    avatarColor: "linear-gradient(135deg, #34d399, #10b981)",
  },
  {
    id: "blocked-2",
    name: "Taylor Morgan",
    reason: "Unsportsmanlike conduct",
    blockedOn: "February 20, 2024",
    avatarColor: "linear-gradient(135deg, #c084fc, var(--color-primary))",
  },
];

const BlockedUsersPage = () => {
  const [blockedUsers, setBlockedUsers] = useState(initialBlockedUsers);
  const [restoredUsers, setRestoredUsers] = useState<string[]>([]);

  const unblockUser = (id: string) => {
    setBlockedUsers((current) => current.filter((user) => user.id !== id));
    setRestoredUsers((current) => [...current, id]);
  };

  return (
    <MainLayout>
      <div className="settings-page">
        <div className="settings-page__inner">
          <header className="settings-hero settings-hero--safety">
            <span className="settings-hero__badge">
              <ShieldAlert size={16} aria-hidden="true" />
              Safety controls
            </span>
            <h1 className="settings-hero__title">Blocked users</h1>
            <p className="settings-hero__subtitle">
              Review players you&apos;ve blocked from messaging or joining matches with you.
            </p>
          </header>

          {restoredUsers.length > 0 ? (
            <div className="blocked-banner">
              You unblocked {restoredUsers.length === 1 ? "a player" : `${restoredUsers.length} players`} today. They will now be
              able to view your match availability again.
            </div>
          ) : null}

          <section className="settings-section">
            <div className="blocked-list">
              {blockedUsers.length === 0 ? (
                <div className="blocked-list__empty">
                  <ShieldX className="blocked-list__icon" aria-hidden="true" />
                  <h2 className="settings-card__title">You haven&apos;t blocked anyone</h2>
                  <p className="settings-card__subtitle">
                    Players you remove from this list can once again invite you to matches and send messages.
                  </p>
                </div>
              ) : (
                blockedUsers.map((user) => (
                  <article key={user.id} className="blocked-card">
                    <div className="blocked-card__profile">
                      <div className="blocked-card__avatar" style={{ background: user.avatarColor }}>
                        {user.name
                          .split(" ")
                          .map((segment) => segment[0] ?? "")
                          .join("")}
                      </div>
                      <div>
                        <p className="blocked-card__name">{user.name}</p>
                        <p className="blocked-card__reason">{user.reason}</p>
                        <p className="blocked-card__meta">Blocked {user.blockedOn}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => unblockUser(user.id)}
                      className="blocked-card__button"
                    >
                      <UserMinus size={16} aria-hidden="true" />
                      Unblock player
                    </button>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </MainLayout>
  );
};

export default BlockedUsersPage;
