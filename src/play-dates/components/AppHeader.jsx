import React, { useMemo } from "react";
import { ChevronLeft, LogOut, Bell, Users } from "lucide-react";
import PlayerAvatar from "./PlayerAvatar";
import { getAvatarUrlFromPlayer } from "../utils/avatar";

const AppHeader = ({
  currentScreen,
  currentUser,
  showPreview,
  goToInvites,
  goToBrowse,
  goToPlayers,
  onOpenProfile,
  onLogout,
  onOpenSignIn,
  setShowPreview,
  hasUpdates = false,
}) => {
  const avatarName = currentUser?.name || "You";
  const currentUserAvatarUrl = useMemo(() => {
    if (!currentUser) return "";
    const directUrl = getAvatarUrlFromPlayer(currentUser);
    if (directUrl) {
      return directUrl;
    }
    const storedUrl =
      typeof currentUser.avatarUrl === "string"
        ? currentUser.avatarUrl.trim()
        : "";
    return storedUrl;
  }, [currentUser]);

  return (
    <div className="bg-white border-b border-gray-100 sticky top-0 z-50 backdrop-blur-lg bg-white/95">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4">
        {currentScreen === "browse" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-11 h-11 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white text-2xl">🎾</span>
              </div>
              <h1 className="text-xl font-black bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent sm:text-2xl">
                Matchplay
              </h1>
            </div>
            {currentUser ? (
              <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
                <button
                  onClick={goToPlayers}
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-gray-50"
                  aria-label="View players"
                >
                  <Users className="w-5 h-5 text-gray-600" />
                </button>
                <button
                  onClick={goToInvites}
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-gray-50"
                  aria-label="View updates"
                >
                  <Bell className="w-5 h-5 text-gray-600" />
                  {hasUpdates && (
                    <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500" />
                  )}
                  <span className="sr-only">Updates</span>
                </button>
                <button
                  onClick={onOpenProfile}
                  className="flex items-center gap-2 rounded-full px-2 py-1 transition-all hover:bg-gray-50 sm:rounded-xl sm:px-3 sm:py-2"
                >
                  <PlayerAvatar
                    name={avatarName}
                    imageUrl={currentUserAvatarUrl}
                    variant="violet"
                    size="sm"
                    className="shadow-lg"
                  />
                  <div className="hidden min-w-0 flex-col items-start sm:flex">
                    <span className="text-sm font-bold text-gray-800">
                      {currentUser.name.split(" ")[0]}
                    </span>
                    {currentUser.skillLevel && (
                      <span className="text-xs font-semibold text-gray-500">
                        NTRP {currentUser.skillLevel}
                      </span>
                    )}
                  </div>
                </button>
                <button
                  onClick={onLogout}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-gray-50 sm:hidden"
                  aria-label="Log out"
                >
                  <LogOut className="w-5 h-5 text-gray-600" />
                  <span className="sr-only">Log Out</span>
                </button>
                <button
                  onClick={onLogout}
                  className="hidden items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-gray-800 transition-all hover:bg-gray-50 sm:inline-flex"
                >
                  <LogOut className="w-5 h-5 text-gray-600" />
                  <span>Log Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenSignIn}
                className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl sm:w-auto"
              >
                Sign In
              </button>
            )}
          </div>
        ) : currentScreen === "invites" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={goToBrowse}
              className="flex items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-gray-50"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
              <span className="text-gray-700 font-bold">Back</span>
            </button>
            <h1 className="text-xl font-black text-gray-800">Updates</h1>
            {currentUser && (
              <PlayerAvatar
                name={avatarName}
                imageUrl={currentUserAvatarUrl}
                variant="violet"
                size="sm"
                className="shadow-lg"
              />
            )}
          </div>
        ) : currentScreen === "players" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={goToBrowse}
              className="flex items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-gray-50"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
              <span className="text-gray-700 font-bold">Back</span>
            </button>
            <h1 className="text-xl font-black text-gray-800">Match partners</h1>
            {currentUser && (
              <PlayerAvatar
                name={avatarName}
                imageUrl={currentUserAvatarUrl}
                variant="violet"
                size="sm"
                className="shadow-lg"
              />
            )}
          </div>
        ) : currentScreen === "groups" || currentScreen === "group-detail" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                <span className="text-2xl text-white">🎾</span>
              </div>
              <h1 className="text-xl font-black bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent sm:text-2xl">
                Matchplay
              </h1>
            </div>
            {currentUser && (
              <div className="ml-auto flex shrink-0 items-center gap-2">
                <button
                  onClick={onOpenProfile}
                  className="flex items-center gap-2 rounded-full px-2 py-1 transition-all hover:bg-gray-50 sm:rounded-xl sm:px-3 sm:py-2"
                >
                  <PlayerAvatar
                    name={avatarName}
                    imageUrl={currentUserAvatarUrl}
                    variant="violet"
                    size="sm"
                    className="shadow-lg"
                  />
                  <div className="hidden min-w-0 flex-col items-start sm:flex">
                    <span className="text-sm font-bold text-gray-800">
                      {currentUser.name.split(" ")[0]}
                    </span>
                    {currentUser.skillLevel && (
                      <span className="text-xs font-semibold text-gray-500">
                        NTRP {currentUser.skillLevel}
                      </span>
                    )}
                  </div>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => {
                if (showPreview) {
                  setShowPreview?.(false);
                } else {
                  goToBrowse();
                }
              }}
              className="flex items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-gray-50"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
              <span className="text-gray-700 font-bold">Back</span>
            </button>
            {currentUser && (
              <PlayerAvatar
                name={avatarName}
                imageUrl={currentUserAvatarUrl}
                variant="violet"
                size="sm"
                className="shadow-lg"
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AppHeader;
