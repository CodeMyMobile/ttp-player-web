/// <reference types="google.maps" />

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import Autocomplete from "react-google-autocomplete";
import { Check, UploadCloud, X } from "lucide-react";

import "./MatchProfileModal.css";

const NTRP_LEVELS = [
  {
    value: "2.5",
    label: "2.5",
    description: "Beginner – just getting started with match play.",
  },
  {
    value: "3.0",
    label: "3.0",
    description: "Advanced beginner – developing rally consistency.",
  },
  {
    value: "3.5",
    label: "3.5",
    description: "Intermediate – comfortable with longer rallies and net play.",
  },
  {
    value: "4.0",
    label: "4.0",
    description: "Advanced intermediate – confident with strategy and pace changes.",
  },
  {
    value: "4.5",
    label: "4.5",
    description: "Advanced – strong tournament or league experience.",
  },
  {
    value: "5.0+",
    label: "5.0+",
    description: "High performance – collegiate, open, or tournament ready.",
  },
];

const PLAY_STYLE_OPTIONS = [
  {
    value: "Fun / Social",
    label: "Fun / Social",
    description: "Looking to enjoy the game and meet new people.",
  },
  {
    value: "Casual Hitting",
    label: "Casual Hitting",
    description: "Interested in playing casually without any pressure.",
  },
  {
    value: "Friendly Competition",
    label: "Friendly Competition",
    description: "Enjoy keeping score and a little competitive energy.",
  },
  {
    value: "High Level Competition",
    label: "High Level Competition",
    description: "Focused on intense matches and performance training.",
  },
];

const AVAILABILITY_OPTIONS = ["Weekdays AM", "Weekday PM", "Weekends"];

export type MatchProfileDetails = {
  about: string;
  level: string;
  playStyles: string[];
  gender: string;
  localCourts: string;
  availability: string[];
};

const GENDER_OPTIONS = [
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "other", label: "Other" },
];

type MatchProfileModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (profile: MatchProfileDetails) => void;
  initialProfile?: MatchProfileDetails | null;
};

const DEFAULT_LEVEL = "3.0";

const EMPTY_PROFILE: MatchProfileDetails = {
  about: "",
  level: DEFAULT_LEVEL,
  playStyles: [],
  gender: "",
  localCourts: "",
  availability: [],
};

const GOOGLE_PLACES_API_KEY = (import.meta.env.VITE_GOOGLE_API_KEY ??
  import.meta.env.VITE_GOOGLE_PLACES_API_KEY) as string | undefined;

