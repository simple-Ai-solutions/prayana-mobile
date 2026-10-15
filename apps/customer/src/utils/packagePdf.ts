// Package itinerary and trip-schedule PDFs, ported from the web's
// components/packages/detail/DownloadPDF.jsx and DownloadSchedule.jsx. The web
// opens a print window; the phone renders the same HTML to a PDF with
// expo-print and hands it to the share sheet (save to Files, WhatsApp, …).
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

const SUPPORT_PHONE = '+91 94497 53920';

/** Escape text from the package before it goes into the HTML. */
const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Meals are stored either as booleans or as { included }. */
const hasMeal = (m: any) => m === true || !!m?.included;

const brandHeader = (right: string) => `
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid #2563eb;">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:38px;height:38px;border-radius:9px;background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;font-weight:800;font-size:17px;display:flex;align-items:center;justify-content:center;">P</div>
      <div>
        <div style="font-size:14px;font-weight:800;color:#0f172a;line-height:1;">Prayana AI</div>
        <div style="font-size:10px;color:#64748b;margin-top:3px;">Your Intelligent Journey Companion</div>
      </div>
    </div>
    <div style="text-align:right;">${right}</div>
  </div>`;

const today = () => new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

/** Smart packing list based on the destination, as on the web. */
function packingList(destination = '', difficulty = '', nights = 3) {
  const base = [
    'Valid ID proof (Aadhaar/Passport)', 'Comfortable walking shoes', 'Sunscreen SPF 50+', 'Sunglasses',
    'Power bank & charger', 'Personal medicines', 'Water bottle', 'Light backpack/daypack',
  ];
  const d = destination.toLowerCase();
  if (/manali|shimla|kashmir|ladakh|hill|himalay|kedarnath|badrinath|uttarakhand/.test(d)) {
    base.push('Warm jacket / fleece', 'Thermal innerwear', 'Woolen socks', 'Gloves & cap/beanie', 'Lip balm', 'Rain jacket/poncho');
  }
  if (/goa|kerala|andaman|beach|pondicherry/.test(d)) {
    base.push('Swimwear', 'Beach towel', 'Flip flops/sandals', 'After-sun lotion', 'Waterproof phone pouch', 'Light cotton clothes');
  }
  if (/rajasthan|jaisalmer|jodhpur|jaipur|desert/.test(d)) {
    base.push('Light cotton clothes', 'Scarf/dupatta (sun & temple cover)', 'Hat/cap for sun', 'Electrolyte packets');
  }
  base.push(
    `${Math.max(3, nights || 3)} sets of clothes`, 'Toiletries (travel-size)', 'Hand sanitizer', 'Tissues/wet wipes',
    'Snacks for the journey', 'Cash + UPI-enabled phone', 'Earphones',
  );
  if (difficulty === 'moderate' || difficulty === 'challenging') {
    base.push('Trekking poles', 'First-aid kit', 'Energy bars');
  }
  return [...new Set(base)];
}

