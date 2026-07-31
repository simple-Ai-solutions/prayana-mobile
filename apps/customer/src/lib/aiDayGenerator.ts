// aiDayGenerator — the shared AI day-planning engine for the mobile trip planner.
//
// Mirrors the web's components/create-trip/ai/generateDayItinerary.js: build a
// destination-specific prompt, call POST /ai/generate in parallel with a DB
// image search, parse the JSON, dedupe against already-planned places, and
// enrich each suggestion with an image. Extracted from planner.tsx's
// handleGenerateAI so the same logic powers the manual button, the Auto-Plan-Day
// modal, AND auto-plan-on-arrival (which the mobile app was missing — the web
// auto-builds every empty day on entering the planner, so mobile felt like it
// "wasn't getting AI suggestions").

import { makeAPICall } from '@prayana/shared-services';

export type SlotKey = 'morning' | 'afternoon' | 'evening' | 'night';
export const SLOTS: SlotKey[] = ['morning', 'afternoon', 'evening', 'night'];

export interface AiSuggestion {
  name: string;
  description: string;
  timeSlot: SlotKey;
  duration: number;
  rating: number;
  category: string;
  image: string;
  images: any[];
  imageUrls: string[];
}

interface GenerateParams {
  destinationName: string;
  dayNumber: number;
  tripType?: string;
  budget?: string;
  /** Names already on this (or prior) days — never suggested again. */
  excludeNames?: string[];
}

/** Build the same comprehensive, real-places prompt the PWA uses. */
function buildPrompt({ destinationName, dayNumber, tripType, budget, excludeNames }: GenerateParams): string {
  const exclude = excludeNames?.length ? excludeNames.join(', ') : 'none';
  return `You are an expert travel guide for ${destinationName}.

Suggest the BEST places to visit in ${destinationName} on Day ${dayNumber} of a ${tripType || 'leisure'} trip. Budget: ${budget || 'moderate'}.

ALREADY PLANNED (skip these): ${exclude}

Rules:
- Only suggest REAL places that exist in ${destinationName}
- Use EXACT local names (e.g., "Virupaksha Temple" not "a temple")
- Suggest 3-5 places per time slot
- Mix categories: landmarks, food, nature, culture

Return ONLY valid JSON (no markdown, no explanation, no code blocks):
{"morning":[{"name":"Place Name","description":"Why visit","category":"temple","duration":2,"rating":4.5}],"afternoon":[...],"evening":[...],"night":[...]}`;
}

/** Pull the DB place list (for images) out of the hierarchical-search shape. */
function extractDbPlaces(dbResult: any): any[] {
  if (!dbResult?.success) return [];
  const d = dbResult.data;
  if (Array.isArray(d)) return d;
  if (Array.isArray(d?.results)) return d.results;
  const out: any[] = [];
  if (d?.hero) out.push(d.hero);
  if (Array.isArray(d?.places)) out.push(...d.places);
  if (d && typeof d === 'object') {
    for (const key of Object.keys(d)) {
      if (key !== 'places' && Array.isArray(d[key]) && d[key][0]?.name) out.push(...d[key]);
    }
  }
  return out;
}

