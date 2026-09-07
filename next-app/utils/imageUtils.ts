const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_UPLOAD_BASE || 'https://api.zelton.co.in';

export const getImageUrl = (imagePath: string | null | undefined): string | null => {
  if (!imagePath) return null;

  let cleanPath = imagePath;

  if (cleanPath.startsWith('http://localhost/storage/')) {
    cleanPath = cleanPath.replace('http://localhost/storage/', '');
  } else if (cleanPath.startsWith('http://127.0.0.1/storage/')) {
    cleanPath = cleanPath.replace('http://127.0.0.1/storage/', '');
  } else if (cleanPath.startsWith('http://localhost/uploads/')) {
    cleanPath = cleanPath.replace('http://localhost/uploads/', '');
  } else if (cleanPath.startsWith('http://') || cleanPath.startsWith('https://')) {
    return cleanPath;
  }

  if (cleanPath.startsWith('/storage/')) {
    cleanPath = cleanPath.replace('/storage/', '');
  } else if (cleanPath.startsWith('storage/')) {
    cleanPath = cleanPath.replace('storage/', '');
  } else if (cleanPath.startsWith('/uploads/')) {
    cleanPath = cleanPath.replace('/uploads/', '');
  } else if (cleanPath.startsWith('uploads/')) {
    cleanPath = cleanPath.replace('uploads/', '');
  } else if (cleanPath.startsWith('/')) {
    cleanPath = cleanPath.slice(1);
  }

  return `${API_URL}/storage/${cleanPath}`;
};

export const getPublicImageUrl = (imagePath: string | null | undefined): string | null => {
  return getImageUrl(imagePath);
};

export default {
  getImageUrl,
  getPublicImageUrl
};