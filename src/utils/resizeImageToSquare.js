export const resizeImageToSquare = (file, size = 350, mimeType = "image/jpeg", quality = 0.92) => {
  if (!file) {
    return Promise.reject(new Error("No file provided"));
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();
      image.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) {
            reject(new Error("Canvas context not available"));
            return;
          }

          canvas.width = size;
          canvas.height = size;

          const minSide = Math.min(image.width, image.height);
          const sx = (image.width - minSide) / 2;
          const sy = (image.height - minSide) / 2;

          context.clearRect(0, 0, size, size);
          context.drawImage(
            image,
            sx,
            sy,
            minSide,
            minSide,
            0,
            0,
            size,
            size,
          );

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error("Failed to resize image"));
                return;
              }
              resolve(blob);
            },
            mimeType,
            quality,
          );
        } catch (err) {
          reject(err);
        }
      };

      image.onerror = () => {
        reject(new Error("Failed to load image"));
      };

      image.src = reader.result;
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsDataURL(file);
  });
};
