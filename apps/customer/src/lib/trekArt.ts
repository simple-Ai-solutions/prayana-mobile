// Commissioned poster art and clips for the home trekking rail, ported from
// the web's components/activities/trekArt.js. Keep it in step with the web.
// Matched on the title because the location fields are unreliable
// (Netravathi is filed under Bengaluru). The trek poster card plays only
// these clips, as the web's does: no stock filler.

const TREK_CDN = 'https://prayanaai.com/images/treks';

type TrekArt = { poster: string | null; video: string | null };

// `video` is the 720p encode the web serves to phones.
const ART: (TrekArt & { test: RegExp })[] = [
  { test: /ballarayana/i, poster: `${TREK_CDN}/ballarayana-durga-card.webp`, video: `${TREK_CDN}/ballarayana-durga.mp4` },
  { test: /kodaikanal/i, poster: `${TREK_CDN}/kodaikanal-card.webp`, video: `${TREK_CDN}/kodaikanal.mp4` },
  { test: /nelji/i, poster: `${TREK_CDN}/nelji-hill-card.webp`, video: null },
  { test: /dudhsagar/i, poster: `${TREK_CDN}/dudhsagar-card.webp`, video: `${TREK_CDN}/dudhsagar.mp4` },
  { test: /kurinjal/i, poster: `${TREK_CDN}/kurinjal-peak-card.webp`, video: `${TREK_CDN}/kurinjal-peak.mp4` },
  // Story reels keep the operator's own photo as the still.
  { test: /gangadikal/i, poster: null, video: `${TREK_CDN}/gangadikal-reel.mp4` },
  { test: /bandaje/i, poster: null, video: `${TREK_CDN}/bandaje-reel.mp4` },
  { test: /didupe|ermayi/i, poster: null, video: `${TREK_CDN}/didupe-ermayi-reel.mp4` },
  { test: /mullayanagiri/i, poster: null, video: `${TREK_CDN}/chikmagalur-reel.mp4` },
];

/** Commissioned art for this trek, or null when it uses its own photos. */
export function trekArtFor(activity: { title?: string } = {}): TrekArt | null {
  const hit = ART.find((a) => a.test.test(activity.title || ''));
  return hit ? { poster: hit.poster, video: hit.video } : null;
}
