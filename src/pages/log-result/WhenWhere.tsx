import { useState } from "react";
import Autocomplete from "react-google-autocomplete";
import { CalendarDays, MapPin, Search, X } from "lucide-react";
import { SectionLabel, Chip } from "./ui";
import { TODAY, YESTERDAY } from "./scoring";
import type { Court } from "./scoring";
import { createCourt } from "./data";

interface WhenWhereProps {
  date: string;
  onDateChange: (date: string) => void;
  court: Court | null;
  onCourtChange: (court: Court | null) => void;
  courts: Court[];
}

const numberOrNull = (value: unknown): number | null => (
  typeof value === "number" && Number.isFinite(value) ? value : null
);

const compactAddress = (value: string): string => value.split(",").slice(0, 3).join(",").trim();

const courtFromPlace = (place: google.maps.places.PlaceResult | null, fallback: string) => {
  const label = place?.formatted_address || place?.name || fallback.trim();
  const parts = label.split(",").map((part) => part.trim()).filter(Boolean);
  const name = (place?.name || parts[0] || fallback.trim()).trim();
  const area = compactAddress(
    parts[0] === name ? parts.slice(1).join(", ") : parts.join(", "),
  ) || "Custom location";
  const latitude = numberOrNull(place?.geometry?.location?.lat?.());
  const longitude = numberOrNull(place?.geometry?.location?.lng?.());

  return { name, area, latitude, longitude };
};

// Date defaults to today (Today/Yesterday shortcuts + native picker, capped at today).
// Court is REQUIRED — created from saved courts or a Google/manual place.
export function WhenWhere({ date, onDateChange, court, onCourtChange, courts }: WhenWhereProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [customLocation, setCustomLocation] = useState("");
  const [savingLocation, setSavingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const filtered = courts.filter((c) => (c.name + c.area).toLowerCase().includes(query.toLowerCase()));

  const saveCustomCourt = async (place: google.maps.places.PlaceResult | null = null) => {
    const fallback = customLocation.trim();
    const next = courtFromPlace(place, fallback);
    if (!next.name) return;

    setSavingLocation(true);
    setLocationError(null);
    try {
      const response = await createCourt(next);
      onCourtChange(response.court);
      setOpen(false);
      setQuery("");
      setCustomLocation("");
    } catch (error) {
      const apiErrors = (error as { data?: { errors?: string[] } })?.data?.errors;
      setLocationError(
        Array.isArray(apiErrors) && apiErrors.length
          ? apiErrors.join(", ")
          : error instanceof Error
            ? error.message
            : "Could not add court location.",
      );
    } finally {
      setSavingLocation(false);
    }
  };

  return (
    <div>
      <SectionLabel icon={CalendarDays}>When &amp; where</SectionLabel>

      <div className="flex items-center gap-2 flex-wrap">
        <Chip active={date === TODAY} onClick={() => onDateChange(TODAY)}>Today</Chip>
        <Chip active={date === YESTERDAY} onClick={() => onDateChange(YESTERDAY)}>Yesterday</Chip>
        <input type="date" max={TODAY} value={date} onChange={(e) => onDateChange(e.target.value || TODAY)} className="ml-auto rounded-lg border border-slate-200 px-2.5 py-1.5 text-base sm:text-sm font-semibold text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40" />
      </div>

      <div className="mt-2">
        {court ? (
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 grid place-items-center shrink-0 shadow-sm shadow-violet-600/30">
              <MapPin className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-900 truncate">{court.name}</div>
              <div className="text-xs text-slate-500 truncate">{court.area}</div>
            </div>
            <button onClick={() => onCourtChange(null)} className="grid h-8 w-8 place-items-center text-slate-300 hover:text-rose-500 transition-colors" aria-label="Change court"><X className="h-4 w-4" /></button>
          </div>
        ) : (
          <button onClick={() => setOpen((o) => !o)} className="w-full rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/40 px-3 py-2.5 flex items-center gap-2 text-sm font-semibold text-violet-600 hover:border-violet-400 hover:bg-violet-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/40">
            <MapPin className="h-4 w-4 shrink-0" /> Choose a court
          </button>
        )}

        {open && !court && (
          <div className="mt-2 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60 overflow-hidden">
            <div className="border-b border-slate-100 p-3">
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Add court location</label>
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus-within:ring-2 focus-within:ring-violet-500/30">
                <MapPin className="h-4 w-4 shrink-0 text-violet-500" />
                <Autocomplete
                  apiKey={import.meta.env.VITE_GOOGLE_API_KEY || undefined}
                  placeholder="Search Google places"
                  value={customLocation}
                  onChange={(event) => setCustomLocation((event.target as HTMLInputElement).value)}
                  onPlaceSelected={(place: google.maps.places.PlaceResult | null) => {
                    void saveCustomCourt(place);
                  }}
                  options={{ types: ["geocode", "establishment"], componentRestrictions: { country: "us" } }}
                  className="w-full bg-transparent text-base sm:text-sm font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
              <button
                type="button"
                disabled={!customLocation.trim() || savingLocation}
                onClick={() => { void saveCustomCourt(); }}
                className="mt-2 w-full rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700 transition-colors hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {savingLocation ? "Adding location..." : "Use this location"}
              </button>
              {locationError ? (
                <p className="mt-2 text-xs font-semibold text-rose-600">{locationError}</p>
              ) : !import.meta.env.VITE_GOOGLE_API_KEY ? (
                <p className="mt-2 text-xs text-slate-400">Add VITE_GOOGLE_API_KEY to enable suggestions.</p>
              ) : null}
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-100">
              <Search className="h-4 w-4 text-slate-400" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search courts" className="w-full text-base sm:text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none" />
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-600"><X className="h-4 w-4" /></button>
            </div>
            <ul className="max-h-56 overflow-y-auto py-1">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button onClick={() => { onCourtChange(c); setOpen(false); setQuery(""); }} className="w-full flex items-center gap-3 px-3 py-3 hover:bg-violet-50/60 transition-colors text-left">
                    <div className="h-8 w-8 rounded-lg bg-violet-100 grid place-items-center shrink-0"><MapPin className="h-4 w-4 text-violet-600" /></div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900 truncate">{c.name}</div>
                      <div className="text-xs text-slate-500">{c.area}</div>
                    </div>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">No courts match “{query}”.</li>}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
