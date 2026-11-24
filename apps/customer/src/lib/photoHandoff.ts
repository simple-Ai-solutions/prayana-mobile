// Photo hand-off: a card that opens a detail page leaves the photo it was
// showing here, and the page shows that same photo at once while its own data
// loads. Tapping a card then reads as the picture carrying on into the page,
// not a jump to a grey placeholder. (Reanimated 4 has no shared-element
// transitions, so this is the continuity we can give.)
const photos = new Map<string, string>();

/** Leave `url` for the detail page of `id`. */
export function handOffPhoto(id: string | undefined | null, url: string | undefined | null) {
  if (!id || !url) return;
  photos.set(String(id), url);
  // Only the latest few matter; don't let the map grow for ever.
  if (photos.size > 20) photos.delete(photos.keys().next().value as string);
}

/** The photo a card left for `id`, if any. */
export function handedOffPhoto(id: string | undefined | null): string | null {
  return id ? photos.get(String(id)) ?? null : null;
}
