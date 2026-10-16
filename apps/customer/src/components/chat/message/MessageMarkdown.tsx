// Isha's reply text. The web renders it with react-markdown + remark-gfm;
// this is a small parser for the same subset (headings, paragraphs, lists,
// quotes, rules, code, tables, bold/italic/code/links), drawn in Ink.
// A bold name that matches one of the reply's place cards asks about it.
import React, { memo, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { useIsha, type IshaPalette } from '../ishaTheme';
import { openHref } from '../links';

type Inline =
  | { t: 'text'; v: string }
  | { t: 'strong'; c: Inline[] }
  | { t: 'em'; c: Inline[] }
  | { t: 'del'; c: Inline[] }
  | { t: 'code'; v: string }
  | { t: 'link'; href: string; c: Inline[] };

type ListItem = { text: string; level: number };
type Block =
  | { t: 'h'; level: number; text: string }
  | { t: 'p'; text: string }
  | { t: 'ul'; items: ListItem[] }
  | { t: 'ol'; items: ListItem[]; start: number }
  | { t: 'quote'; text: string }
  | { t: 'hr' }
  | { t: 'code'; text: string }
  | { t: 'table'; head: string[]; rows: string[][] };

const UL = /^(\s*)[-*+•]\s+(.*)$/;
const OL = /^(\s*)(\d+)[.)]\s+(.*)$/;
const HR = /^\s*([-*_])(\s*\1){2,}\s*$/;
const HEADING = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/;
const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/;

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());

export function parseBlocks(md: string): Block[] {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    if (/^\s*```/.test(line)) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) body.push(lines[i++]);
      i++;
      blocks.push({ t: 'code', text: body.join('\n') });
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      blocks.push({ t: 'h', level: h[1].length, text: h[2] });
      i++;
      continue;
    }
    if (HR.test(line)) {
      blocks.push({ t: 'hr' });
      i++;
      continue;
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      const head = cells(line);
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(cells(lines[i++]));
      blocks.push({ t: 'table', head, rows });
      continue;
    }
    if (/^\s*>/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''));
      blocks.push({ t: 'quote', text: body.join(' ') });
      continue;
    }
    if (UL.test(line) || OL.test(line)) {
      const ordered = !UL.test(line);
      const items: ListItem[] = [];
      const start = ordered ? Number(OL.exec(line)?.[2] || 1) : 1;
      while (i < lines.length) {
        const l = lines[i];
        const m = ordered ? OL.exec(l) : UL.exec(l);
        if (m) {
          const indent = m[1].replace(/\t/g, '  ').length;
          items.push({ text: ordered ? m[3] : m[2], level: indent >= 2 ? 1 : 0 });
          i++;
          continue;
        }
        // A nested list of the other kind, or a continuation line
        const other = ordered ? UL.exec(l) : OL.exec(l);
        if (other && other[1].length >= 2) {
          items.push({ text: ordered ? other[2] : other[3], level: 1 });
          i++;
          continue;
        }
        if (l.trim() && /^\s{2,}/.test(l) && items.length) {
          items[items.length - 1].text += ` ${l.trim()}`;
          i++;
          continue;
        }
        break;
      }
      blocks.push(ordered ? { t: 'ol', items, start } : { t: 'ul', items });
      continue;
    }
    // A paragraph runs until a blank line or another block starts
    const body: string[] = [line.trim()];
    i++;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !HEADING.test(lines[i]) &&
      !UL.test(lines[i]) &&
      !OL.test(lines[i]) &&
      !/^\s*(>|```)/.test(lines[i]) &&
      !HR.test(lines[i])
    ) {
      body.push(lines[i++].trim());
    }
    blocks.push({ t: 'p', text: body.join(' ') });
  }
  return blocks;
}