function itineraryHtml(pkg: any, variant: any, price: number) {
  const primaryImage = pkg.images?.find((i: any) => i.isPrimary)?.url || pkg.images?.[0]?.url;

  const days = (pkg.itinerary || []).map((day: any, di: number) => {
    const acts = (day.activities || []).map((a: any) => {
      const title = typeof a === 'string' ? a : a?.title || a?.placeName || '';
      if (!title) return '';
      const time = a?.timeOfDay ? `<span style="font-size:9px;text-transform:uppercase;letter-spacing:.6px;color:#2563eb;background:#eff6ff;padding:2px 6px;border-radius:4px;margin-left:6px;font-weight:600;">${esc(String(a.timeOfDay).replace(/_/g, ' '))}</span>` : '';
      const dur = a?.duration?.value ? `<span style="color:#9ca3af;font-size:11px;margin-left:6px;">· ${esc(a.duration.value)}h</span>` : '';
      const opt = a?.isOptional ? '<span style="font-size:9px;text-transform:uppercase;color:#b45309;background:#fef3c7;padding:2px 6px;border-radius:4px;margin-left:4px;font-weight:600;">Optional</span>' : '';
      return `<li style="margin:5px 0;font-size:12.5px;color:#1f2937;line-height:1.5;padding-left:14px;position:relative;list-style:none;">
        <span style="position:absolute;left:0;top:7px;width:6px;height:6px;background:#2563eb;border-radius:50%;"></span>
        <span style="font-weight:500;">${esc(title)}</span>${dur}${time}${opt}</li>`;
    }).join('');
    const meals = [hasMeal(day.meals?.breakfast) && 'Breakfast', hasMeal(day.meals?.lunch) && 'Lunch', hasMeal(day.meals?.dinner) && 'Dinner']
      .filter(Boolean).join(' · ');
    const chips = [
      meals && `<span style="font-size:10.5px;color:#065f46;background:#ecfdf5;border:1px solid #a7f3d0;padding:3px 9px;border-radius:999px;">🍽 ${meals}</span>`,
      day.accommodation?.hotelName && day.accommodation.hotelName !== 'Overnight Bus'
        && `<span style="font-size:10.5px;color:#3730a3;background:#eef2ff;border:1px solid #c7d2fe;padding:3px 9px;border-radius:999px;">🏨 ${esc(day.accommodation.hotelName)}</span>`,
      day.transport?.mode
        && `<span style="font-size:10.5px;color:#6b21a8;background:#faf5ff;border:1px solid #e9d5ff;padding:3px 9px;border-radius:999px;">🚌 ${esc(day.transport.mode)} · ${esc(day.transport.fromLocation)} → ${esc(day.transport.toLocation)}</span>`,
    ].filter(Boolean).join(' ');
    const n = day.dayNumber ?? day.day ?? di + 1;
    return `
      <div style="page-break-inside:avoid;margin-bottom:14px;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;display:flex;">
        <div style="width:6px;background:linear-gradient(180deg,#2563eb,#3b82f6);flex-shrink:0;"></div>
        <div style="flex:1;">
          <div style="padding:12px 16px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:12px;">
            <div style="width:36px;height:36px;border-radius:8px;background:#eff6ff;color:#2563eb;text-align:center;line-height:1.1;padding-top:5px;box-sizing:border-box;flex-shrink:0;">
              <div style="font-size:8px;font-weight:600;opacity:.7;">DAY</div><div style="font-size:14px;font-weight:800;">${n}</div>
            </div>
            <div style="font-size:14.5px;color:#0f172a;font-weight:700;">${esc(day.title || day.destination || '')}</div>
          </div>
          <div style="padding:10px 16px 12px;">
            ${day.description ? `<p style="font-size:12px;color:#475569;margin:0 0 8px;line-height:1.55;">${esc(day.description)}</p>` : ''}
            ${acts ? `<ul style="padding:0;margin:0;">${acts}</ul>` : ''}
            ${chips ? `<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;">${chips}</div>` : ''}
            ${day.notes ? `<div style="margin-top:10px;font-size:11px;color:#854d0e;background:#fefce8;border:1px solid #fde68a;padding:7px 11px;border-radius:8px;">💡 <b>Tip:</b> ${esc(day.notes)}</div>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');

  const li = (items: string[], mark: string, color: string) =>
    (items || []).map((i) => `<li style="font-size:11.5px;color:#1f2937;margin:4px 0;padding-left:18px;position:relative;list-style:none;line-height:1.45;"><span style="position:absolute;left:0;color:${color};font-weight:700;">${mark}</span>${esc(i)}</li>`).join('');

  const box = (label: string, value: string, accent: string, filled = false) => filled
    ? `<div style="background:linear-gradient(135deg,#2563eb,#3b82f6);padding:12px 8px;border-radius:10px;text-align:center;color:#fff;"><p style="font-size:9px;opacity:.85;margin:0;text-transform:uppercase;letter-spacing:.8px;font-weight:600;">${label}</p><p style="font-size:16px;font-weight:800;margin:5px 0 0;">${value}</p></div>`
    : `<div style="border:1px solid #e2e8f0;border-top:3px solid ${accent};padding:12px 8px;border-radius:10px;text-align:center;"><p style="font-size:9px;color:#64748b;margin:0;text-transform:uppercase;letter-spacing:.8px;font-weight:600;">${label}</p><p style="font-size:16px;font-weight:800;margin:5px 0 0;color:#0f172a;text-transform:capitalize;">${value}</p></div>`;

  const emergency = [['Police', '100'], ['Ambulance', '108'], ['Fire', '101'], ['Tourist Helpline', '1363'], ['Women Helpline', '1091'], ['Prayana Support', SUPPORT_PHONE]]
    .map(([k, v]) => `<div style="background:#fff;padding:7px 10px;border-radius:6px;"><div style="font-size:9.5px;color:#92400e;text-transform:uppercase;font-weight:600;">${k}</div><div style="font-size:13px;color:#78350f;font-weight:800;">${v}</div></div>`).join('');

  const rules = (pkg.cancellationPolicy?.rules || []).map((r: any) =>
    `<div style="font-size:11.5px;color:#475569;margin:3px 0;">• <b style="color:#0f172a;">${esc(r.daysBeforeTravel)}+ days</b> before travel: <b style="color:#059669;">${esc(r.refundPercent)}% refund</b></div>`).join('');

  const section = (title: string) => `<div style="display:flex;align-items:center;gap:10px;margin:22px 0 12px;"><div style="width:4px;height:20px;background:#2563eb;border-radius:2px;"></div><h2 style="font-size:17px;color:#0f172a;font-weight:800;margin:0;">${title}</h2></div>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(pkg.title)} — Prayana AI</title>
    <style>body{font-family:-apple-system,'Segoe UI',Roboto,'Noto Sans','Noto Sans Devanagari',sans-serif;margin:0;color:#0f172a;-webkit-print-color-adjust:exact;}
    .page{padding:28px;} h1,h2,h3,p,ul{margin:0;padding:0;} @page{margin:14mm;}</style></head>
    <body><div class="page">
      ${brandHeader(`<div style="font-size:9px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Itinerary</div><div style="font-size:11px;color:#64748b;margin-top:2px;">${today()}</div>`)}
      <h1 style="font-size:24px;font-weight:800;line-height:1.2;margin-bottom:10px;">${esc(pkg.title)}</h1>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">
        <span style="font-size:11.5px;color:#334155;background:#f1f5f9;padding:5px 11px;border-radius:999px;">📍 ${esc((pkg.destinations || []).map((d: any) => d.name || d.city).join(' → '))}</span>
        <span style="font-size:11.5px;color:#334155;background:#f1f5f9;padding:5px 11px;border-radius:999px;">🗓 ${esc(pkg.duration?.days)}D / ${esc(pkg.duration?.nights)}N</span>
        ${variant ? `<span style="font-size:11.5px;color:#fff;background:#2563eb;padding:5px 11px;border-radius:999px;font-weight:600;">✨ ${esc(variant.displayName || variant.name)}</span>` : ''}
      </div>
      ${primaryImage ? `<img src="${esc(primaryImage)}" style="width:100%;height:210px;object-fit:cover;border-radius:12px;margin-bottom:18px;"/>` : ''}
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:6px;">
        ${box('Duration', `${esc(pkg.duration?.days)}D/${esc(pkg.duration?.nights)}N`, '#8b5cf6')}
        ${box('Price', `₹${Math.round(price || 0).toLocaleString('en-IN')}<span style="font-size:10px;opacity:.85;">/pp</span>`, '', true)}
        ${box('Meals', esc(variant?.mealPlan || 'As listed'), '#10b981')}
        ${box('Hotel', esc(variant?.hotelCategory || 'Standard'), '#f59e0b')}
      </div>
      ${section('Day-by-Day Itinerary')}${days}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:20px;page-break-inside:avoid;">
        <div style="background:#f0fdf4;padding:14px 16px;border-radius:10px;border:1px solid #bbf7d0;"><h3 style="font-size:12px;color:#065f46;font-weight:700;text-transform:uppercase;margin-bottom:8px;">✓ What's Included</h3><ul>${li(pkg.inclusions, '✓', '#059669')}</ul></div>
        <div style="background:#fef2f2;padding:14px 16px;border-radius:10px;border:1px solid #fecaca;"><h3 style="font-size:12px;color:#991b1b;font-weight:700;text-transform:uppercase;margin-bottom:8px;">✗ Not Included</h3><ul>${li(pkg.exclusions, '✗', '#dc2626')}</ul></div>
      </div>
      <div style="page-break-inside:avoid;">${section('Packing Checklist')}
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 16px;display:grid;grid-template-columns:1fr 1fr;gap:2px 14px;">
          ${packingList(pkg.primaryDestination, pkg.difficulty, pkg.duration?.nights).map((i) => `<div style="font-size:11.5px;color:#334155;padding:4px 0;">☐ ${esc(i)}</div>`).join('')}
        </div></div>
      <div style="margin-top:20px;background:#fef9c3;padding:14px;border-radius:10px;border:1px solid #fde68a;page-break-inside:avoid;">
        <h3 style="font-size:12px;color:#78350f;font-weight:800;text-transform:uppercase;margin-bottom:8px;">🚨 Emergency Information</h3>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;">${emergency}</div>
      </div>
      ${rules || pkg.cancellationPolicy?.description ? `<div style="margin-top:20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;page-break-inside:avoid;">
        <h3 style="font-size:12px;font-weight:800;text-transform:uppercase;margin-bottom:8px;">Cancellation Policy</h3>${rules}
        ${pkg.cancellationPolicy?.description ? `<p style="font-size:10.5px;color:#64748b;margin-top:8px;">${esc(pkg.cancellationPolicy.description)}</p>` : ''}</div>` : ''}
      <div style="margin-top:26px;padding-top:14px;border-top:2px solid #2563eb;text-align:center;">
        <div style="font-size:12.5px;font-weight:700;">Prayana AI</div>
        <div style="font-size:10px;color:#64748b;margin-top:2px;">prayanaai.com · ${SUPPORT_PHONE}</div>
        <p style="font-size:9.5px;color:#94a3b8;margin-top:8px;">This itinerary is subject to availability and weather conditions. Prices may vary based on travel date and group size.</p>
      </div>
    </div></body></html>`;
}

const SLOTS = [
  { id: 'morning', label: 'Morning', sub: '6 AM – 12 PM' },
  { id: 'afternoon', label: 'Afternoon', sub: '12 – 5 PM' },
  { id: 'evening', label: 'Evening', sub: '5 – 10 PM' },
];

function scheduleCell(day: any, slot: string, total: number) {
  const acts = (day.activities || []).filter((a: any) =>
    slot === 'morning' ? a?.timeOfDay === 'morning' || a?.timeOfDay === 'full_day' : a?.timeOfDay === slot);
  const meals = [
    slot === 'morning' && hasMeal(day.meals?.breakfast) && 'Breakfast',
    slot === 'afternoon' && hasMeal(day.meals?.lunch) && 'Lunch',
    slot === 'evening' && hasMeal(day.meals?.dinner) && 'Dinner',
  ].filter(Boolean);
  const n = day.dayNumber ?? day.day;
  const transport = day.transport?.mode && ((slot === 'morning' && n === 1) || (slot === 'afternoon' && n === total));
  const hotel = slot === 'evening' && day.accommodation?.hotelName && day.accommodation.hotelName !== 'Overnight Bus';
  const parts: string[] = [];
  if (transport) parts.push(`<div class="c tr"><div class="h">TRAVEL</div>${esc(day.transport.fromLocation)} → ${esc(day.transport.toLocation)}</div>`);
  acts.forEach((a: any) => parts.push(`<div class="c ac">${esc(a.title || a.placeName)}${a.duration?.value ? ` <span class="d">${esc(a.duration.value)}h</span>` : ''}</div>`));
  meals.forEach((m) => parts.push(`<div class="c me">🍽 ${m}</div>`));
  if (hotel) parts.push(`<div class="c ho"><div class="h">STAY</div>${esc(day.accommodation.hotelName)}</div>`);
  return parts.length ? `<td>${parts.join('')}</td>` : `<td class="empty">Free time</td>`;
}

function scheduleHtml(itinerary: any[], title: string) {
  const head = itinerary.map((d: any, i: number) =>
    `<th><div class="dn">Day ${esc(d.dayNumber ?? d.day ?? i + 1)}</div>${d.destination ? `<div class="dd">${esc(d.destination)}</div>` : ''}</th>`).join('');
  const rows = SLOTS.map((s) =>
    `<tr><td class="time"><b>${s.label}</b><div>${s.sub}</div></td>${itinerary.map((d) => scheduleCell(d, s.id, itinerary.length)).join('')}</tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${esc(title)} — Schedule</title>
    <style>@page{size:A4 landscape;margin:10mm;} body{font-family:-apple-system,'Segoe UI',Roboto,'Noto Sans','Noto Sans Devanagari',sans-serif;margin:0;padding:18px;color:#0f172a;-webkit-print-color-adjust:exact;}
    table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;table-layout:fixed;}
    th{background:#0f172a;color:#fff;padding:9px 6px;font-size:11px;} .dn{font-size:12.5px;font-weight:700;} .dd{font-size:9.5px;color:#94a3b8;margin-top:2px;}
    th:first-child,td.time{width:92px;} td{vertical-align:top;padding:5px;border-top:1px solid #e5e7eb;border-left:1px solid #e5e7eb;font-size:10.5px;}
    td.time{background:#f8fafc;text-align:center;vertical-align:middle;border-left:none;} td.time div{font-size:9px;color:#94a3b8;margin-top:2px;}
    td.empty{color:#cbd5e1;font-style:italic;text-align:center;vertical-align:middle;background:#fafafa;}
    .c{border:1px solid;border-radius:5px;padding:5px 7px;margin-bottom:4px;font-weight:600;line-height:1.35;} .h{font-size:7.5px;font-weight:800;letter-spacing:.5px;margin-bottom:1px;}
    .ac{background:#fffbeb;border-color:#fde68a;color:#78350f;} .me{background:#ecfdf5;border-color:#a7f3d0;color:#065f46;}
    .tr{background:#faf5ff;border-color:#e9d5ff;color:#6b21a8;} .ho{background:#f1f5f9;border-color:#e2e8f0;color:#334155;}
    .d{font-size:8.5px;background:rgba(255,255,255,.7);padding:0 4px;border-radius:3px;}</style></head><body>
    ${brandHeader(`<div style="font-size:18px;font-weight:800;">Trip schedule</div><div style="font-size:11px;color:#64748b;margin-top:3px;">${esc(title)}</div>`)}
    <table><tr><th>TIME</th>${head}</tr>${rows}</table>
    <div style="margin-top:14px;text-align:center;font-size:9.5px;color:#9ca3af;">Generated by Prayana AI — prayanaai.com · ${today()}</div>
    </body></html>`;
}

async function share(html: string, dialogTitle: string, landscape = false) {
  // A4 in points; landscape for the schedule's day columns.
  const size = landscape ? { width: 842, height: 595 } : { width: 595, height: 842 };
  const { uri } = await Print.printToFileAsync({ html, ...size });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle });
  } else {
    await Print.printAsync({ uri });
  }
}

export function sharePackagePdf(pkg: any, variant: any, price: number) {
  return share(itineraryHtml(pkg, variant, price), `${pkg.title} — itinerary`);
}

export function shareSchedulePdf(itinerary: any[], title: string) {
  return share(scheduleHtml(itinerary, title), `${title} — schedule`, true);
}
