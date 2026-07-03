/**
 * Parse AI-generated itinerary markdown into structured sections
 * for rendering as native UI components.
 *
 * Handles multiple AI output formats:
 * - ## Day N: Title / ### Morning / **Place** - Desc (standard)
 * - **Must-see highlights:** + bullet lists
 * - **Local Experiences:** + bullet lists
 * - Numbered lists: 1. Place Name
 * - Free-text paragraphs with place mentions
 * - Bold-header sub-sections within time slots
 * - Variations in heading levels and formatting
 */

export interface Activity {
  name: string;
  description: string;
  duration?: string;
  cost?: string;
}

export interface TimeSection {
  timeSlot: string;
  activities: Activity[];
}

export interface ItineraryDay {
  dayNumber: number;
  title: string;
  sections: TimeSection[];
  rawContent: string;
}

export interface TipSection {
  category: string;
  emoji: string;
  items: string[];
}

export interface ParsedItinerary {
  title: string;
  overview: string;
  meta: {
    bestTime?: string;
    duration?: string;
    budget?: string;
    transport?: string;
  };
  days: ItineraryDay[];
  tips: TipSection[];
}

const TIP_EMOJIS: Record<string, string> = {
  'getting around': '\uD83D\uDE97',
  'transportation': '\uD83D\uDE8C',
  'transport': '\uD83D\uDE8C',
  'where to stay': '\uD83C\uDFE8',
  'accommodation': '\uD83C\uDFE8',
  'stay': '\uD83C\uDFE8',
  'food': '\uD83C\uDF7D\uFE0F',
  'food recommendations': '\uD83C\uDF7D\uFE0F',
  'local cuisine': '\uD83C\uDF7D\uFE0F',
  'local food': '\uD83C\uDF7D\uFE0F',
  'what to pack': '\uD83C\uDF92',
  'packing': '\uD83C\uDF92',
  'budget': '\uD83D\uDCB0',
  'budget tips': '\uD83D\uDCB0',
  'money': '\uD83D\uDCB0',
  'safety': '\u26A0\uFE0F',
  'safety tips': '\u26A0\uFE0F',
  'cultural tips': '\uD83C\uDFAD',
  'culture': '\uD83C\uDFAD',
  'pro tips': '\uD83D\uDCA1',
  'important notes': '\uD83D\uDCCC',
  'important': '\uD83D\uDCCC',
  'shopping': '\uD83D\uDED2',
  'nightlife': '\uD83C\uDF1F',
  'general tips': '\uD83D\uDCDD',
  'tips': '\uD83D\uDCDD',
  'note': '\uD83D\uDCDD',
};

function getEmojiForCategory(category: string): string {
  const lower = category.toLowerCase().trim();
  for (const [key, emoji] of Object.entries(TIP_EMOJIS)) {
    if (lower.includes(key)) return emoji;
  }
  return '\uD83D\uDCDD';
}

/** Check if a bold line is a section header like "Must-see highlights:" rather than an activity */
function isSectionHeader(boldText: string): boolean {
  const lower = boldText.toLowerCase();
  const headerPatterns = [
    'must-see', 'highlights', 'local experience', 'top highlight',
    'key attraction', 'recommended', 'don\'t miss', 'best place',
    'where to eat', 'where to stay', 'getting around',
    'accommodation', 'transportation', 'travel tip',
    'pro tip', 'budget tip', 'cultural tip', 'important note',
    'what to pack', 'safety', 'morning', 'afternoon', 'evening',
    'night', 'lunch', 'breakfast', 'dinner',
  ];
  return headerPatterns.some(p => lower.includes(p));
}

