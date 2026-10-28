import type { DiaryImage } from '../types';

const MAX_EDGE = 1280;
const MAX_DATA_URL_CHARS = 500_000;

function photoId(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `photo-${Date.now()}-${random}`;
}

function loadDrawable(file: File): Promise<CanvasImageSource & { width: number; height: number; close?: () => void }> {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file);
  }
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that photo."));
    };
    image.src = url;
  });
}

/** Shrink a picked photo to a JPEG data URL small enough to keep on the device. */
export async function compressDiaryImage(file: File): Promise<DiaryImage> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    throw new Error('Choose a photo.');
  }
  let drawable: CanvasImageSource & { width: number; height: number; close?: () => void };
  try {
    drawable = await loadDrawable(file);
  } catch {
    throw new Error("Couldn't read that photo.");
  }
  const longest = Math.max(drawable.width, drawable.height);
  const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
  const width = Math.max(1, Math.round(drawable.width * scale));
  const height = Math.max(1, Math.round(drawable.height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    drawable.close?.();
    throw new Error("Couldn't read that photo.");
  }
  context.drawImage(drawable, 0, 0, width, height);
  drawable.close?.();

  let quality = 0.72;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > 400_000 && quality > 0.4) {
    quality -= 0.12;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  if (!dataUrl.startsWith('data:image/') || dataUrl.length > MAX_DATA_URL_CHARS) {
    throw new Error('That photo is still too large. Try a smaller one.');
  }
  return { id: photoId(), dataUrl };
}
