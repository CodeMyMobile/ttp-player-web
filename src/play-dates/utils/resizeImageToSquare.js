function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
}

export async function resizeImageToSquare(
  file,
  size = 350,
  mimeType = "image/jpeg",
  quality = 0.92
) {
  const dataUrl = await readFileAsDataURL(file);
  const image = await loadImage(dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas not supported");
  }

  const minSide = Math.min(image.width, image.height);
  const sx = (image.width - minSide) / 2;
  const sy = (image.height - minSide) / 2;

  ctx.drawImage(image, sx, sy, minSide, minSide, 0, 0, size, size);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Failed to process image"));
        }
      },
      mimeType,
      quality
    );
  });
}