function extractMeta(overview: string): ParsedItinerary['meta'] {
  const meta: ParsedItinerary['meta'] = {};

  // Flexible meta extraction: handles both bold and non-bold, bullet and non-bullet
  const extractMetaValue = (keyPattern: string): string | undefined => {
    const regex = new RegExp(
      `(?:^|\\n)[-*]*\\s*\\**(?:${keyPattern})\\**[:\\s]+(.+?)(?:\\n|$)`,
      'im'
    );
    const match = overview.match(regex);
    return match ? match[1].replace(/\*\*/g, '').trim() : undefined;
  };

  meta.bestTime = extractMetaValue('Best Time(?:\\s+to\\s+Visit)?');
  meta.duration = extractMetaValue('Duration');
  meta.budget = extractMetaValue('Budget');
  meta.transport = extractMetaValue('Transport(?:\\s+Mode)?');

  return meta;
}

function extractDurationFromText(text: string): { duration?: string; cleaned: string } {
  let duration: string | undefined;
  let cleaned = text;

  // Match (2-3 hours), (~2h), (1 hour), (30 min), (2-3 hrs)
  const durMatch = cleaned.match(/\(([^)]*(?:hour|hr|min|hrs)[^)]*)\)/i);
  if (durMatch) {
    duration = durMatch[1].trim();
    cleaned = cleaned.replace(durMatch[0], '').trim();
  }
  return { duration, cleaned };
}

function extractCostFromText(text: string): { cost?: string; cleaned: string } {
  let cost: string | undefined;
  let cleaned = text;

  // Match (₹500), (Free), (Rs. 200), (INR 500), (Entry: ₹50)
  const costMatch = cleaned.match(/\(([^)]*(?:\u20B9|Rs\.?|INR|Free|free|Entry|entry|\$|USD)[^)]*)\)/i);
  if (costMatch) {
    cost = costMatch[1].trim();
    cleaned = cleaned.replace(costMatch[0], '').trim();
  }
  return { cost, cleaned };
}

