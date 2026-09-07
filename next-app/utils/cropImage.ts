import { Area } from 'react-easy-crop';

export default function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = pixelCrop.width;
      canvas.height = pixelCrop.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context is null'));
      ctx.drawImage(
        image,
        pixelCrop.x, pixelCrop.y, pixelCrop.width, pixelCrop.height,
        0, 0, pixelCrop.width, pixelCrop.height
      );
      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Canvas is empty or failed'));
        resolve(blob);
      }, 'image/jpeg');
    };
    image.onerror = () => reject(new Error('Failed to load image'));
    if (!imageSrc.startsWith('data:')) {
      image.crossOrigin = 'anonymous';
    }
    image.src = imageSrc;
  });
}