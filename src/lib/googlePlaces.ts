const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY as string | undefined;

let placesScriptPromise: Promise<void> | null = null;

const hasPlacesLibrary = () =>
  typeof window !== "undefined" && Boolean((window as Window & { google?: { maps?: { places?: unknown } } }).google?.maps?.places);

export const loadGooglePlacesLibrary = async () => {
  if (typeof window === "undefined") {
    throw new Error("Window is not available.");
  }

  if (hasPlacesLibrary()) {
    return;
  }

  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("Missing Google Places API key.");
  }

  if (!placesScriptPromise) {
    placesScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_PLACES_API_KEY}&libraries=places&loading=async`;
      script.async = true;
      script.onerror = () => {
        script.remove();
        placesScriptPromise = null;
        reject(new Error("Failed to load Google Places script."));
      };
      script.onload = () => {
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  await placesScriptPromise;

  if (!hasPlacesLibrary()) {
    throw new Error("Google Places library failed to initialize.");
  }
};

export const getGoogleMaps = () =>
  (typeof window !== "undefined"
    ? ((window as Window & { google?: { maps?: unknown } }).google?.maps as Record<string, unknown> | undefined)
    : undefined);

export const isPlacesLibraryAvailable = () => hasPlacesLibrary();

export type GoogleMapsNamespace = ReturnType<typeof getGoogleMaps>;