function parseActivityFromLine(trimmed: string): Activity | null {
  // Skip empty lines, horizontal rules, section dividers
  if (!trimmed || trimmed === '---' || trimmed === '***') return null;

  // 1. Match **Bold Name** - Description or **Bold Name**: Description
  const boldDashMatch = trimmed.match(
    /^\s*(?:[-*\u2022]\s+)?\*\*([^*]+)\*\*\s*[-:\u2013\u2014]+\s*(.*)/
  );
  if (boldDashMatch) {
    const name = boldDashMatch[1].trim();
    // Skip section headers like "**Must-see highlights:**"
    if (isSectionHeader(name)) return null;
    let description = boldDashMatch[2].trim();
    const dur = extractDurationFromText(description);
    description = dur.cleaned;
    const costResult = extractCostFromText(description);
    description = costResult.cleaned.replace(/[.]+$/, '').trim();
    return { name, description, duration: dur.duration, cost: costResult.cost };
  }

  // 2. Match **Bold Name** (without dash/colon - standalone bold on bullet line)
  const boldOnlyMatch = trimmed.match(/^\s*(?:[-*\u2022]\s+)?\*\*([^*]+)\*\*\s*$/);
  if (boldOnlyMatch) {
    const name = boldOnlyMatch[1].trim();
    if (isSectionHeader(name)) return null;
    if (name.length > 3 && name.length < 150) {
      return { name, description: '' };
    }
  }

  // 3. Match **Bold Name** followed by text (without explicit separator)
  const boldTextMatch = trimmed.match(/^\s*(?:[-*\u2022]\s+)?\*\*([^*]+)\*\*\s+(.*)/);
  if (boldTextMatch) {
    const name = boldTextMatch[1].trim();
    if (isSectionHeader(name)) return null;
    let description = boldTextMatch[2].trim();
    const dur = extractDurationFromText(description);
    description = dur.cleaned;
    const costResult = extractCostFromText(description);
    description = costResult.cleaned.replace(/[.]+$/, '').trim();
    return { name, description, duration: dur.duration, cost: costResult.cost };
  }

  // 4. Match numbered lists: 1. Place Name - Description or 1. **Place Name** - Description
  const numberedMatch = trimmed.match(/^\d+[.)]\s+(.*)/);
  if (numberedMatch) {
    const rest = numberedMatch[1].trim();
    // Check if it has bold
    const numberedBold = rest.match(/\*\*([^*]+)\*\*\s*[-:\u2013\u2014]*\s*(.*)/);
    if (numberedBold) {
      const name = numberedBold[1].trim();
      if (!isSectionHeader(name)) {
        let description = numberedBold[2].trim();
        const dur = extractDurationFromText(description);
        description = dur.cleaned;
        const costResult = extractCostFromText(description);
        description = costResult.cleaned.replace(/[.]+$/, '').trim();
        return { name, description, duration: dur.duration, cost: costResult.cost };
      }
    } else if (rest.length > 3 && rest.length < 200) {
      // Plain numbered: "1. Visit Temple of Virupaksha"
      const parts = rest.split(/\s*[-:\u2013\u2014]\s*/);
      const name = parts[0].trim();
      const description = parts.slice(1).join(' - ').trim();
      return { name, description };
    }
  }

  // 5. Match bullet points with content: - Place Name or * Place Name
  const bulletMatch = trimmed.match(/^[-*\u2022]\s+(.+)/);
  if (bulletMatch) {
    const text = bulletMatch[1].trim();
    // Skip checklist items like "[ ] Pack sunscreen"
    if (text.startsWith('[ ]') || text.startsWith('[x]')) return null;
    // Skip very short or very long items
    if (text.length <= 3 || text.length > 300) return null;
    // Split on dash/colon for name - description
    const parts = text.split(/\s*[-:\u2013\u2014]\s*/);
    const name = parts[0].replace(/\*\*/g, '').trim();
    if (!name || name.length < 2) return null;
    const description = parts.slice(1).join(' - ').replace(/\*\*/g, '').trim();
    const dur = extractDurationFromText(description || text);
    const costResult = extractCostFromText(dur.cleaned);
    return {
      name,
      description: costResult.cleaned.replace(/[.]+$/, '').trim(),
      duration: dur.duration,
      cost: costResult.cost,
    };
  }

  // 6. Match blockquote tips: > **Pro Tip:** Some useful tip
  const quoteMatch = trimmed.match(/^>\s*\*\*([^*]+)\*\*[:\s]*(.*)/);
  if (quoteMatch) {
    return {
      name: quoteMatch[1].trim(),
      description: quoteMatch[2].replace(/\*\*/g, '').trim(),
    };
  }

  return null;
}

function parseActivities(content: string): Activity[] {
  const activities: Activity[] = [];
  const lines = content.split('\n');
  const seenNames = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;

    // Skip horizontal rules and section dividers
    if (/^[-*_]{3,}$/.test(trimmed)) continue;

    // Skip pure section header lines like "**Must-see highlights:**" but parse items after them
    const pureHeaderMatch = trimmed.match(/^\*\*([^*]+)\*\*[:\s]*$/);
    if (pureHeaderMatch && isSectionHeader(pureHeaderMatch[1])) {
      continue;
    }

    const activity = parseActivityFromLine(trimmed);
    if (activity && activity.name.length >= 2) {
      // De-duplicate by name
      const nameKey = activity.name.toLowerCase();
      if (!seenNames.has(nameKey)) {
        seenNames.add(nameKey);
        activities.push(activity);
      }
    }
  }

  return activities;
}

/** Determine time slot category from a heading line */
function classifyTimeSlot(slotLine: string): string {
  const lower = slotLine.toLowerCase();
  if (/morning|sunrise|early|8.*am|9.*am|10.*am/i.test(lower)) return 'Morning';
  if (/afternoon|1.*pm|2.*pm|3.*pm|4.*pm|5.*pm/i.test(lower)) return 'Afternoon';
  if (/evening|sunset|6.*pm|7.*pm|8.*pm|9.*pm|dusk/i.test(lower)) return 'Evening';
  if (/night|10.*pm|11.*pm|nightlife|after dark/i.test(lower)) return 'Night';
  if (/lunch|midday|noon|12.*pm/i.test(lower)) return 'Lunch';
  if (/breakfast|brunch/i.test(lower)) return 'Morning';
  if (/dinner/i.test(lower)) return 'Evening';
  return slotLine.replace(/\*\*/g, '').replace(/[()]/g, '').trim();
}

