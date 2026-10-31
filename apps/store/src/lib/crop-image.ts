/**
 * Client-side auto-cropper: center-crops an uploaded photo to a fixed aspect
 * ratio, resizes it to a standard width and re-encodes as WEBP. Keeps product
 * cards (1:1) and shop banners (16:9) consistent in the customer app and makes
 * the upload small before it reaches the API.
 */
export async function cropToAspect(file: File, aspect: number, targetWidth: number, quality = 0.88): Promise<File> {
  // If not an image, return as-is
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const targetHeight = Math.round(targetWidth / aspect);
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        resolve(file);
        return;
      }

      // Smooth resizing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Clean white background (in case of transparent PNG/WEBP)
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      // Largest centered window with the wanted aspect that fits the source.
      let srcW = img.width;
      let srcH = Math.round(img.width / aspect);
      if (srcH > img.height) {
        srcH = img.height;
        srcW = Math.round(img.height * aspect);
      }
      const sx = (img.width - srcW) / 2;
      const sy = (img.height - srcH) / 2;

      ctx.drawImage(img, sx, sy, srcW, srcH, 0, 0, targetWidth, targetHeight);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file);
            return;
          }
          const croppedFile = new File([blob], file.name.replace(/\.[^/.]+$/, '') + '.webp', {
            type: 'image/webp',
            lastModified: Date.now(),
          });
          resolve(croppedFile);
        },
        'image/webp',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

/** 1:1 square for product photos (800×800 by default). */
export function cropToSquare(file: File, targetSize = 800, quality = 0.88): Promise<File> {
  return cropToAspect(file, 1, targetSize, quality);
}

/** 16:9 for the shop banner; 1200 wide matches the API's maximum output size. */
export function cropToBanner(file: File, targetWidth = 1200, quality = 0.88): Promise<File> {
  return cropToAspect(file, 16 / 9, targetWidth, quality);
}
