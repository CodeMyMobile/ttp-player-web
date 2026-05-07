import React, { useState } from "react";
import { getPlayerAWSUrl, putToSignedUrl } from "../services/avatar";
import { resizeImageToSquare } from "../utils/resizeImageToSquare";

export default function ProfilePhotoUploader({
  accessToken,
  onUploaded,
  accept = "image/jpeg,image/png",
  label = "Change photo",
  className = "btn",
  disabledLabel = "Uploading…",
  errorClassName = "text-sm font-semibold text-red-600 mt-2",
}) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e) {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = (file.type || "").split("/")[1];
    const normalized = ext === "jpg" ? "jpeg" : ext;
    if (!["jpeg", "png"].includes(normalized)) {
      setError(`${ext || "unknown"} is not supported. Use JPEG or PNG.`);
      return;
    }

    setIsUploading(true);
    try {
      const targetMime = `image/${normalized}`;
      const resizedBlob = await resizeImageToSquare(file, 350, targetMime, 0.95);
      const { uploadURL } = await getPlayerAWSUrl(accessToken, normalized);
      await putToSignedUrl(uploadURL, resizedBlob, normalized);
      onUploaded?.();
    } catch (err) {
      console.error(err);
      setError(err.message || "Upload failed");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div>
      <label
        className={`${className} ${isUploading ? "opacity-70 cursor-not-allowed" : ""}`}
      >
        {isUploading ? disabledLabel : label}
        <input
          type="file"
          accept={accept}
          style={{ display: "none" }}
          onChange={handleFile}
          disabled={isUploading}
        />
      </label>
      {error && <div className={errorClassName}>{error}</div>}
    </div>
  );
}
