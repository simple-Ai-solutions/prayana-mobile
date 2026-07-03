// @ts-nocheck — pure JS utility; types deliberately deferred.
// utils/smartCache.js
"use client";

class SmartCache {
  constructor() {
    this.cache = new Map();
    this.pending = new Map();
    this.timestamps = new Map();
    this.prefetchQueue = [];
    this.maxAge = 600000; // 10 minutes
    this.maxSize = 200;
  }

  generateKey(placeName, location, type = 'details') {
    const clean = (str) => (str || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '-');
    return `${type}:${clean(placeName)}:${clean(location)}`;
  }

  has(key) {
    if (!this.cache.has(key)) return false;
    const age = Date.now() - (this.timestamps.get(key) || 0);
    if (age > this.maxAge) {
      this.delete(key);
      return false;
    }
    return true;
  }

  get(key) {
    return this.has(key) ? this.cache.get(key) : null;
  }

  set(key, data) {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.timestamps.entries().next().value?.[0];
      if (oldestKey) this.delete(oldestKey);
    }
    this.cache.set(key, data);
    this.timestamps.set(key, Date.now());
  }

  delete(key) {
    this.cache.delete(key);
    this.timestamps.delete(key);
    this.pending.delete(key);
  }

  async fetchWithDedup(key, fetchFn) {
    if (this.has(key)) return this.cache.get(key);
    if (this.pending.has(key)) return this.pending.get(key);

    const promise = fetchFn()
      .then(data => {
        this.set(key, data);
        return data;
      })
      .finally(() => {
        this.pending.delete(key);
      });

    this.pending.set(key, promise);
    return promise;
  }

  // Smart prefetch - only next 3 places
  async smartPrefetch(places, location, fetchFn) {
    const toFetch = places.slice(0, 3).filter(place => {
      const key = this.generateKey(place.name, location, 'complete');
      return !this.has(key) && !this.pending.has(key);
    });

    if (toFetch.length === 0) return;

    console.log(`Prefetching ${toFetch.length} places...`);

    // Fetch in background, don't await
    toFetch.forEach(place => {
      const key = this.generateKey(place.name, location, 'complete');
      this.fetchWithDedup(key, () => fetchFn(place.name, location)).catch(() => {});
    });
  }

  clear() {
    this.cache.clear();
    this.pending.clear();
    this.timestamps.clear();
  }

  stats() {
    return {
      cached: this.cache.size,
      pending: this.pending.size,
      maxSize: this.maxSize
    };
  }
}

export const smartCache = new SmartCache();

if (typeof window !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of smartCache.timestamps.entries()) {
      if (now - timestamp > smartCache.maxAge) {
        smartCache.delete(key);
      }
    }
  }, 300000);
}
