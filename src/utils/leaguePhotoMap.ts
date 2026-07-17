// Pure, dependency-free league→photo-slot mapping. Kept separate from leaguePhoto.ts (which
// imports the image assets) so it can be unit-tested under node without resolving .svg modules.

// FNV-ish stable string hash (deterministic; no Math.random) so a league's photo never shifts.
const hashString = (value: string): number => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
};

// Which pool slot a league maps to. Stable per league id across renders/sessions.
export const leaguePhotoIndex = (leagueId: number | string, poolSize: number): number => {
  if (poolSize <= 0) return 0;
  return hashString(String(leagueId)) % poolSize;
};
