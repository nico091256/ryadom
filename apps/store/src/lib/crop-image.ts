/**
 * Client-side auto-cropper: Crops any uploaded photo into a clean 1:1 square
 * centered, resized to standard size (e.g. 800x800), and compressed to webp/jpeg.
 * Ensures consistent premium product cards in the customer app.
 */
export async function cropToSquare(file: File, targetSize = 800, quality = 0.88): Promise<File> {
  // If not an image, return as-is
  if (!file.type.startsWith('image/')) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const canvas = document.createElement('canvas');
      canvas.width = targetSize;
      canvas.height = targetSize;
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
      ctx.fillRect(0, 0, targetSize, targetSize);

      // Center crop math
      const srcSize = Math.min(img.width, img.height);
      const sx = (img.width - srcSize) / 2;
      const sy = (img.height - srcSize) / 2;

      ctx.drawImage(img, sx, sy, srcSize, srcSize, 0, 0, targetSize, targetSize);

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
