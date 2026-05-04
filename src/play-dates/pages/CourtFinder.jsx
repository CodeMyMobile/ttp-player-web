import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "./CourtFinder.css";

const BASE_COURTS = [
  {
    id: 1,
    name: "Cheviot Hills Tennis Center",
    location: "West LA",
    address: "2551 Motor Ave, LA 90064",
    courts: 14,
    type: "bookable",
    fee: "$8-12/hour",
    features: ["Night Lights", "Pro Shop", "Practice Wall", "Parking"],
    hasBooking: true,
    bookingUrl:
      "https://www.laparks.org/discover-activities?reserve=true&location=Cheviot%20Hills%20Pay%20Tennis",
    coordinates: { lat: 34.0377, lng: -118.4258 },
    nextAvailable: ["3:00 PM", "3:30 PM", "4:00 PM", "5:30 PM"],
    phone: "(310) 836-8879",
  },
  {
    id: 2,
    name: "Reed Park",
    location: "Santa Monica",
    address: "1133 7th St, Santa Monica 90403",
    courts: 6,
    type: "bookable",
    fee: "$8-12/hour",
    features: ["Night Lights", "Parking"],
    hasBooking: true,
    bookingUrl:
      "https://anc.apm.activecommunities.com/santamonicarecreation/reservation/findreservation",
    coordinates: { lat: 34.0194, lng: -118.4973 },
    nextAvailable: ["4:30 PM", "6:00 PM", "8:00 PM"],
    phone: "(310) 394-6011",
  },
  {
    id: 3,
    name: "Mar Vista Recreation Center",
    location: "Venice/Mar Vista",
    address: "11430 Woodbine Ave, LA 90066",
    courts: 6,
    type: "free",
    fee: "Free",
    features: ["Night Lights", "Parking"],
    hasBooking: false,
    coordinates: { lat: 34.0194, lng: -118.4512 },
    phone: "(310) 398-5982",
    nearbyZips: ["90066", "90064", "90034"],
  },
  {
    id: 4,
    name: "Griffith Park Tennis Courts",
    location: "Hollywood",
    address: "4730 Crystal Springs Dr, LA 90027",
    courts: 12,
    type: "bookable",
    fee: "$8-10/hour",
    features: ["Mountain Views", "Night Lights", "Parking"],
    hasBooking: true,
    bookingUrl:
      "https://www.laparks.org/discover-activities?reserve=true&location=Griffith%20Park%20Tennis%20Courts",
    coordinates: { lat: 34.1364, lng: -118.2941 },
    nextAvailable: ["7:30 PM"],
    phone: "(323) 661-5318",
  },
  {
    id: 5,
    name: "Manhattan Beach Courts",
    location: "Beach Cities",
    address: "1550 Oak Ave, Manhattan Beach 90266",
    courts: 6,
    type: "bookable",
    fee: "$12-15/hour",
    features: ["Ocean Breeze", "Night Lights"],
    hasBooking: true,
    bookingUrl: "https://www.citymb.info/departments/parks-and-recreation/recreation-division/tennis",
    coordinates: { lat: 33.8856, lng: -118.4089 },
    nextAvailable: ["Now", "3:00 PM", "4:00 PM", "5:00 PM"],
    phone: "(310) 802-5448",
  },
  {
    id: 6,
    name: "Balboa Sports Complex",
    location: "San Fernando Valley",
    address: "17015 Burbank Blvd, Encino 91316",
    courts: 16,
    type: "bookable",
    fee: "$8-10/hour",
    features: ["Championship Courts", "Pro Shop", "Night Lights"],
    hasBooking: true,
    bookingUrl:
      "https://www.laparks.org/discover-activities?reserve=true&location=Balboa%20Sports%20Complex%20Tennis%20Courts",
    coordinates: { lat: 34.1591, lng: -118.495 },
    nextAvailable: ["3:00 PM", "4:30 PM", "6:00 PM", "7:00 PM"],
    phone: "(818) 756-8891",
  },
  {
    id: 7,
    name: "Plummer Park",
    location: "West Hollywood",
    address: "1200 N Vista St, West Hollywood 90046",
    courts: 7,
    type: "bookable",
    fee: "$8/hour",
    features: ["Night Lights", "Pro Shop", "Parking"],
    hasBooking: true,
    bookingUrl: "https://www.weho.org/services/recreation-services/tennis-reservations",
    coordinates: { lat: 34.0969, lng: -118.3642 },
    nextAvailable: ["Now", "5:00 PM", "7:30 PM"],
    phone: "(323) 380-7088",
  },
  {
    id: 8,
    name: "Veterans Memorial Park",
    location: "Culver City",
    address: "4117 Overland Ave, Culver City 90230",
    courts: 2,
    type: "free",
    fee: "Free",
    features: ["Night Lights", "Practice Wall", "Parking"],
    hasBooking: false,
    coordinates: { lat: 34.0244, lng: -118.4091 },
    phone: "(310) 253-6470",
  },
  {
    id: 9,
    name: "Roxbury Park",
    location: "Beverly Hills",
    address: "471 S Roxbury Dr, Beverly Hills 90212",
    courts: 6,
    type: "bookable",
    fee: "$12-15/hour",
    features: ["Night Lights", "Parking"],
    hasBooking: true,
    bookingUrl:
      "https://www.beverlyhills.org/departments/communitydevelopment/recreationandparks/facilitiesandparks/roxburypark/",
    coordinates: { lat: 34.0619, lng: -118.4078 },
    nextAvailable: ["4:00 PM", "5:30 PM"],
    phone: "(310) 285-2537",
  },
  {
    id: 10,
    name: "Stoner Recreation Center",
    location: "West LA",
    address: "1835 Stoner Ave, LA 90025",
    courts: 6,
    type: "free",
    fee: "Free",
    features: ["Night Lights", "Parking"],
    hasBooking: false,
    coordinates: { lat: 34.0405, lng: -118.4681 },
    phone: "(310) 479-7200",
  },
  {
    id: 11,
    name: "Westwood Recreation Center",
    location: "West LA",
    address: "1350 S Sepulveda Blvd, LA 90025",
    courts: 8,
    type: "free",
    fee: "Free",
    features: ["Night Lights", "Parking", "Pool"],
    hasBooking: false,
    coordinates: { lat: 34.0522, lng: -118.4653 },
    phone: "(310) 473-3610",
  },
  {
    id: 12,
    name: "Van Nuys Sherman Oaks Park",
    location: "San Fernando Valley",
    address: "14201 Huston St, Sherman Oaks 91423",
    courts: 8,
    type: "bookable",
    fee: "$6-8/hour",
    features: ["Night Lights", "Practice Wall", "Parking"],
    hasBooking: true,
    bookingUrl:
      "https://www.laparks.org/discover-activities?reserve=true&location=Van%20Nuys%20Sherman%20Oaks%20Tennis%20Courts",
    coordinates: { lat: 34.1581, lng: -118.4394 },
    nextAvailable: ["5:00 PM", "6:30 PM"],
    phone: "(818) 783-5121",
  },
  {
    id: 13,
    name: "Penmar Recreation Center",
    location: "Venice/Mar Vista",
    address: "1341 Lake St, Venice 90291",
    courts: 6,
    type: "free",
    fee: "Free",
    features: ["Night Lights", "Parking", "Golf Course", "Pool"],
    hasBooking: false,
    coordinates: { lat: 34.0086, lng: -118.4591 },
    phone: "(310) 396-8735",
    nearbyZips: ["90291", "90066", "90405"],
  },
  {
    id: 14,
    name: "La Cienega Park Tennis Center",
    location: "Beverly Hills",
    address: "8400 Gregory Way, Beverly Hills 90211",
    courts: 16,
    type: "bookable",
    fee: "$9-15/hour",
    features: ["Championship Courts", "Pro Shop", "Practice Wall", "Night Lights"],
    hasBooking: true,
    bookingUrl:
      "https://www.beverlyhills.org/departments/communitydevelopment/recreationandparks/facilitiesandparks/lacienegalacienega/",
    coordinates: { lat: 34.0736, lng: -118.3764 },
    nextAvailable: ["3:30 PM", "5:00 PM", "6:30 PM"],
    phone: "(310) 550-4761",
  },
  {
    id: 15,
    name: "Barrington Recreation Center",
    location: "West LA",
    address: "333 S Barrington Ave, LA 90049",
    courts: 4,
    type: "free",
    fee: "Free",
    features: ["Night Lights", "Parking", "Basketball Courts"],
    hasBooking: false,
    coordinates: { lat: 34.0621, lng: -118.4658 },
    phone: "(310) 476-4866",
  },
  {
    id: 16,
    name: "Poinsettia Recreation Center",
    location: "Hollywood",
    address: "7341 Willoughby Ave, LA 90046",
    courts: 6,
    type: "free",
    fee: "Free",
    features: ["Night Lights", "Parking", "Dog Park"],
    hasBooking: false,
    coordinates: { lat: 34.0872, lng: -118.3456 },
    phone: "(323) 876-4541",
  },
  {
    id: 17,
    name: "West Hollywood Park",
    location: "West Hollywood",
    address: "625 N San Vicente Blvd, West Hollywood 90069",
    courts: 3,
    type: "bookable",
    fee: "Free (walk-on) or $8/hour (reserved)",
    features: ["Rooftop Courts", "City Views", "Night Lights"],
    hasBooking: true,
    bookingUrl: "https://www.weho.org/services/recreation-services/tennis-reservations",
    coordinates: { lat: 34.0839, lng: -118.3711 },
    nextAvailable: ["4:00 PM", "7:00 PM"],
    phone: "(323) 848-6534",
  },
  {
    id: 18,
    name: "Brookside Park",
    location: "Pasadena",
    address: "1133 N Rosemont Ave, Pasadena 91103",
    courts: 12,
    type: "bookable",
    fee: "$7-10/hour",
    features: ["Near Rose Bowl", "Mountain Views", "Night Lights", "Parking"],
    hasBooking: true,
    bookingUrl: "https://secure.rec1.com/CA/pasadena-ca/catalog",
    coordinates: { lat: 34.1667, lng: -118.1561 },
    nextAvailable: ["Now", "3:00 PM", "5:30 PM"],
    phone: "(626) 744-7275",
  },
  {
    id: 19,
    name: "Glen Alla Park",
    location: "Venice/Mar Vista",
    address: "4601 S Bentley Ave, LA 90066",
    courts: 2,
    type: "free",
    fee: "Free",
    features: ["Dog Park", "No Lights"],
    hasBooking: false,
    coordinates: { lat: 34.0028, lng: -118.4333 },
    phone: "(310) 253-6470",
    nearbyZips: ["90066", "90064", "90230"],
  },
  {
    id: 20,
    name: "Hollywood Recreation Center",
    location: "Hollywood",
    address: "1122 Cole Ave, LA 90038",
    courts: 4,
    type: "free",
    fee: "Free",
    features: ["Night Lights", "Pool", "Gymnasium"],
    hasBooking: false,
    coordinates: { lat: 34.0928, lng: -118.3259 },
    phone: "(323) 957-4302",
  },
  {
    id: 21,
    name: "Lafayette Park",
    location: "Downtown LA",
    address: "625 S Lafayette Park Pl, LA 90057",
    courts: 6,
    type: "free",
    fee: "Free",
    features: ["Night Lights", "Lake", "Walking Paths"],
    hasBooking: false,
    coordinates: { lat: 34.0589, lng: -118.2795 },
    phone: "(213) 368-0171",
  },
  {
    id: 22,
    name: "Echo Park Lake Courts",
    location: "Downtown LA",
    address: "751 Echo Park Ave, LA 90026",
    courts: 2,
    type: "free",
    fee: "Free",
    features: ["Night Lights", "Lake Views", "Parking"],
    hasBooking: false,
    coordinates: { lat: 34.0778, lng: -118.2606 },
    phone: "(213) 250-3578",
  },
  {
    id: 23,
    name: "Reseda Park",
    location: "San Fernando Valley",
    address: "18411 Victory Blvd, Reseda 91335",
    courts: 4,
    type: "free",
    fee: "Free",
    features: ["Night Lights", "Pool", "Recreation Center"],
    hasBooking: false,
    coordinates: { lat: 34.2019, lng: -118.5358 },
    phone: "(818) 881-3371",
  },
  {
    id: 24,
    name: "Studio City Recreation Center",
    location: "San Fernando Valley",
    address: "12621 Rye St, Studio City 91604",
    courts: 4,
    type: "free",
    fee: "Free",
    features: ["Night Lights", "Parking", "Playground"],
    hasBooking: false,
    coordinates: { lat: 34.1472, lng: -118.4131 },
    phone: "(818) 769-4415",
  },
  {
    id: 25,
    name: "Hermosa Beach Courts",
    location: "Beach Cities",
    address: "710 Pier Ave, Hermosa Beach 90254",
    courts: 2,
    type: "bookable",
    fee: "$10/hour",
    features: ["Ocean Views", "Night Lights", "Near Pier"],
    hasBooking: true,
    bookingUrl: "https://secure.rec1.com/CA/hermosa-beach-ca/catalog",
    coordinates: { lat: 33.8628, lng: -118.3994 },
    nextAvailable: ["6:00 PM"],
    phone: "(310) 318-0280",
  },
  {
    id: 26,
    name: "Redondo Beach Alta Vista Park",
    location: "Beach Cities",
    address: "715 Julia Ave, Redondo Beach 90277",
    courts: 6,
    type: "free",
    fee: "Free",
    features: ["Night Lights", "Parking", "Playground"],
    hasBooking: false,
    coordinates: { lat: 33.8472, lng: -118.3864 },
    phone: "(310) 372-1171",
  },
];

