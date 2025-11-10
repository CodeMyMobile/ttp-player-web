import { request } from "../api/http";

export type LocationSuggestion = {
  id: string;
  label: string;
  coords: { lat: number; lng: number } | null;
};

interface GeoJsonGeometry {
  coordinates?: [number, number] | number[];
}

interface GeoJsonProperties {
  id?: string | number;
  label?: string;
  name?: string;
  title?: string;
  city?: string;
  state?: string;
  state_code?: string;
  stateCode?: string;
  country?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  [key: string]: unknown;
}

interface GeoJsonFeature {
  id?: string | number;
  label?: string;
  name?: string;
  title?: string;
  properties?: GeoJsonProperties;
  geometry?: GeoJsonGeometry;
  [key: string]: unknown;
}

interface LocationSearchResponse {
  features?: GeoJsonFeature[];
  data?: GeoJsonFeature[];
  results?: GeoJsonFeature[];
  items?: GeoJsonFeature[];
  [key: string]: unknown;
}

const pickFeatures = (payload: LocationSearchResponse): GeoJsonFeature[] => {
  if (Array.isArray(payload?.features) && payload.features.length) {
    return payload.features as GeoJsonFeature[];
  }
  if (Array.isArray(payload?.data) && payload.data.length) {
    return payload.data as GeoJsonFeature[];
  }
  if (Array.isArray(payload?.results) && payload.results.length) {
    return payload.results as GeoJsonFeature[];
  }
  if (Array.isArray(payload?.items) && payload.items.length) {
    return payload.items as GeoJsonFeature[];
  }
  return [];
};

const normalizeLabel = (feature: GeoJsonFeature, properties: GeoJsonProperties): string => {
  const label =
    properties.label ??
    properties.title ??
    properties.name ??
    feature.label ??
    feature.title ??
    feature.name;

  if (typeof label === "string" && label.trim().length > 0) {
    return label.trim();
  }

  const parts = [properties.city, properties.state_code ?? properties.stateCode ?? properties.state, properties.country]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);

  if (parts.length > 0) {
    return parts.join(", ");
  }

  return "";
};

const normalizeCoordinates = (feature: GeoJsonFeature, properties: GeoJsonProperties) => {
  const latitude =
    typeof properties.latitude === "number"
      ? properties.latitude
      : Array.isArray(feature.geometry?.coordinates) && typeof feature.geometry.coordinates[1] === "number"
        ? feature.geometry.coordinates[1]
        : null;
  const longitude =
    typeof properties.longitude === "number"
      ? properties.longitude
      : Array.isArray(feature.geometry?.coordinates) && typeof feature.geometry.coordinates[0] === "number"
        ? feature.geometry.coordinates[0]
        : null;

  if (latitude === null || longitude === null) {
    return null;
  }

  return { lat: latitude, lng: longitude } as const;
};

const parseFeature = (feature: GeoJsonFeature): LocationSuggestion | null => {
  const properties: GeoJsonProperties = typeof feature.properties === "object" && feature.properties !== null
    ? feature.properties
    : {};

  const label = normalizeLabel(feature, properties);
  if (!label) {
    return null;
  }

  const idSource = properties.id ?? feature.id ?? label;
  if (idSource === undefined || idSource === null) {
    return null;
  }

  const coords = normalizeCoordinates(feature, properties);

  return {
    id: String(idSource),
    label,
    coords,
  };
};

export interface SearchLocationsParams {
  search: string;
  limit?: number;
  signal?: AbortSignal;
  token?: string;
}

export const searchLocations = async ({
  search,
  limit,
  signal,
  token,
}: SearchLocationsParams): Promise<LocationSuggestion[]> => {
  const trimmed = search.trim();
  if (!trimmed) {
    return [];
  }

  const query: Record<string, string> = { search: trimmed };
  if (typeof limit === "number" && Number.isFinite(limit)) {
    query.perPage = String(limit);
  }

  const response = await request<LocationSearchResponse>("/player/locations-geojson", {
    query,
    signal,
    ...(token ? { token } : {}),
  });

  return pickFeatures(response)
    .map((feature) => parseFeature(feature))
    .filter((suggestion): suggestion is LocationSuggestion => Boolean(suggestion));
};
