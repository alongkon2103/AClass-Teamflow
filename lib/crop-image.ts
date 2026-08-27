/**
 * Renders the selected crop to a square JPEG.
 *
 * react-easy-crop reports the crop in the source image's own pixels, so the
 * result is cut at full resolution and only then scaled down — cropping a
 * displayed preview would lose detail on large photos.
 */
export const AVATAR_OUTPUT_SIZE = 512;

export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () =>
      reject(new Error("อ่านไฟล์รูปไม่สำเร็จ")),
    );
    image.src = src;
  });
}

export async function cropToSquareBlob(
  imageSrc: string,
  crop: PixelCrop,
  size = AVATAR_OUTPUT_SIZE,
): Promise<Blob> {
  const image = await loadImage(imageSrc);

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("เบราว์เซอร์ไม่รองรับการตัดรูป");

  // A photo smaller than the output would otherwise be upscaled into a blur.
  const side = Math.min(crop.width, crop.height);
  context.imageSmoothingQuality = "high";
  context.drawImage(image, crop.x, crop.y, side, side, 0, 0, size, size);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("สร้างไฟล์รูปไม่สำเร็จ")),
      "image/jpeg",
      0.9,
    );
  });
}
