const toBase64 = (value: string): string => {
  if (typeof btoa === 'function') {
    return btoa(value);
  }

  const bufferCtor = (globalThis as any)?.Buffer;
  if (bufferCtor) {
    return bufferCtor.from(value).toString('base64');
  }

  throw new Error('No base64 encoder is available in this runtime.');
};

export const generateStyleImage = async (_description: string, styleName: string): Promise<string> => {
  const label = encodeURIComponent(styleName.toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512"><rect width="512" height="512" fill="#1f2937"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#f9fafb" font-family="Arial" font-size="36">${label}</text></svg>`;

  return `data:image/svg+xml;base64,${toBase64(svg)}`;
};
