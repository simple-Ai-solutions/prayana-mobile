// imageUrl — mobile port of the web utils/imageUtils.js normalizeImageUrl().
//
// Package (and some place) image objects store `url` values that are either
// relative ("/images/place-specific/…"), carry the legacy direct-S3 host, or
// contain corrupted patterns (backticks, stray ";", doubled slashes). The web
// grids run every url through normalizeImageUrl(); the mobile package screens
// used them raw, so any non-clean url rendered as a blank slide. This ports the
// same normaliser so mobile resolves images identically to the PWA.
import { ENV } from '../config/env';

const LEGACY_S3_HOST = 'travel-app-image-travel-ai.s3.ap-south-1.amazonaws.com';

// Mirror the web default: prefer the CDN (prayanaai.com) — newer keys live in a
// private OAC-protected bucket only CloudFront can serve — then the S3 base,
// then the hardcoded CDN. Trailing slashes stripped so we never build "…//img".
function baseUrl(): string {
  const b = ENV.cdnUrl || ENV.s3BaseUrl || 'https://prayanaai.com';
  return b.replace(/\/+$/, '');
}

export function normalizeImageUrl(url?: string | null): string {
  if (!url) return '';
  const base = baseUrl();

  // Sanitize corrupted patterns, collapse doubled slashes, then repair the
  // protocol "//" that the slash-collapse would have flattened to "/".
  const sanitized = url
    .replace(/`/g, '')
    .replace(/;/g, '')
    .replace(/\/`;\//g, '/')
    .replace(/`;\//g, '')
    .replace(/\/+/g, '/')
    .replace('https:/', 'https://')
    .replace('http:/', 'http://');

  // Rewrite the legacy direct-S3 host onto the configured base.
  if (sanitized.includes(LEGACY_S3_HOST)) {
    const path = sanitized.split(`${LEGACY_S3_HOST}/`)[1];
    if (path) return `${base}/${path.replace(/^\/+/, '')}`;
  }

  // Already on the right base — return sanitized as-is.
  if (sanitized.startsWith(base)) return sanitized;

  // Relative path → prepend base.
  if (!sanitized.startsWith('http')) {
    return `${base}/${sanitized.startsWith('/') ? sanitized.slice(1) : sanitized}`;
  }

  // External absolute URL → sanitized.
  return sanitized;
}
