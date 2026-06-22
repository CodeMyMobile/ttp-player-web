import React from "react";
import { ArrowLeft, Lock, MapPin, Search } from "lucide-react";
import Autocomplete from "react-google-autocomplete";

// Location picker sub-screen. Reuses react-google-autocomplete (same library and
// options as the legacy flow) plus the shared recent-locations list. Calls
// onSave({ label, latitude, longitude }).
function LocationPicker({ recentLocations = [], onSave, onCancel }) {
  const handlePlace = (place) => {
    const placeName =
      typeof place?.name === "string" ? place.name.trim() : "";
    const formattedAddress =
      typeof place?.formatted_address === "string"
        ? place.formatted_address.trim()
        : "";
    const label = placeName || formattedAddress;
    if (!label) return;
    const lat = place.geometry?.location?.lat?.();
    const lng = place.geometry?.location?.lng?.();
    onSave({
      label,
      latitude: typeof lat === "number" ? lat : null,
      longitude: typeof lng === "number" ? lng : null,
    });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-slate-100 px-5 pb-3 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600"
          aria-label="Back"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[11.5px] font-extrabold uppercase tracking-[0.08em] text-violet-700">
            Match · location
          </div>
          <div className="text-[23px] font-extrabold tracking-tight text-slate-900">
            Where?
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="mb-3 flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-100 px-3.5 py-3">
          <Search size={18} className="flex-shrink-0 text-slate-400" />
          <Autocomplete
            apiKey={import.meta.env.VITE_GOOGLE_API_KEY}
            onPlaceSelected={handlePlace}
            options={{
              types: ["establishment"],
              fields: ["formatted_address", "geometry", "name"],
            }}
            className="min-w-0 flex-1 bg-transparent text-[14.5px] font-semibold text-slate-900 outline-none"
            placeholder="Search courts, parks, clubs…"
          />
        </div>
        <div className="mb-4 flex items-center gap-1.5 text-[12px] font-semibold text-slate-500">
          <Lock size={13} />
          Players see the exact address after joining
        </div>

        {recentLocations.length > 0 && (
          <>
            <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-slate-500">
              Recent locations
            </div>
            {recentLocations.map((entry) => (
              <button
                key={entry.label}
                type="button"
                onClick={() =>
                  onSave({
                    label: entry.label,
                    latitude:
                      typeof entry.latitude === "number" ? entry.latitude : null,
                    longitude:
                      typeof entry.longitude === "number"
                        ? entry.longitude
                        : null,
                  })
                }
                className="flex w-full items-center gap-3 border-b border-slate-100 py-3 text-left"
              >
                <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-[10px] bg-violet-50 text-violet-700">
                  <MapPin size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold text-slate-900">
                    {entry.label}
                  </span>
                </span>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default LocationPicker;
