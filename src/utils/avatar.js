/**
 * Whether an avatar URL is worth putting in an <img>.
 *
 * The backend sometimes returns just the bucket root ("https://….amazonaws.com/")
 * where a photo should be. That is a non-empty string, so every "url ? <img> :
 * initials" check treats it as a real picture and renders a broken image instead
 * of falling back to the initials that were already there.
 *
 * This lived in utils/homeAlerts, where only the legacy dashboard's invite cards
 * used it — so the header avatar and the home feed cards, written later, both
 * walked into the same trap. One definition now, imported everywhere.
 */
export function usableAvatar(url) {
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    const parsed = new URL(url);
    const lastSegment = parsed.pathname.split("/").filter(Boolean).pop();
    return lastSegment ? url : null;
  } catch {
    return url; // relative/non-URL string — leave as-is
  }
}