function parseDayContent(content: string, dayNumber: number): ItineraryDay {
  // Extract day title from first line
  const firstLine = content.split('\n')[0].trim();
  const titleMatch = firstLine.match(/Day\s+\d+[:\s\u2013\u2014]*(.*)/i);
  const title = titleMatch
    ? titleMatch[1].replace(/\*\*/g, '').trim()
    : `Day ${dayNumber}`;

  // Split by ### for time sections
  const timeParts = content.split(/^###\s+/m);
  const sections: TimeSection[] = [];

  // Content before first ### (between day header and first ### section)
  const preamble = timeParts[0];
  const preambleContent = preamble.substring(firstLine.length);

  for (let i = 1; i < timeParts.length; i++) {
    const part = timeParts[i];
    const slotLine = part.split('\n')[0].trim();
    const slotContent = part.substring(slotLine.length);
    const timeSlot = classifyTimeSlot(slotLine);
    const activities = parseActivities(slotContent);

    if (activities.length > 0) {
      sections.push({ timeSlot, activities });
    }
  }

  // If no ### sections found, try splitting by bold-header sub-sections
  // e.g. **Morning Activities** or **Afternoon:**
  if (sections.length === 0) {
    const boldSectionParts = content.split(/^(?=\*\*(?:Morning|Afternoon|Evening|Night|Lunch|Breakfast|Dinner)[^*]*\*\*)/im);

    for (const part of boldSectionParts) {
      const headerMatch = part.match(/^\*\*([^*]+)\*\*[:\s]*/);
      if (headerMatch) {
        const timeSlot = classifyTimeSlot(headerMatch[1]);
        const activities = parseActivities(part.substring(headerMatch[0].length));
        if (activities.length > 0) {
          sections.push({ timeSlot, activities });
        }
      }
    }
  }

  // If still no sections, try splitting by inline time markers
  // e.g. "Morning:" or "Afternoon -" as plain text headers
  if (sections.length === 0) {
    const inlineTimeParts = content.split(/\n(?=(?:Morning|Afternoon|Evening|Night)\s*[:\u2013\u2014-])/i);

    for (const part of inlineTimeParts) {
      const inlineHeader = part.match(/^(Morning|Afternoon|Evening|Night)\s*[:\u2013\u2014-]\s*/i);
      if (inlineHeader) {
        const timeSlot = classifyTimeSlot(inlineHeader[1]);
        const activities = parseActivities(part.substring(inlineHeader[0].length));
        if (activities.length > 0) {
          sections.push({ timeSlot, activities });
        }
      }
    }
  }

  // If STILL no sections, parse everything as activities in one generic section
  if (sections.length === 0) {
    const allContent = content.substring(firstLine.length);
    const activities = parseActivities(allContent);
    if (activities.length > 0) {
      sections.push({ timeSlot: 'Activities', activities });
    }
  }

  // Also check preamble content (text before first ### section) for activities
  // that might be listed between the day header and the first time section
  if (preambleContent.trim() && timeParts.length > 1) {
    const preambleActivities = parseActivities(preambleContent);
    if (preambleActivities.length > 0) {
      // Add preamble activities to the first section or create an "Overview" section
      const existingNames = new Set(
        sections.flatMap(s => s.activities.map(a => a.name.toLowerCase()))
      );
      const uniquePreamble = preambleActivities.filter(
        a => !existingNames.has(a.name.toLowerCase())
      );
      if (uniquePreamble.length > 0) {
        sections.unshift({ timeSlot: 'Highlights', activities: uniquePreamble });
      }
    }
  }

  return { dayNumber, title, sections, rawContent: content };
}

function parseTips(content: string): TipSection[] {
  const tips: TipSection[] = [];

  // Split by ### for tip categories
  const parts = content.split(/^###\s+/m);

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    const category = part.split('\n')[0].trim();
    const body = part.substring(category.length);

    const items: string[] = [];
    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Bullet items
      const bulletMatch = trimmed.match(/^[-*\u2022]\s+(.*)/);
      if (bulletMatch) {
        const item = bulletMatch[1].replace(/\*\*/g, '').trim();
        if (item.length > 2) items.push(item);
        continue;
      }

      // Checklist items: [ ] or [x]
      const checkMatch = trimmed.match(/^[-*]?\s*\[[ x]\]\s+(.*)/i);
      if (checkMatch) {
        const item = checkMatch[1].replace(/\*\*/g, '').trim();
        if (item.length > 2) items.push(item);
        continue;
      }

      // Blockquote tips: > **Pro Tip:** advice
      const quoteMatch = trimmed.match(/^>\s*(.*)/);
      if (quoteMatch) {
        const item = quoteMatch[1].replace(/\*\*/g, '').trim();
        if (item.length > 2) items.push(item);
        continue;
      }

      // Numbered lists: 1. item
      const numberedMatch = trimmed.match(/^\d+[.)]\s+(.*)/);
      if (numberedMatch) {
        const item = numberedMatch[1].replace(/\*\*/g, '').trim();
        if (item.length > 2) items.push(item);
        continue;
      }

      // Bold key-value: **Key:** Value
      const boldKvMatch = trimmed.match(/^\*\*([^*]+)\*\*[:\s]+(.*)/);
      if (boldKvMatch) {
        const item = `${boldKvMatch[1]}: ${boldKvMatch[2]}`.replace(/\*\*/g, '').trim();
        if (item.length > 2) items.push(item);
      }
    }

    if (items.length > 0) {
      tips.push({
        category: category.replace(/\*\*/g, '').replace(/[:\u2013\u2014-]+$/, '').trim(),
        emoji: getEmojiForCategory(category),
        items,
      });
    }
  }

  // If no ### sections, try bold headers as tip categories
  if (tips.length === 0) {
    const boldParts = content.split(/\n(?=\*\*[^*]+\*\*[:\s])/);
    for (const part of boldParts) {
      const headerMatch = part.match(/^\*\*([^*]+)\*\*[:\s]*(.*)/);
      if (headerMatch) {
        const category = headerMatch[1].trim();
        const items: string[] = [];
        const bodyLines = part.substring(headerMatch[0].length).split('\n');

        // Include the text after the bold header if present
        if (headerMatch[2]?.trim()) {
          items.push(headerMatch[2].replace(/\*\*/g, '').trim());
        }

        for (const line of bodyLines) {
          const trimmed = line.trim();
          const bulletMatch = trimmed.match(/^[-*\u2022]\s+(.*)/);
          if (bulletMatch) {
            const item = bulletMatch[1].replace(/\*\*/g, '').trim();
            if (item.length > 2) items.push(item);
          }
        }

        if (items.length > 0) {
          tips.push({
            category: category.replace(/[:\u2013\u2014-]+$/, '').trim(),
            emoji: getEmojiForCategory(category),
            items,
          });
        }
      }
    }
  }

  // Last resort: extract all bullet points as a general tips section
  if (tips.length === 0) {
    const items: string[] = [];
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      const bulletMatch = trimmed.match(/^[-*\u2022]\s+(.*)/);
      if (bulletMatch) {
        const item = bulletMatch[1].replace(/\*\*/g, '').trim();
        if (item.length > 2) items.push(item);
      }
    }
    if (items.length > 0) {
      tips.push({ category: 'Travel Tips', emoji: '\uD83E\uDDED', items });
    }
  }

  return tips;
}