const MatchProfileModal = ({ isOpen, onClose, onComplete, initialProfile }: MatchProfileModalProps) => {
  const titleId = useId();
  const descriptionId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [about, setAbout] = useState(EMPTY_PROFILE.about);
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [selectedLevel, setSelectedLevel] = useState(EMPTY_PROFILE.level);
  const [playStyles, setPlayStyles] = useState<string[]>(EMPTY_PROFILE.playStyles);
  const [gender, setGender] = useState(EMPTY_PROFILE.gender);
  const [localCourts, setLocalCourts] = useState(EMPTY_PROFILE.localCourts);
  const [localCourtPlaceId, setLocalCourtPlaceId] = useState<string | null>(null);
  const [availability, setAvailability] = useState<string[]>(EMPTY_PROFILE.availability);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  const applyProfile = useCallback(
    (profile: MatchProfileDetails | null | undefined) => {
      const nextProfile = profile ?? EMPTY_PROFILE;
      setAbout(nextProfile.about ?? EMPTY_PROFILE.about);
      setPhotoName(null);
      setSelectedLevel(nextProfile.level ?? EMPTY_PROFILE.level);
      setPlayStyles(Array.isArray(nextProfile.playStyles) ? [...nextProfile.playStyles] : []);
      setGender(nextProfile.gender ?? EMPTY_PROFILE.gender);
      setLocalCourts(nextProfile.localCourts ?? EMPTY_PROFILE.localCourts);
      setAvailability(Array.isArray(nextProfile.availability) ? [...nextProfile.availability] : []);
      setLocalCourtPlaceId(null);
      setTouched(false);
    },
    [],
  );

  useEffect(() => {
    if (isOpen) {
      applyProfile(initialProfile);
    }
  }, [applyProfile, initialProfile, isOpen]);

  const handleOverlayClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const togglePlayStyle = (value: string) => {
    setPlayStyles((previous) =>
      previous.includes(value) ? previous.filter((option) => option !== value) : [...previous, value],
    );
  };

  const toggleAvailability = (value: string) => {
    setAvailability((previous) =>
      previous.includes(value) ? previous.filter((option) => option !== value) : [...previous, value],
    );
  };

  const handleFilePick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setPhotoName(file ? file.name : null);
  };

  const hasAboutError = touched && about.trim().length === 0;
  const hasGenderError = touched && gender.length === 0;
  const hasAvailabilityError = touched && availability.length === 0;
  const requiresCourtVerification =
    Boolean(GOOGLE_PLACES_API_KEY) && localCourts.trim().length > 0 && !localCourtPlaceId;
  const hasCourtsError = touched && requiresCourtVerification;

  const isSubmitDisabled = useMemo(() => {
    return (
      about.trim().length === 0 ||
      gender.length === 0 ||
      availability.length === 0 ||
      requiresCourtVerification
    );
  }, [about, gender, availability, requiresCourtVerification]);

  const showCompletionError = touched && isSubmitDisabled;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);
    if (isSubmitDisabled) {
      return;
    }

    const profileDetails: MatchProfileDetails = {
      about: about.trim(),
      level: selectedLevel,
      playStyles: [...playStyles],
      gender,
      localCourts: localCourts.trim(),
      availability: [...availability],
    };

    onComplete(profileDetails);
  };

  useEffect(() => {
    if (!isOpen) {
      setLocalCourtPlaceId(null);
    }
  }, [isOpen]);

  if (!isOpen || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className="match-profile-form-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onMouseDown={handleOverlayClick}
    >
      <div className="match-profile-form-modal" role="document">
        <header className="match-profile-form-modal__header">
          <div className="match-profile-form-modal__heading">
            <h2 id={titleId}>Build your player match profile</h2>
            <p id={descriptionId}>
              Share a few details to help local players understand your vibe, level, and availability.
            </p>
          </div>
          <button type="button" className="match-profile-form-modal__close" onClick={onClose} aria-label="Close profile form">
            <X size={20} strokeWidth={2} />
          </button>
        </header>

        <form className="match-profile-form-modal__form" onSubmit={handleSubmit}>
          <div className="match-profile-form-modal__body">
            <div className="match-profile-field">
              <label htmlFor="match-profile-about" className="match-profile-label">
                About me
              </label>
              <p className="match-profile-helper">Tell us more about yourself.</p>
              <textarea
                id="match-profile-about"
                value={about}
                onChange={(event) => setAbout(event.target.value)}
                rows={4}
                className={`match-profile-textarea${hasAboutError ? " match-profile-textarea--error" : ""}`}
                placeholder="Share your tennis background, goals, and what you&apos;re looking for."
              />
              {hasAboutError && <p className="match-profile-error">Please add a short description.</p>}
            </div>

            <div className="match-profile-field">
              <span className="match-profile-label">Profile photo</span>
              <p className="match-profile-helper">Upload a profile picture so other players recognize you.</p>
              <div className="match-profile-upload">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="match-profile-upload__input"
                  onChange={handleFileChange}
                />
                <button type="button" className="match-profile-upload__button" onClick={handleFilePick}
                  aria-label="Upload a profile photo"
                >
                  <UploadCloud size={18} strokeWidth={2} />
                  <span>{photoName ?? "Upload a photo"}</span>
                </button>
                <p className="match-profile-upload__note">PNG or JPG up to 5MB.</p>
              </div>
            </div>

            <div className="match-profile-field">
              <span className="match-profile-label">NTRP level</span>
              <p className="match-profile-helper">Choose the level that best describes your current play.</p>
              <div className="match-profile-choice-grid">
                {NTRP_LEVELS.map((level) => {
                  const isSelected = selectedLevel === level.value;
                  return (
                    <label key={level.value} className={`match-profile-choice${isSelected ? " match-profile-choice--selected" : ""}`}>
                      <input
                        type="radio"
                        name="match-profile-level"
                        value={level.value}
                        checked={isSelected}
                        onChange={() => setSelectedLevel(level.value)}
                      />
                      <div className="match-profile-choice__content">
                        <span className="match-profile-choice__label">{level.label}</span>
                        <span className="match-profile-choice__description">{level.description}</span>
                      </div>
                      {isSelected && (
                        <span className="match-profile-choice__check" aria-hidden="true">
                          <Check size={16} strokeWidth={2.5} />
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="match-profile-field">
              <span className="match-profile-label">Play style</span>
              <p className="match-profile-helper">Select the vibes that match what you&apos;re looking for.</p>
              <div className="match-profile-choice-grid">
                {PLAY_STYLE_OPTIONS.map((style) => {
                  const isSelected = playStyles.includes(style.value);
                  return (
                    <label key={style.value} className={`match-profile-choice match-profile-choice--checkbox${
                      isSelected ? " match-profile-choice--selected" : ""
                    }`}>
                      <input
                        type="checkbox"
                        name="match-profile-style"
                        value={style.value}
                        checked={isSelected}
                        onChange={() => togglePlayStyle(style.value)}
                      />
                      <div className="match-profile-choice__content">
                        <span className="match-profile-choice__label">{style.label}</span>
                        <span className="match-profile-choice__description">{style.description}</span>
                      </div>
                      {isSelected && (
                        <span className="match-profile-choice__check" aria-hidden="true">
                          <Check size={16} strokeWidth={2.5} />
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="match-profile-field">
              <span className="match-profile-label">Gender</span>
              <p className="match-profile-helper">Choose the option that best fits.</p>
              <div className="match-profile-choice-grid match-profile-choice-grid--columns">
                {GENDER_OPTIONS.map((option) => {
                  const isSelected = gender === option.value;
                  return (
                    <label key={option.value} className={`match-profile-choice${isSelected ? " match-profile-choice--selected" : ""}`}>
                      <input
                        type="radio"
                        name="match-profile-gender"
                        value={option.value}
                        checked={isSelected}
                        onChange={() => setGender(option.value)}
                      />
                      <div className="match-profile-choice__content">
                        <span className="match-profile-choice__label">{option.label}</span>
                      </div>
                      {isSelected && (
                        <span className="match-profile-choice__check" aria-hidden="true">
                          <Check size={16} strokeWidth={2.5} />
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
              {hasGenderError && <p className="match-profile-error">Please select a gender option.</p>}
            </div>

            <div className="match-profile-field match-profile-field--narrow">
              <label htmlFor="match-profile-courts" className="match-profile-label">
                My local courts
              </label>
              <p className="match-profile-helper">Search for your go-to courts so players know where to meet.</p>
              <Autocomplete
                id="match-profile-courts"
                apiKey={GOOGLE_PLACES_API_KEY || undefined}
                value={localCourts}
                onChange={(event) => {
                  setLocalCourts(event.target.value);
                  setLocalCourtPlaceId(null);
                }}
                onPlaceSelected={(place: google.maps.places.PlaceResult | null) => {
                  if (!place) {
                    return;
                  }

                  const placeLabel = place.name || place.formatted_address || localCourts;
                  setLocalCourts(placeLabel);
                  setLocalCourtPlaceId(place.place_id ?? null);
                }}
                options={{
                  fields: ["place_id", "formatted_address", "geometry", "name", "address_components"],
                  types: ["geocode", "establishment"],
                }}
                placeholder="Start typing a court name or neighborhood"
                className={`match-profile-input${hasCourtsError ? " match-profile-input--error" : ""}`}
                autoComplete="off"
              />
              {GOOGLE_PLACES_API_KEY && !localCourtPlaceId && (
                <p className="match-profile-status">Powered by Google Places. Select a result to confirm.</p>
              )}
              {GOOGLE_PLACES_API_KEY && localCourtPlaceId && (
                <p className="match-profile-status match-profile-status--success">Court verified with Google Places.</p>
              )}
              {!GOOGLE_PLACES_API_KEY && (
                <p className="match-profile-status match-profile-status--warning">
                  Autocomplete is unavailable right now, but you can still type your courts manually.
                </p>
              )}
              {hasCourtsError && (
                <p className="match-profile-error">
                  Select a court from the suggestions to make sure we have the right location.
                </p>
              )}
            </div>

            <div className="match-profile-field">
              <span className="match-profile-label">General availability</span>
              <p className="match-profile-helper">Pick the time windows that usually work for you.</p>
              <div className="match-profile-choice-grid match-profile-choice-grid--columns">
                {AVAILABILITY_OPTIONS.map((option) => {
                  const isSelected = availability.includes(option);
                  return (
                    <label key={option} className={`match-profile-choice match-profile-choice--checkbox${
                      isSelected ? " match-profile-choice--selected" : ""
                    }`}>
                      <input
                        type="checkbox"
                        name="match-profile-availability"
                        value={option}
                        checked={isSelected}
                        onChange={() => toggleAvailability(option)}
                      />
                      <div className="match-profile-choice__content">
                        <span className="match-profile-choice__label">{option}</span>
                      </div>
                      {isSelected && (
                        <span className="match-profile-choice__check" aria-hidden="true">
                          <Check size={16} strokeWidth={2.5} />
                        </span>
                      )}
                    </label>
                  );
                })}
              </div>
              {hasAvailabilityError && <p className="match-profile-error">Select at least one availability window.</p>}
            </div>
          </div>

          <footer className="match-profile-form-modal__footer">
            <p className="match-profile-form-modal__disclaimer">
              By completing your profile you agree to share your contact details with other Matchplay members and
              accept our terms of use. You can remove yourself from player matching anytime from the settings menu.
            </p>
            <div className="match-profile-form-modal__actions">
              {showCompletionError && (
                <p className="match-profile-form-modal__submit-error" role="alert">
                  Please complete your full profile before saving.
                </p>
              )}
              <div className="match-profile-form-modal__buttons">
                <button type="button" className="fc-button fc-button--secondary" onClick={onClose}>
                  Cancel
                </button>
                <button
                  type="submit"
                  className="fc-button fc-button--primary"
                  disabled={isSubmitDisabled}
                  aria-disabled={isSubmitDisabled}
                >
                  Save profile
                </button>
              </div>
            </div>
          </footer>
        </form>
      </div>
    </div>,
    document.body,
  );
};

export default MatchProfileModal;
