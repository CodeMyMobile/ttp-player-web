import { useEffect, useState } from "react";
import { X, Loader2, UserRound } from "lucide-react";
import { getPersonalDetails } from "../services/auth";
import { formatPhoneNumber, formatPhoneDisplay } from "../services/phone";
import ProfilePhotoUploader from "./ProfilePhotoUploader";
import { updatePlayerPersonalDetails } from "../services/player";

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

const ProfileManager = ({ isOpen, onClose }) => {
  const [details, setDetails] = useState(emptyDetails);
  const [phoneInput, setPhoneInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const accessToken = localStorage.getItem("authToken");

  useEffect(() => {
    if (isOpen) {
      fetchDetails();
    } else {
      setDetails(emptyDetails);
      setPhoneInput("");
      setError("");
      setImagePreview("");
    }
  }, [isOpen]);

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
      setError("Failed to load profile details. Please try again.");
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
    setSaving(true);
    if (!details.id) {
      setSaving(false);
      setError("We couldn't determine your player profile. Please reload and try again.");
      return;
    }
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
      await updatePlayerPersonalDetails({
        player: accessToken,
        id: details.id,
        date_of_birth: details.date_of_birth || null,
        usta_rating: parseRating(details.usta_rating),
        uta_rating: parseRating(details.uta_rating),
        fullName: details.full_name?.trim() || null,
        mobile: sanitizedPhone ? sanitizedPhone : null,
        about_me: aboutMe || null,
      });
      onClose();
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 backdrop-blur-sm p-4 sm:p-6">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]">
        <div className="flex items-start justify-between px-4 py-4 sm:px-6 sm:py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white flex items-center justify-center shadow-lg">
              <UserRound className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">Player Profile</h2>
              <p className="text-sm font-medium text-gray-500">
                Keep your personal information up to date
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            aria-label="Close profile manager"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        <form
          onSubmit={handleUpdate}
          className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 space-y-5"
        >
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-black text-gray-700 uppercase tracking-wider">
                  Full Name
                </label>
                <input
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors font-semibold text-gray-800"
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

              <div className="space-y-2">
                <label className="text-sm font-black text-gray-700 uppercase tracking-wider">
                  Mobile Number
                </label>
                <input
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors font-semibold text-gray-800"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phoneInput}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  maxLength={14}
                  inputMode="tel"
                />
                <p className="text-xs font-semibold text-gray-500">
                  We'll use this number to share match reminders.
                </p>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-black text-gray-700 uppercase tracking-wider">
                  Profile Photo
                </label>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
                  <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200 p-[3px]">
                    <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center overflow-hidden">
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Profile preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <UserRound className="w-8 h-8 text-emerald-500" />
                      )}
                    </div>
                  </div>
                  <div className="space-y-2 w-full">
                    <ProfilePhotoUploader
                      accessToken={accessToken}
                      onUploaded={() => fetchDetails({ showLoader: false })}
                      className="px-4 py-2 rounded-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-green-500 shadow hover:shadow-md transition-shadow inline-flex items-center justify-center cursor-pointer"
                      disabledLabel="Uploading…"
                      label="Upload from device"
                      errorClassName="text-sm font-semibold text-red-600"
                    />
                    <p className="text-xs font-semibold text-gray-500">
                      JPG or PNG, up to 5MB. We'll resize it to fit nicely in the app.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-black text-gray-700 uppercase tracking-wider">
                  Date of Birth
                </label>
                <input
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors font-semibold text-gray-800"
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-black text-gray-700 uppercase tracking-wider">
                    USTA Rating
                  </label>
                  <input
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors font-semibold text-gray-800"
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
                <div className="space-y-2">
                  <label className="text-sm font-black text-gray-700 uppercase tracking-wider">
                    UTA Rating
                  </label>
                  <input
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-colors font-semibold text-gray-800"
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
            </>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-gray-200 font-bold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="px-5 py-2.5 rounded-xl font-black text-white bg-gradient-to-r from-green-500 to-emerald-600 shadow-lg hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving
                </>
              ) : (
                "Save"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileManager;
