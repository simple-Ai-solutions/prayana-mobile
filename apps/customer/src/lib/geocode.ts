// Turn a trip's place name into coordinates for the weather (Open-Meteo's
// free geocoder). Searching by name alone is unreliable for travel names:
// "Goa" comes back as Genoa, Italy, or a village in Rajasthan; "Manali" as a
// Chennai suburb; "Coorg" not at all. So popular trip names map to the town
// that stands for them, and otherwise the biggest matching town wins,
// preferring India when it has a real match.
type Hit = { latitude: number; longitude: number; name: string; admin1?: string; country_code?: string; population?: number };

const ALIASES: Record<string, { name: string; admin1: string }> = {
  goa: { name: 'Panjim', admin1: 'Goa' },
  kerala: { name: 'Kochi', admin1: 'Kerala' },
  coorg: { name: 'Madikeri', admin1: 'Karnataka' },
  kodagu: { name: 'Madikeri', admin1: 'Karnataka' },
  manali: { name: 'Manali', admin1: 'Himachal Pradesh' },
  ooty: { name: 'Ooty', admin1: 'Tamil Nadu' },
  andaman: { name: 'Port Blair', admin1: 'Andaman and Nicobar' },
  'andaman & nicobar islands': { name: 'Port Blair', admin1: 'Andaman and Nicobar' },
  kashmir: { name: 'Srinagar', admin1: 'Jammu and Kashmir' },
  ladakh: { name: 'Leh', admin1: 'Ladakh' },
  'leh-ladakh': { name: 'Leh', admin1: 'Ladakh' },
  'jim corbett': { name: 'Ramnagar', admin1: 'Uttarakhand' },
  munnar: { name: 'Munnar', admin1: 'Kerala' },
  rishikesh: { name: 'Rishikesh', admin1: 'Uttarakhand' },
  shimla: { name: 'Shimla', admin1: 'Himachal Pradesh' },
  darjeeling: { name: 'Darjeeling', admin1: 'West Bengal' },
  hampi: { name: 'Hampi', admin1: 'Karnataka' },
  chikmagalur: { name: 'Chikkamagaluru', admin1: 'Karnataka' },
};

async function search(name: string, countryCode?: string): Promise<Hit[]> {
  const cc = countryCode ? `&countryCode=${countryCode}` : '';
  const r = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=10&language=en${cc}`,
  ).then((x) => x.json());
  return Array.isArray(r?.results) ? r.results : [];
}

const biggest = (hits: Hit[]) => [...hits].sort((a, b) => (b.population || 0) - (a.population || 0))[0];

const cache = new Map<string, Promise<Hit | null>>();

export function geocodePlace(place: string): Promise<Hit | null> {
  const key = place.trim().toLowerCase();
  if (!key) return Promise.resolve(null);
  if (!cache.has(key)) {
    cache.set(key, (async () => {
      try {
        const alias = ALIASES[key];
        if (alias) {
          const hits = await search(alias.name, 'IN');
          const hit = hits.find((h) => h.admin1?.toLowerCase().startsWith(alias.admin1.toLowerCase()));
          if (hit) return hit;
        }
        const india = (await search(place, 'IN')).filter((h) => (h.population || 0) >= 20000);
        if (india.length) return biggest(india);
        const world = await search(place);
        return world.length ? biggest(world) : null;
      } catch {
        cache.delete(key);
        return null;
      }
    })());
  }
  return cache.get(key)!;
}
