import React, { useEffect, useMemo } from "react";
import MatchDetailsModal from "../components/MatchDetailsModal.jsx";

const previewMatch = {
  id: "preview-match",
  host_id: "host-1",
  host_name: "Avery Morgan",
  start_date_time: new Date("2025-01-18T09:00:00-08:00").toISOString(),
  location_text: "Penmar Recreation Center",
  map_url:
    "https://www.google.com/maps/place/Penmar+Recreation+Center/@34.001757,-118.457157,17z/",
  match_format: "Singles • Best of 3",
  skill_level_min: "3.0",
  skill_level_max: "3.5",
  notes: "Bring a can of balls and arrive 10 minutes early for warmups.",
  distance_miles: 2.4,
  player_limit: 4,
  status: "upcoming",
  match_type: "open",
  joined_player_id: "player-42",
};

const previewParticipants = [
  {
    id: "participant-host",
    player_id: "host-1",
    status: "confirmed",
    profile: {
      full_name: "Avery Morgan",
      avatar_url: "https://i.pravatar.cc/120?img=5",
      profile_url: "https://matchplay.app/players/1001",
      usta_rating: "4.0",
    },
  },
  {
    id: "participant-guest",
    player_id: "player-42",
    status: "confirmed",
    profile: {
      full_name: "Jordan Lee",
      avatar_url: "https://i.pravatar.cc/120?img=12",
      profile_url: "https://matchplay.app/players/2042",
      usta_rating: "3.5",
    },
  },
];

const previewMatchData = {
  match: {
    ...previewMatch,
    capacity: {
      confirmed: 2,
      limit: 4,
      open: 2,
      isFull: false,
    },
  },
  participants: previewParticipants,
};

const previewUser = {
  id: "player-42",
  full_name: "Jordan Lee",
  email: "jordan@example.com",
};

const previewShareLinkResponse = JSON.stringify({
  shareUrl: "https://matchplay.app/m/preview-match",
});

const MatchSuccessPreview = () => {
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    [],
  );

  useEffect(() => {
    const originalFetch = window.fetch;
    const buildResponse = () =>
      new Response(previewShareLinkResponse, {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      });

    window.fetch = async (input, init) => {
      try {
        const targetUrl =
          typeof input === "string"
            ? input
            : input instanceof Request
            ? input.url
            : "";
        if (targetUrl.includes("/matches/preview-match/share-link")) {
          return buildResponse();
        }
      } catch (error) {
        console.warn("Preview fetch interceptor error", error);
      }
      return originalFetch ? originalFetch(input, init) : Promise.reject();
    };

    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <MatchDetailsModal
        isOpen
        matchData={previewMatchData}
        currentUser={previewUser}
        onClose={() => {}}
        onToast={() => {}}
        formatDateTime={(date) => dateFormatter.format(date)}
        initialStatus="success"
      />
    </div>
  );
};

export default MatchSuccessPreview;