// Inline: `code`, **strong**, *em* / _em_, ~~del~~, [text](url), bare links
const INLINE =
  /(`[^`]+`)|(\*\*[^*]+?\*\*|__[^_]+?__)|(~~[^~]+?~~)|(\[[^\]]+\]\([^)\s]+(?:\s+"[^"]*")?\))|(^|[\s(])(\*[^*\s][^*]*?\*|_[^_\s][^_]*?_)(?=$|[\s.,;:!?)])|(https?:\/\/[^\s)]+[^\s).,;:!?])/g;

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  // Its own copy: the nested calls below would reset a shared lastIndex
  const re = new RegExp(INLINE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // Italics keep the space or bracket before them as text
    const lead = m[6] ? m[5] || '' : '';
    const before = text.slice(last, m.index) + lead;
    if (before) out.push({ t: 'text', v: before });
    const raw = m[0].slice(lead.length);
    if (m[1]) out.push({ t: 'code', v: raw.slice(1, -1) });
    else if (m[2]) out.push({ t: 'strong', c: parseInline(raw.slice(2, -2)) });
    else if (m[3]) out.push({ t: 'del', c: parseInline(raw.slice(2, -2)) });
    else if (m[4]) {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)/.exec(raw);
      out.push({ t: 'link', href: lm?.[2] || '', c: parseInline(lm?.[1] || '') });
    } else if (m[6]) out.push({ t: 'em', c: parseInline(raw.slice(1, -1)) });
    else if (m[7]) out.push({ t: 'link', href: raw, c: [{ t: 'text', v: raw }] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
  return out;
}

const plainOf = (nodes: Inline[]): string =>
  nodes.map((n) => (n.t === 'text' || n.t === 'code' ? n.v : plainOf(n.c))).join('');

type Ctx = {
  t: IshaPalette;
  placeNames: Set<string>;
  onAskAbout?: (name: string) => void;
  onLink: (href: string) => void;
};

function renderInline(nodes: Inline[], ctx: Ctx, keyBase = 'i'): React.ReactNode[] {
  const { t } = ctx;
  return nodes.map((n, idx) => {
    const key = `${keyBase}-${idx}`;
    switch (n.t) {
      case 'text':
        return n.v;
      case 'code':
        return (
          <Text key={key} style={[s.inlineCode, { backgroundColor: t.sunken, color: t.body }]}>
            {` ${n.v} `}
          </Text>
        );
      case 'em':
        return (
          <Text key={key} style={s.em}>
            {renderInline(n.c, ctx, key)}
          </Text>
        );
      case 'del':
        return (
          <Text key={key} style={s.del}>
            {renderInline(n.c, ctx, key)}
          </Text>
        );
      case 'link':
        return (
          <Text
            key={key}
            onPress={() => ctx.onLink(n.href)}
            suppressHighlighting={false}
            style={[s.link, { color: t.text, textDecorationColor: t.faint }]}
          >
            {renderInline(n.c, ctx, key)}
          </Text>
        );
      case 'strong': {
        const text = plainOf(n.c);
        if (/^Day\s+\d+/i.test(text)) {
          return (
            <Text key={key} style={[s.dayChip, { backgroundColor: t.sunken, color: t.text }]}>
              {` ${text} `}
            </Text>
          );
        }
        if (text && ctx.onAskAbout && ctx.placeNames.has(text.toLowerCase())) {
          return (
            <Text
              key={key}
              onPress={() => ctx.onAskAbout?.(text)}
              style={[s.strong, s.askable, { color: t.text, textDecorationColor: t.borderStrong }]}
              accessibilityRole="button"
              accessibilityHint={`Ask Isha about ${text}`}
            >
              {renderInline(n.c, ctx, key)}
            </Text>
          );
        }
        return (
          <Text key={key} style={[s.strong, { color: t.text }]}>
            {renderInline(n.c, ctx, key)}
          </Text>
        );
      }
      default:
        return null;
    }
  });
}

function MessageMarkdown({
  content,
  topPlaces,
  onAskAbout,
  streaming = false,
  textStyle,
}: {
  content: string;
  topPlaces?: Array<{ name?: string }>;
  onAskAbout?: (name: string) => void;
  streaming?: boolean;
  textStyle?: TextStyle;
}) {
  const t = useIsha();
  const router = useRouter();
  const blocks = useMemo(() => parseBlocks(content), [content]);
  const placeNames = useMemo(
    () => new Set((topPlaces || []).map((p) => String(p?.name || '').toLowerCase()).filter(Boolean)),
    [topPlaces],
  );
  const ctx: Ctx = { t, placeNames, onAskAbout, onLink: (href) => openHref(router, href) };
  const body: TextStyle = { color: t.body, ...s.body, ...textStyle };
  // Isha's typing cursor, after the last word of the last block
  const cursor = streaming ? <Text style={{ color: t.text }}> ▍</Text> : null;

  return (
    <View>
      {blocks.map((b, bi) => {
        const isLast = bi === blocks.length - 1;
        const tail = isLast ? cursor : null;
        const first = bi === 0;
        switch (b.t) {
          case 'h':
            return (
              <Text
                key={bi}
                style={[
                  b.level <= 2 ? s.h2 : s.h3,
                  { color: t.text, marginTop: first ? 0 : b.level <= 2 ? 14 : 10 },
                ]}
                accessibilityRole="header"
              >
                {renderInline(parseInline(b.text), ctx, `h${bi}`)}
                {tail}
              </Text>
            );
          case 'p':
            return (
              <Text key={bi} style={[body, { marginTop: first ? 0 : 8 }]}>
                {renderInline(parseInline(b.text), ctx, `p${bi}`)}
                {tail}
              </Text>
            );
          case 'ul':
          case 'ol':
            return (
              <View key={bi} style={{ marginTop: first ? 0 : 8, gap: 4 }}>
                {b.items.map((item, ii) => (
                  <View key={ii} style={[s.li, { paddingLeft: item.level ? 18 : 0 }]}>
                    <Text style={[body, s.marker, { color: t.faint }]}>
                      {b.t === 'ol' ? `${b.start + ii}.` : item.level ? '◦' : '•'}
                    </Text>
                    <Text style={[body, s.liText]}>
                      {renderInline(parseInline(item.text), ctx, `l${bi}-${ii}`)}
                      {isLast && ii === b.items.length - 1 ? tail : null}
                    </Text>
                  </View>
                ))}
              </View>
            );
          case 'quote':
            return (
              <View key={bi} style={[s.quote, { borderLeftColor: t.borderStrong, marginTop: first ? 0 : 8 }]}>
                <Text style={[body, { color: t.muted }]}>
                  {renderInline(parseInline(b.text), ctx, `q${bi}`)}
                  {tail}
                </Text>
              </View>
            );
          case 'hr':
            return <View key={bi} style={[s.hr, { backgroundColor: t.border }]} />;
          case 'code':
            return (
              <ScrollView
                key={bi}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[s.codeBlock, { backgroundColor: t.sunken, marginTop: first ? 0 : 8 }]}
              >
                <Text style={[s.mono, { color: t.body }]}>{b.text}</Text>
              </ScrollView>
            );
          case 'table':
            return (
              <ScrollView
                key={bi}
                horizontal
                showsHorizontalScrollIndicator={false}
                style={[s.table, { borderColor: t.border, marginTop: first ? 0 : 8 }]}
              >
                <View>
                  <View style={[s.tr, { backgroundColor: t.surfaceMuted, borderBottomColor: t.border }]}>
                    {b.head.map((c, ci) => (
                      <Text key={ci} style={[s.td, s.th, { color: t.text }]}>
                        {renderInline(parseInline(c), ctx, `th${bi}-${ci}`)}
                      </Text>
                    ))}
                  </View>
                  {b.rows.map((row, ri) => (
                    <View
                      key={ri}
                      style={[s.tr, { borderBottomColor: ri === b.rows.length - 1 ? 'transparent' : t.divider }]}
                    >
                      {b.head.map((_, ci) => (
                        <Text key={ci} style={[s.td, { color: t.body }]}>
                          {renderInline(parseInline(row[ci] || ''), ctx, `td${bi}-${ri}-${ci}`)}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            );
          default:
            return null;
        }
      })}
      {!blocks.length && cursor ? <Text style={body}>{cursor}</Text> : null}
    </View>
  );
}

export default memo(MessageMarkdown);

const s = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 24 },
  h2: { fontSize: 16, lineHeight: 22, fontWeight: '600', marginBottom: 2 },
  h3: { fontSize: 15, lineHeight: 21, fontWeight: '600', marginBottom: 2 },
  strong: { fontWeight: '600' },
  askable: { textDecorationLine: 'underline', textDecorationStyle: 'dotted' },
  em: { fontStyle: 'italic' },
  del: { textDecorationLine: 'line-through' },
  link: { fontWeight: '500', textDecorationLine: 'underline' },
  inlineCode: { fontFamily: 'Courier', fontSize: 13 },
  dayChip: { fontSize: 13, fontWeight: '600' },
  li: { flexDirection: 'row', alignItems: 'flex-start' },
  marker: { width: 20 },
  liText: { flex: 1 },
  quote: { borderLeftWidth: 2, paddingLeft: 12 },
  hr: { height: StyleSheet.hairlineWidth, marginVertical: 12 },
  codeBlock: { borderRadius: 12, padding: 12 },
  mono: { fontFamily: 'Courier', fontSize: 13, lineHeight: 19 },
  table: { borderWidth: 1, borderRadius: 12 },
  tr: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  td: { width: 128, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13, lineHeight: 18 },
  th: { fontWeight: '600' },
});
