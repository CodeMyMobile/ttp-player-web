import api, { unwrap } from "./api";
import { normalizeAuthToken } from "./authToken";

const normalizeUploadResponse = (data = {}) => {
  if (!data || typeof data !== "object") {
    return {};
  }
  const uploadURL =
    data.uploadURL || data.upload_url || data.uploadUrl || data.url || null;
  const fileURL =
    data.fileURL || data.file_url || data.fileUrl || data.location || null;
  return {
    ...data,
    ...(uploadURL ? { uploadURL } : {}),
    ...(fileURL ? { fileURL } : {}),
  };
};

export const getPlayerAWSUrl = async (token, extension = "jpeg") => {
  const authHeader = normalizeAuthToken(token, {
    defaultScheme: "Bearer",
    preferScheme: "Bearer",
  });
  if (!authHeader) {
    throw new Error("Missing player token");
  }

  const response = await unwrap(
    api(`/player/profile_picture/upload_url`, {
      method: "POST",
      authToken: authHeader,
      authSchemePreference: "Bearer",
      json: {
        file_extension: extension,
      },
    }),
  );

  const normalized = normalizeUploadResponse(response);
  if (!normalized.uploadURL) {
    throw new Error("Upload URL was not provided by the server");
  }
  return normalized;
};

export const putToSignedUrl = async (uploadURL, file, extension = "jpeg") => {
  if (!uploadURL) {
    throw new Error("Missing upload URL");
  }
  const headers = {
    "Content-Type": `image/${extension}`,
  };

  const response = await fetch(uploadURL, {
    method: "PUT",
    headers,
    body: file,
  });

  if (!response.ok) {
    throw new Error("Failed to upload image");
  }

  return true;
};
