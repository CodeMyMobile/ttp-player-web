export function claimTokenFromSearch(search = "") {
  const params = new URLSearchParams(String(search || "").replace(/^\?/, ""));
  return (params.get("token") || "").trim();
}
