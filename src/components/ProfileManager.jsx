import { useEffect, useState } from "react";
import { X, Loader2, UserRound } from "lucide-react";
import { getPersonalDetails } from "../services/auth";
import { formatPhoneNumber, formatPhoneDisplay } from "../services/phone";
import ProfilePhotoUploader from "./ProfilePhotoUploader";
import { createPlayerPersonalDetails, updatePlayerPersonalDetails } from "../services/player";

import "./ProfileManager.css";

const emptyDetails = {
  id: null,
  full_name: "",
  phone: "",
  profile_picture: "",
  date_of_birth: "",
  usta_rating: "",
  uta_rating: "",
  about_me: "",
};

const ProfileManager = ({ isOpen, onClose, variant = "modal" }) => {
  const [details, setDetails] = useState(emptyDetails);
  const [phoneInput, setPhoneInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const accessToken = localStorage.getItem("authToken");
  const isPage = variant === "page";

  useEffect(() => {
    if (isPage) {
      fetchDetails();
      return () => {
        setDetails(emptyDetails);
        setPhoneInput("");
        setError("");
        setImagePreview("");
        setSuccessMessage("");
      };
    }

    if (isOpen) {
      fetchDetails();
    } else {
      setDetails(emptyDetails);
      setPhoneInput("");
      setError("");
      setImagePreview("");
      setSuccessMessage("");
    }
  }, [isOpen, isPage]);

  const fetchDetails = async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) {
        setLoading(true);
      }
      const data = await getPersonalDetails();
      const normalizedDetails = {
        id: data?.id ?? null,
        full_name: data?.full_name || "",
        phone: data?.phone ? String(data.phone).replace(/\D/g, "") : "",
        profile_picture: data?.profile_picture || "",
        date_of_birth: data?.date_of_birth
          ? data.date_of_birth.split("T")[0]
          : "",
        usta_rating:
          typeof data?.usta_rating === "number" && !Number.isNaN(data.usta_rating)
            ? String(data.usta_rating)
            : data?.usta_rating || "",
        uta_rating:
          typeof data?.uta_rating === "number" && !Number.isNaN(data.uta_rating)
            ? String(data.uta_rating)
            : data?.uta_rating || "",
        about_me: data?.about_me || "",
      };
      setDetails(normalizedDetails);
      setPhoneInput(formatPhoneDisplay(data?.phone) || "");
      setImagePreview(normalizedDetails.profile_picture || "");
    } catch (err) {
      console.error(err);
      if (err?.status === 404) {
        setDetails(emptyDetails);
        setPhoneInput("");
        setImagePreview("");
        setError("");
      } else {
        setError("Failed to load profile details. Please try again.");
      }
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  };

  const handlePhoneChange = (value) => {
    const formatted = formatPhoneNumber(value);
    const digits = formatted.replace(/\D/g, "");
    setPhoneInput(formatted);
    setDetails((prev) => ({ ...prev, phone: digits }));
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setSaving(true);
    if (!accessToken) {
      setSaving(false);
      setError("Please sign in again to update your profile.");
      return;
    }
    try {
      const parseRating = (value) => {
        if (value === "" || value === null || value === undefined) {
          return undefined;
        }
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : undefined;
      };

      const sanitizedPhone = String(details.phone || "").replace(/\D/g, "");
      const aboutMe = details.about_me?.trim();
      const payload = {
        player: accessToken,
        date_of_birth: details.date_of_birth || null,
        usta_rating: parseRating(details.usta_rating),
        uta_rating: parseRating(details.uta_rating),
        fullName: details.full_name?.trim() || null,
        mobile: sanitizedPhone ? sanitizedPhone : null,
        about_me: aboutMe || null,
      };

      const response = details.id
        ? await updatePlayerPersonalDetails({
            ...payload,
            id: details.id,
          })
        : await createPlayerPersonalDetails(payload);

      if (response?.id && response.id !== details.id) {
        setDetails((prev) => ({ ...prev, id: response.id }));
      }
      if (isPage) {
        setSuccessMessage("Profile updated successfully.");
        fetchDetails({ showLoader: false });
      } else {
        onClose?.();
      }
    } catch (err) {
      console.error(err);
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "We couldn't save your profile. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!isPage && !isOpen) return null;

  const HeaderContent = (
    <div className="profile-manager__header">
      <div className="profile-manager__title-group">
        <div className="profile-manager__avatar">
          <UserRound className="profile-manager__avatar-icon" aria-hidden="true" />
        </div>
        <div>
          <h2 className="profile-manager__title">Player profile</h2>
          <p className="profile-manager__subtitle">Keep your personal information up to date</p>
        </div>
      </div>
      {!isPage && (
        <button
          onClick={onClose}
          type="button"
          className="profile-manager__close"
          aria-label="Close profile manager"
        >
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  );

  const FormContent = (
    <form onSubmit={handleUpdate} className="profile-manager__form">
      {loading ? (
        <div className="profile-manager__loading">
          <Loader2 className="profile-manager__spinner" aria-hidden="true" />
        </div>
      ) : (
        <>
          <div className="profile-manager__field">
            <label className="profile-manager__label" htmlFor="profile-full-name">
              Full name
            </label>
            <input
              id="profile-full-name"
              className="profile-manager__input"
              type="text"
              placeholder="Jane Doe"
              value={details.full_name}
              onChange={(e) =>
                setDetails((prev) => ({
                  ...prev,
                  full_name: e.target.value,
                }))
              }
              autoFocus
            />
          </div>

          <div className="profile-manager__field">
            <label className="profile-manager__label" htmlFor="profile-mobile">
              Mobile number
            </label>
            <input
              id="profile-mobile"
              className="profile-manager__input"
              type="tel"
              placeholder="(555) 123-4567"
              value={phoneInput}
              onChange={(e) => handlePhoneChange(e.target.value)}
              maxLength={14}
              inputMode="tel"
            />
            <p className="profile-manager__helper">We&apos;ll use this number to share match reminders.</p>
          </div>

          <div className="profile-manager__field profile-manager__field--photo">
            <label className="profile-manager__label" htmlFor="profile-photo">
              Profile photo
            </label>
            <div className="profile-manager__photo-row">
              <div className="profile-manager__photo-preview" aria-hidden={!imagePreview}>
                <div className="profile-manager__photo-frame">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Profile preview" />
                  ) : (
                    <UserRound className="profile-manager__photo-fallback" aria-hidden="true" />
                  )}
                </div>
              </div>
              <div className="profile-manager__photo-actions">
                <ProfilePhotoUploader
                  accessToken={accessToken}
                  onUploaded={() => fetchDetails({ showLoader: false })}
                  className="profile-manager__upload"
                  disabledLabel="Uploading…"
                  label="Upload from device"
                  errorClassName="profile-manager__upload-error"
                />
                <p className="profile-manager__helper">JPG or PNG, up to 5MB. We&apos;ll resize it for your profile.</p>
              </div>
            </div>
          </div>

          <div className="profile-manager__field">
            <label className="profile-manager__label" htmlFor="profile-dob">
              Date of birth
            </label>
            <input
              id="profile-dob"
              className="profile-manager__input"
              type="date"
              value={details.date_of_birth}
              onChange={(e) =>
                setDetails((prev) => ({
                  ...prev,
                  date_of_birth: e.target.value,
                }))
              }
            />
          </div>

          <div className="profile-manager__rating-grid">
            <div className="profile-manager__field">
              <label className="profile-manager__label" htmlFor="profile-usta">
                USTA rating
              </label>
              <input
                id="profile-usta"
                className="profile-manager__input"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                placeholder="e.g. 3.5"
                value={details.usta_rating}
                onChange={(e) =>
                  setDetails((prev) => ({
                    ...prev,
                    usta_rating: e.target.value,
                  }))
                }
              />
            </div>
            <div className="profile-manager__field">
              <label className="profile-manager__label" htmlFor="profile-uta">
                UTA rating
              </label>
              <input
                id="profile-uta"
                className="profile-manager__input"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                placeholder="e.g. 7.0"
                value={details.uta_rating}
                onChange={(e) =>
                  setDetails((prev) => ({
                    ...prev,
                    uta_rating: e.target.value,
                  }))
                }
              />
            </div>
          </div>

          <div className="profile-manager__field">
            <label className="profile-manager__label" htmlFor="profile-about">
              About me
            </label>
            <textarea
              id="profile-about"
              className="profile-manager__textarea"
              rows={4}
              placeholder="Share a quick introduction for other players"
              value={details.about_me}
              onChange={(e) =>
                setDetails((prev) => ({
                  ...prev,
                  about_me: e.target.value,
                }))
              }
            />
          </div>
        </>
      )}

      {error && <div className="profile-manager__alert profile-manager__alert--error">{error}</div>}

      <div className="profile-manager__actions">
        {!isPage && (
          <button type="button" onClick={onClose} className="profile-manager__secondary">
            Cancel
          </button>
        )}
        <button type="submit" disabled={saving || loading} className="profile-manager__primary">
          {saving ? (
            <>
              <Loader2 className="profile-manager__primary-spinner" aria-hidden="true" />
              Saving
            </>
          ) : (
            "Save"
          )}
        </button>
      </div>
    </form>
  );

  if (isPage) {
    return (
      <div className="profile-manager profile-manager--page">
        {successMessage && <div className="profile-manager__alert profile-manager__alert--success">{successMessage}</div>}
        <div className="profile-manager__card">
          {HeaderContent}
          {FormContent}
        </div>
      </div>
    );
  }

  return (
    <div className="profile-manager__modal" role="dialog" aria-modal="true">
      <div className="profile-manager__modal-card">
        {HeaderContent}
        {FormContent}
      </div>
    </div>
  );
};

export default ProfileManager;
