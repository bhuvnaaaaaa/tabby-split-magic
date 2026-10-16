export function sdkImage(urlOrDataURL: string) {
  if (!urlOrDataURL.trim()) throw new Error("Media content is empty");
  return { type: "image", image: new URL(urlOrDataURL) } as const;
}