import type { LeagueStanding } from "../../api/leagues";

// The standings picture for the league's WhatsApp group (§6.6), drawn in the browser on a canvas:
// no server image generation. Up to ten rows; a viewer below the tenth keeps their own row in place
// of the last one, so everyone who shares sees themselves.

export interface ImageRow {
  rank: number;
  name: string;
  record: string;
  you: boolean;
}

export const IMAGE_MAX_ROWS = 10;

export const standingsImageRows = (
  standings: LeagueStanding[],
  viewerId: number | string | null,
  max = IMAGE_MAX_ROWS,
): ImageRow[] => {
  const toRow = (row: LeagueStanding): ImageRow => ({
    rank: Number(row.rank),
    name: String(row.full_name || "Player"),
    record: `${Number(row.wins || 0)}–${Number(row.losses || 0)}`,
    you: viewerId != null && String(row.player_id) === String(viewerId),
  });
  const sorted = [...standings].sort((a, b) => Number(a.rank) - Number(b.rank));
  const top = sorted.slice(0, max).map(toRow);
  const viewer = sorted.find((row) => viewerId != null && String(row.player_id) === String(viewerId));
  if (viewer && !top.some((row) => row.you)) top[top.length - 1] = toRow(viewer);
  return top;
};

const WIDTH = 1080;
const ROW = 92;
const TOP = 230;
const BOTTOM = 120;

/** Draws the picture and returns it as a PNG. Browser only. */
export const drawStandingsImage = async ({
  leagueName,
  rows,
  subtitle,
}: {
  leagueName: string;
  rows: ImageRow[];
  subtitle: string;
}): Promise<Blob> => {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = TOP + rows.length * ROW + BOTTOM;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  const font = (weight: number, size: number) => `${weight} ${size}px Inter, system-ui, -apple-system, sans-serif`;

  ctx.fillStyle = "#f5f6fa";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#6d28d9";
  ctx.fillRect(0, 0, WIDTH, 16);

  ctx.fillStyle = "#0f172a";
  ctx.font = font(800, 60);
  ctx.fillText(leagueName.slice(0, 30), 64, 116);
  ctx.fillStyle = "#475569";
  ctx.font = font(500, 34);
  ctx.fillText(subtitle, 64, 170);

  rows.forEach((row, index) => {
    const y = TOP + index * ROW;
    if (row.you) {
      ctx.fillStyle = "#ede9fe";
      ctx.fillRect(40, y, WIDTH - 80, ROW - 8);
    }
    ctx.fillStyle = row.you ? "#6d28d9" : "#475569";
    ctx.font = font(800, 40);
    ctx.fillText(String(row.rank), 72, y + 58);
    ctx.fillStyle = "#0f172a";
    ctx.font = font(row.you ? 800 : 600, 40);
    ctx.fillText(row.name.length > 26 ? `${row.name.slice(0, 25)}…` : row.name, 160, y + 58);
    ctx.fillStyle = "#475569";
    ctx.font = font(700, 40);
    ctx.textAlign = "right";
    ctx.fillText(row.record, WIDTH - 72, y + 58);
    ctx.textAlign = "left";
  });

  ctx.fillStyle = "#475569";
  ctx.font = font(600, 30);
  ctx.fillText("The Tennis Plan", 64, canvas.height - 56);

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("image_failed"))), "image/png"),
  );
};

/**
 * Shares the picture where the browser can share files (phones, to WhatsApp and the rest), or
 * downloads it. "cancelled" when the person closed the share sheet.
 */
export const shareStandingsImage = async (blob: Blob, leagueName: string): Promise<"shared" | "downloaded" | "cancelled"> => {
  const file = new File([blob], "standings.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: `${leagueName} standings` });
      return "shared";
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "standings.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return "downloaded";
};