/** Parse the AI JSON (fenced or raw, object or array) into per-slot arrays. */
function parseAiPlaces(aiResponse: any): Record<SlotKey, any[]> {
  const places: Record<SlotKey, any[]> = { morning: [], afternoon: [], evening: [], night: [] };
  if (!aiResponse?.success || !aiResponse?.data) return places;

  const data = aiResponse.data;
  let text = '';
  if (typeof data === 'string') text = data;
  else if (typeof data?.text === 'string') text = data.text;
  else if (data && typeof data === 'object' && !Array.isArray(data)) {
    for (const s of SLOTS) if (Array.isArray(data[s])) places[s] = data[s];
    return places;
  }

  if (!text) return places;
  const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  const objMatch = clean.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const parsed = JSON.parse(objMatch[0]);
      for (const s of SLOTS) {
        if (Array.isArray(parsed[s])) {
          places[s] = parsed[s].map((it: any) => (typeof it === 'string' ? { name: it } : it));
        }
      }
      return places;
    } catch {
      // fall through to array fallback
    }
  }
  const arrMatch = clean.match(/\[[\s\S]*?\]/);
  if (arrMatch) {
    try {
      const arr = JSON.parse(arrMatch[0]);
      if (Array.isArray(arr)) {
        arr.forEach((it: any) => {
          const s: SlotKey = (SLOTS as string[]).includes(it.timeSlot) ? it.timeSlot : 'morning';
          places[s].push(it);
        });
      }
    } catch {
      // give up quietly — caller handles the empty result
    }
  }
  return places;
}

/**
 * Generate AI suggestions for one day. Returns a flat, image-enriched,
 * deduped list across all four time slots. Never throws for a "no results"
 * case — it returns []. It DOES throw on a hard network/timeout failure so the
 * caller can show a retry.
 */
export async function generateAiDay(params: GenerateParams): Promise<AiSuggestion[]> {
  const prompt = buildPrompt(params);

  const [aiResponse, dbResult] = await Promise.all([
    makeAPICall('/ai/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, temperature: 0.7 }),
      timeout: 60000,
    }),
    makeAPICall('/destinations/hierarchical-search', {
      method: 'POST',
      body: JSON.stringify({ query: params.destinationName, filters: { limit: 50 }, includeImages: true }),
      timeout: 25000,
    }).catch(() => null), // images only — non-critical
  ]);

  const aiPlaces = parseAiPlaces(aiResponse);
  const dbPlaces = extractDbPlaces(dbResult);
  const excludeSet = new Set((params.excludeNames || []).map((n) => n.toLowerCase()));

  const enrich = (items: any[], slot: SlotKey): AiSuggestion[] =>
    items
      .filter((it: any) => it?.name && !excludeSet.has(String(it.name).toLowerCase()))
      .map((it: any) => {
        const nameLc = String(it.name).toLowerCase();
        const dbMatch = dbPlaces.find(
          (p: any) =>
            p.name?.toLowerCase() === nameLc ||
            p.name?.toLowerCase().includes(nameLc) ||
            nameLc.includes(p.name?.toLowerCase()),
        );
        const imageUrl =
          dbMatch?.image ||
          dbMatch?.imageUrls?.[0] ||
          dbMatch?.images?.[0]?.url ||
          (typeof dbMatch?.images?.[0] === 'string' ? dbMatch.images[0] : '') ||
          '';
        return {
          name: it.name || 'Activity',
          description: it.description || it.why || dbMatch?.shortDescription || '',
          timeSlot: slot,
          duration: Number(it.duration) || 2,
          rating: Number(it.rating) || dbMatch?.rating || 4.0,
          category: it.category || dbMatch?.category || 'general',
          image: imageUrl,
          images: dbMatch?.images || [],
          imageUrls: dbMatch?.imageUrls || (imageUrl ? [imageUrl] : []),
        };
      });

  return [
    ...enrich(aiPlaces.morning, 'morning'),
    ...enrich(aiPlaces.afternoon, 'afternoon'),
    ...enrich(aiPlaces.evening, 'evening'),
    ...enrich(aiPlaces.night, 'night'),
  ];
}

/** Convert an AI suggestion into the store's activity shape. */
export function suggestionToActivity(s: AiSuggestion) {
  return {
    name: s.name,
    description: s.description || '',
    timeSlot: s.timeSlot,
    duration: s.duration || 2,
    rating: s.rating || 4.0,
    category: s.category || 'general',
    coordinates: { lat: 0, lng: 0 },
    image: s.image || '',
    images: s.images || [],
    imageUrls: s.imageUrls || [],
    notes: '',
  };
}