const FILTERS = [
  { id: "all", label: "All Courts" },
  { id: "bookable", label: "Online Booking" },
  { id: "free", label: "Free Courts" },
  { id: "lights", label: "Night Play" },
  { id: "westside", label: "Westside" },
  { id: "valley", label: "Valley" },
  { id: "beach", label: "Beach" },
  { id: "downtown", label: "Downtown" },
  { id: "pasadena", label: "Pasadena" },
];

const generateAvailability = () => {
  const times = [
    "Now",
    "2:30 PM",
    "3:00 PM",
    "3:30 PM",
    "4:00 PM",
    "5:00 PM",
    "5:30 PM",
    "6:00 PM",
    "7:00 PM",
    "7:30 PM",
    "8:00 PM",
  ];
  const count = Math.floor(Math.random() * 4) + 1;
  return times
    .slice()
    .sort(() => 0.5 - Math.random())
    .slice(0, count);
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const parsedLat1 = toNumber(lat1);
  const parsedLon1 = toNumber(lon1);
  const parsedLat2 = toNumber(lat2);
  const parsedLon2 = toNumber(lon2);

  if (
    parsedLat1 === null ||
    parsedLon1 === null ||
    parsedLat2 === null ||
    parsedLon2 === null
  ) {
    return null;
  }

  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadiusMiles = 3959;

  const dLat = toRad(parsedLat2 - parsedLat1);
  const dLon = toRad(parsedLon2 - parsedLon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(parsedLat1)) *
      Math.cos(toRad(parsedLat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = earthRadiusMiles * c;

  if (!Number.isFinite(distance)) return null;
  return Math.round(distance * 10) / 10;
};

const CourtFinder = () => {
  const [courts, setCourts] = useState(() => BASE_COURTS.map((court) => ({ ...court })));
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [userLocation, setUserLocation] = useState(null);
  const [selectedRadius, setSelectedRadius] = useState("");
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setCourts((previous) =>
        previous.map((court) =>
          court.hasBooking
            ? {
                ...court,
                nextAvailable: generateAvailability(),
              }
            : court,
        ),
      );
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const courtsWithDistance = useMemo(() => {
    if (!userLocation) {
      return courts.map((court) => ({ ...court, distance: null }));
    }

    return courts.map((court) => ({
      ...court,
      distance: calculateDistance(
        userLocation.lat,
        userLocation.lng,
        court.coordinates.lat,
        court.coordinates.lng,
      ),
    }));
  }, [courts, userLocation]);

  const filteredCourts = useMemo(() => {
    const trimmed = searchTerm.trim();
    const term = trimmed.toLowerCase();
    const isZipSearch = /^\d{5}$/.test(trimmed);
    const radiusMiles = selectedRadius ? Number(selectedRadius) : null;

    const matchesSearch = (court) => {
      if (!term) return true;

      const matchesStandard =
        court.name.toLowerCase().includes(term) ||
        court.location.toLowerCase().includes(term) ||
        court.address.toLowerCase().includes(term) ||
        court.features.some((feature) => feature.toLowerCase().includes(term));

      const matchesZip =
        isZipSearch && court.nearbyZips && court.nearbyZips.includes(trimmed);

      return matchesStandard || matchesZip;
    };

    const matchesFilter = (court) => {
      switch (activeFilter) {
        case "bookable":
          return court.hasBooking;
        case "free":
          return court.type === "free";
        case "lights":
          return court.features.includes("Night Lights");
        case "westside":
          return [
            "West LA",
            "Santa Monica",
            "Venice/Mar Vista",
            "Venice",
            "Culver City",
            "Beverly Hills",
            "West Hollywood",
          ].includes(court.location);
        case "valley":
          return court.location.includes("Valley");
        case "beach":
          return court.location.includes("Beach");
        case "downtown":
          return court.location.includes("Downtown");
        case "pasadena":
          return court.location.includes("Pasadena");
        default:
          return true;
      }
    };

    let result = courtsWithDistance.filter(
      (court) => matchesSearch(court) && matchesFilter(court),
    );

    if (userLocation && radiusMiles) {
      result = result.filter(
        (court) => typeof court.distance === "number" && court.distance <= radiusMiles,
      );
    }

    if (userLocation) {
      result = result.sort((a, b) => {
        const distanceA = typeof a.distance === "number" ? a.distance : Infinity;
        const distanceB = typeof b.distance === "number" ? b.distance : Infinity;
        return distanceA - distanceB;
      });
    } else {
      result = result.sort((a, b) => a.name.localeCompare(b.name));
    }

    return result;
  }, [
    courtsWithDistance,
    searchTerm,
    activeFilter,
    userLocation,
    selectedRadius,
  ]);

  const bookableCount = useMemo(
    () => courts.filter((court) => court.hasBooking).length,
    [courts],
  );

  const availableNowCount = useMemo(
    () =>
      courts.filter(
        (court) => court.hasBooking && court.nextAvailable?.includes("Now"),
      ).length,
    [courts],
  );

  const handleRefresh = useCallback((courtId) => {
    setCourts((previous) =>
      previous.map((court) =>
        court.id === courtId
          ? {
              ...court,
              nextAvailable: generateAvailability(),
            }
          : court,
      ),
    );
  }, []);

  const handleToggleLocation = () => {
    if (userLocation) {
      setUserLocation(null);
      setSelectedRadius("");
      setLocationError("");
      return;
    }

    if (!navigator.geolocation) {
      setLocationError("Geolocation isn't supported by your browser.");
      return;
    }

    setIsLocating(true);
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setIsLocating(false);
      },
      () => {
        setLocationError("Unable to access your location. Please enable location services.");
        setIsLocating(false);
      },
    );
  };

  const handleRadiusChange = (event) => {
    setSelectedRadius(event.target.value);
  };

  const handleDirections = (lat, lng) => {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    window.open(url, "_blank", "noopener");
  };

  const locationButtonLabel = userLocation
    ? "✖️ Clear Location"
    : isLocating
    ? "⏳ Locating..."
    : "📍 Near Me";

  return (
    <div className="court-finder">
      <div className="cf-header">
        <div className="cf-header-content">
          <div className="cf-header-nav">
            <Link to="/" className="cf-back-link">
              ← Back to home
            </Link>
          </div>
          <h1>🎾 LA Tennis Courts</h1>
          <p>Find and book tennis courts across Los Angeles</p>

          <div className="cf-stats-bar">
            <div className="cf-stat">
              <span className="cf-stat-value">26</span>
              <span className="cf-stat-label">Locations</span>
            </div>
            <div className="cf-stat">
              <span className="cf-stat-value">{bookableCount}</span>
              <span className="cf-stat-label">Bookable Online</span>
            </div>
            <div className="cf-stat">
              <span className="cf-stat-value">{availableNowCount}</span>
              <span className="cf-stat-label">Available Now</span>
            </div>
          </div>
        </div>
      </div>

      <div className="cf-container">
        <div className="cf-controls-section">
          <div className="cf-search-container">
            <input
              type="text"
              className="cf-search-input"
              placeholder="Search by location, name, features, or ZIP code (e.g. 90066)..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
            <span className="cf-search-icon">🔍</span>
          </div>

          {locationError && <p className="cf-location-error">{locationError}</p>}

          <div className="cf-filter-pills">
            {FILTERS.map((filter) => (
              <button
                key={filter.id}
                className={`cf-pill${activeFilter === filter.id ? " active" : ""}`}
                onClick={() => setActiveFilter(filter.id)}
                type="button"
              >
                {filter.label}
              </button>
            ))}

            <button
              className={`cf-location-btn${userLocation ? " active" : ""}`}
              onClick={handleToggleLocation}
              disabled={isLocating}
              type="button"
            >
              {locationButtonLabel}
            </button>

            {userLocation && (
              <select
                id="radiusFilter"
                className="cf-radius-select"
                value={selectedRadius}
                onChange={handleRadiusChange}
              >
                <option value="">All distances</option>
                <option value="1">Within 1 mile</option>
                <option value="3">Within 3 miles</option>
                <option value="5">Within 5 miles</option>
                <option value="10">Within 10 miles</option>
                <option value="20">Within 20 miles</option>
              </select>
            )}
          </div>
        </div>

        {filteredCourts.length > 0 ? (
          <div className="cf-courts-grid">
            {filteredCourts.map((court) => {
              const shortAddress = court.address.split(",")[0];
              return (
                <div className="cf-court-card" key={court.id}>
                  {typeof court.distance === "number" && (
                    <span className="cf-distance-badge">
                      {court.distance.toFixed(1)} mi
                    </span>
                  )}

                  <div className="cf-court-header">
                    <div className="cf-court-header-top">
                      <div className="cf-court-name">{court.name}</div>
                      <div
                        className={`cf-court-badge ${
                          court.hasBooking
                            ? "cf-court-badge--bookable"
                            : "cf-court-badge--free"
                        }`}
                      >
                        {court.hasBooking ? "Book" : "Free"}
                      </div>
                    </div>
                    <div className="cf-court-location">📍 {court.location}</div>
                  </div>

                  <div className="cf-court-body">
                    <div className="cf-court-details">
                      <div className="cf-detail-item">
                        <span className="cf-detail-icon">🎾</span>
                        <span>{court.courts} courts</span>
                      </div>
                      <div className="cf-detail-item">
                        <span className="cf-detail-icon">💰</span>
                        <span>{court.fee}</span>
                      </div>
                      <div className="cf-detail-item">
                        <span className="cf-detail-icon">📞</span>
                        <span>{court.phone}</span>
                      </div>
                      <div className="cf-detail-item">
                        <span className="cf-detail-icon">📍</span>
                        <span>{shortAddress}</span>
                      </div>
                    </div>

                    <div className="cf-court-features">
                      {court.features.map((feature) => (
                        <span key={feature} className="cf-feature-chip">
                          {feature}
                        </span>
                      ))}
                    </div>

                    {court.hasBooking && court.nextAvailable?.length ? (
                      <div className="cf-availability-section">
                        <div className="cf-availability-header">
                          <div className="cf-availability-title">
                            ⏰ Next Available Times
                          </div>
                          <button
                            className="cf-refresh-btn"
                            onClick={() => handleRefresh(court.id)}
                            type="button"
                          >
                            ↻
                          </button>
                        </div>
                        <div className="cf-time-slots">
                          {court.nextAvailable.map((time) => (
                            <div
                              key={time}
                              className={`cf-time-slot${
                                time === "Now" ? " cf-time-slot--now" : ""
                              }`}
                            >
                              {time}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="cf-court-actions">
                      {court.hasBooking ? (
                        <a
                          href={court.bookingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="cf-btn cf-btn-primary"
                        >
                          Book Court
                        </a>
                      ) : (
                        <button className="cf-btn cf-btn-secondary" disabled type="button">
                          First Come, First Serve
                        </button>
                      )}
                      <button
                        className="cf-btn cf-btn-secondary"
                        onClick={() =>
                          handleDirections(court.coordinates.lat, court.coordinates.lng)
                        }
                        type="button"
                      >
                        Directions
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="cf-no-results">
            <h3>No courts found</h3>
            <p>Try adjusting your search or filters</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CourtFinder;