export function parseMarkdown(markdown: string): ParsedItinerary {
  if (!markdown || typeof markdown !== 'string') {
    return { title: 'Itinerary', overview: '', meta: {}, days: [], tips: [] };
  }

  // Normalize line endings
  const normalized = markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split on ## headings
  const sections = normalized.split(/^##\s+/m);

  // First section before any ## is the title area
  const titleSection = sections[0] || '';
  const titleMatch = titleSection.match(/^#\s+(.+)/m);
  const title = titleMatch
    ? titleMatch[1].replace(/\*\*/g, '').trim()
    : 'Your Itinerary';

  let overview = '';
  const days: ItineraryDay[] = [];
  const tipSections: string[] = [];

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const firstLine = section.split('\n')[0].trim();

    // Check if this is a day section: "Day 1: ..." or "Day 1 -" or "Day 1"
    const dayMatch = firstLine.match(/^Day\s+(\d+)/i);
    if (dayMatch) {
      const dayNumber = parseInt(dayMatch[1], 10);
      days.push(parseDayContent(section, dayNumber));
      continue;
    }

    // Check if this is an overview/intro section (only before first day)
    if (/^(?:overview|introduction|about|summary|trip\s+overview)/i.test(firstLine) && days.length === 0) {
      overview = section.substring(firstLine.length).trim();
      continue;
    }

    // Check if this is a tips/travel tips section (after days)
    if (days.length > 0) {
      tipSections.push(section);
    } else {
      // Before first day — part of overview
      overview += '\n' + section;
    }
  }

  // --- Fallback: If no days found via ## splitting, try other day formats ---
  if (days.length === 0) {
    // Try **Day 1:** or **Day 1 -** format (bold day headers without ##)
    const boldDayParts = normalized.split(/\n(?=\*\*Day\s+\d+)/i);
    for (const part of boldDayParts) {
      const boldDayMatch = part.match(/^\*\*Day\s+(\d+)[^*]*\*\*[:\s\u2013\u2014-]*(.*)/i);
      if (boldDayMatch) {
        const dayNumber = parseInt(boldDayMatch[1], 10);
        const dayTitle = boldDayMatch[2]?.replace(/\*\*/g, '').trim() || `Day ${dayNumber}`;
        const dayContent = part.substring(boldDayMatch[0].length);
        const activities = parseActivities(dayContent);
        const sections: TimeSection[] = [];
        if (activities.length > 0) {
          sections.push({ timeSlot: 'Activities', activities });
        }
        days.push({ dayNumber, title: dayTitle, sections, rawContent: part });
      }
    }
  }

  // Try plain "Day 1:" format (no ## or **)
  if (days.length === 0) {
    const plainDayParts = normalized.split(/\n(?=Day\s+\d+\s*[:\u2013\u2014-])/i);
    for (const part of plainDayParts) {
      const plainDayMatch = part.match(/^Day\s+(\d+)\s*[:\u2013\u2014-]\s*(.*)/i);
      if (plainDayMatch) {
        const dayNumber = parseInt(plainDayMatch[1], 10);
        const dayTitle = plainDayMatch[2]?.replace(/\*\*/g, '').trim() || `Day ${dayNumber}`;
        const dayContent = part.substring(plainDayMatch[0].length);
        const activities = parseActivities(dayContent);
        const sections: TimeSection[] = [];
        if (activities.length > 0) {
          sections.push({ timeSlot: 'Activities', activities });
        }
        days.push({ dayNumber, title: dayTitle, sections, rawContent: part });
      }
    }
  }

  // If no explicit overview section, use text between title and first day
  if (!overview.trim() && titleSection) {
    const afterTitle = titleSection.replace(/^#\s+.+/m, '').trim();
    if (afterTitle) overview = afterTitle;
  }

  // Extract meta from overview or title section
  const meta = extractMeta(overview || titleSection);

  // Parse tips from all sections after last day
  const tips = tipSections.length > 0
    ? parseTips(tipSections.join('\n## '))
    : [];

  return { title, overview: overview.trim(), meta, days, tips };
}
