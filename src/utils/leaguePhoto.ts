import court1 from "../assets/leagues/court-1.svg";
import court2 from "../assets/leagues/court-2.svg";
import court3 from "../assets/leagues/court-3.svg";
import court4 from "../assets/leagues/court-4.svg";
import { leaguePhotoIndex } from "./leaguePhotoMap";

// Static curated photo per league, chosen deterministically client-side (league responses carry
// no image field — see docs/ui-feasibility-audit.md item 36). These stylized-court SVGs are
// placeholders to be swapped for supplied photography by replacing the files in
// src/assets/leagues/ (this pool is the swap point). Selection is stable per league id.
const LEAGUE_PHOTOS: string[] = [court1, court2, court3, court4];

export const LEAGUE_PHOTO_POOL_SIZE = LEAGUE_PHOTOS.length;

export { leaguePhotoIndex };

export const leaguePhoto = (league: { id: number | string }): string =>
  LEAGUE_PHOTOS[leaguePhotoIndex(league.id, LEAGUE_PHOTOS.length)];
