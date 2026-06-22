export const hasViewerJoinedInvitePreview = (preview, hasSession) => {
  if (!hasSession || !preview) {
    return false;
  }
  if (preview.is_participant === true || preview.isParticipant === true) {
    return true;
  }
  const viewerStatus = String(preview.viewer_status ?? preview.viewerStatus ?? "").toLowerCase();
  return viewerStatus === "joined";
};

