import type { Quote, QuoteCondition, QuoteLanguage, QuotePart, QuoteSection, UserProfile } from '@client-tracker/contracts';
import { getCountryLabel } from '@/lib/countries';
import {
  formatCurrency,
  formatQuoteDate,
  getQuotePlatformLabel,
  getQuoteValidityDate,
} from '@/utils/quote';

/**
 * Génère un document HTML/CSS « devis » prêt à imprimer (Enregistrer en PDF via
 * le moteur d'impression du navigateur). Un seul gabarit sert d'aperçu écran et
 * de source PDF. Aucune dépendance externe.
 */

type Locale = 'fr-FR' | 'en-GB' | 'es-ES';

interface DocLabels {
  quoteNo: string;
  date: string;
  validity: string;
  for: string;
  platform: string;
  proposal: string;
  scope: string;
  investment: string;
  deliverable: string;
  amountExcl: string;
  options: string;
  optionsHint: string;
  subtotalExcl: string;
  discount: string;
  vat: string;
  totalIncl: string;
  conditions: string;
  roadmap: string;
  acceptance: string;
  principles: string;
  titleFallback: string;
  optional: string;
  partFallback: string;
}

const LABELS: Record<QuoteLanguage, DocLabels> = {
  fr: {
    quoteNo: 'Devis n°',
    date: 'Date',
    validity: 'Validité',
    for: 'Pour',
    platform: 'Plateforme',
    proposal: 'Proposition de projet',
    scope: 'Portée du projet',
    investment: 'Investissement',
    deliverable: 'Prestation',
    amountExcl: 'Montant (HTVA)',
    options: 'Options complémentaires',
    optionsHint: 'Ces options ne sont pas incluses dans le forfait de base.',
    subtotalExcl: 'Sous-total (HTVA)',
    discount: 'Remise',
    vat: 'TVA',
    totalIncl: 'Total (TTC)',
    conditions: 'Conditions générales',
    roadmap: 'Feuille de route & calendrier',
    acceptance: 'Acceptation de la proposition',
    principles: 'Nos principes',
    titleFallback: 'Devis',
    optional: 'optionnel',
    partFallback: 'Partie',
  },
  en: {
    quoteNo: 'Quote no.',
    date: 'Date',
    validity: 'Valid until',
    for: 'For',
    platform: 'Platform',
    proposal: 'Project proposal',
    scope: 'Project scope',
    investment: 'Investment',
    deliverable: 'Deliverable',
    amountExcl: 'Amount (excl. VAT)',
    options: 'Add-ons',
    optionsHint: 'These options are not included in the base package.',
    subtotalExcl: 'Subtotal (excl. VAT)',
    discount: 'Discount',
    vat: 'VAT',
    totalIncl: 'Total (incl. VAT)',
    conditions: 'Terms & conditions',
    roadmap: 'Roadmap & timeline',
    acceptance: 'Acceptance of proposal',
    principles: 'Our principles',
    titleFallback: 'Quote',
    optional: 'optional',
    partFallback: 'Part',
  },
  es: {
    quoteNo: 'Presupuesto n.º',
    date: 'Fecha',
    validity: 'Validez',
    for: 'Para',
    platform: 'Plataforma',
    proposal: 'Propuesta de proyecto',
    scope: 'Alcance del proyecto',
    investment: 'Inversión',
    deliverable: 'Servicio',
    amountExcl: 'Importe (sin IVA)',
    options: 'Opciones adicionales',
    optionsHint: 'Estas opciones no están incluidas en el paquete base.',
    subtotalExcl: 'Subtotal (sin IVA)',
    discount: 'Descuento',
    vat: 'IVA',
    totalIncl: 'Total (con IVA)',
    conditions: 'Condiciones generales',
    roadmap: 'Hoja de ruta y calendario',
    acceptance: 'Aceptación de la propuesta',
    principles: 'Nuestros principios',
    titleFallback: 'Presupuesto',
    optional: 'opcional',
    partFallback: 'Parte',
  },
};

const LOCALE_BY_LANG: Record<QuoteLanguage, Locale> = {
  fr: 'fr-FR',
  en: 'en-GB',
  es: 'es-ES',
};

const escapeHtml = (value: string): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Transforme un email ou une URL en lien cliquable (sinon renvoie le texte échappé). */
const linkify = (value: string): string => {
  const v = (value || '').trim();
  if (!v) return '';
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return `<a href="mailto:${escapeHtml(v)}">${escapeHtml(v)}</a>`;
  }
  if (/^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i.test(v)) {
    const href = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    const display = v.replace(/^https?:\/\//i, '').replace(/\/$/, '');
    return `<a href="${escapeHtml(href)}">${escapeHtml(display)}</a>`;
  }
  return escapeHtml(v);
};

const BULLET_RE = /^\s*[•◦▪·\-*]\s+/;

/**
 * Transforme un texte multi-lignes en HTML : les lignes commençant par une puce
 * deviennent des <li> regroupés, le reste en <p>.
 */
const renderRichText = (raw: string): string => {
  const text = (raw || '').trim();
  if (!text) return '';

  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (!listBuffer.length) return;
    out.push(`<ul>${listBuffer.map((li) => `<li>${escapeHtml(li)}</li>`).join('')}</ul>`);
    listBuffer = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }
    if (BULLET_RE.test(trimmed)) {
      listBuffer.push(trimmed.replace(BULLET_RE, ''));
    } else {
      flushList();
      out.push(`<p>${escapeHtml(trimmed)}</p>`);
    }
  });
  flushList();
  return out.join('');
};

const stripAutoNumberPrefix = (title: string): string =>
  (title || '').replace(/^\s*\d+[.)]\s*/, '').trim();

const renderSectionItems = (section: QuoteSection): string => {
  if (section.items?.length) {
    const items = section.items
      .map((item) => {
        const subs = (item.subItems || [])
          .map((sub) => `<li>${escapeHtml(sub.text)}</li>`)
          .join('');
        const subList = subs ? `<ul class="sub">${subs}</ul>` : '';
        return `<li>${escapeHtml(item.text)}${subList}</li>`;
      })
      .join('');
    return `<ul>${items}</ul>`;
  }
  return renderRichText(section.description);
};

const renderSectionInner = (section: QuoteSection): string => {
  const title = stripAutoNumberPrefix(section.title) || section.title;
  const sub = (section.subSections || [])
    .map(
      (s) =>
        `<div class="subsection"><h4>${escapeHtml(s.title)}</h4>${renderRichText(s.body)}</div>`,
    )
    .join('');
  return `${title ? `<h3>${escapeHtml(title)}</h3>` : ''}
    ${renderSectionItems(section)}
    ${sub}`;
};

/** Rendu d'une partie : 'table' = cellules encadrées, 'text' = blocs fluides. */
const renderPartSections = (part: QuotePart): string =>
  (part.sections || [])
    .map((section) =>
      part.displayStyle === 'table'
        ? `<section class="scope-cell">${renderSectionInner(section)}</section>`
        : `<div class="text-block">${renderSectionInner(section)}</div>`,
    )
    .join('');

const renderParts = (parts: QuotePart[], t: DocLabels): string => {
  const single = parts.length === 1;
  return parts
    .map((part, index) => {
      const heading =
        single && !part.title?.trim()
          ? t.scope
          : part.title?.trim() || `${t.partFallback} ${index + 1}`;
      const optionalBadge = part.optional
        ? `<span class="part-badge">${escapeHtml(t.optional)}</span>`
        : '';
      return `<section class="doc-section quote-part">
        <h2>${escapeHtml(heading)}${optionalBadge}</h2>
        ${renderPartSections(part)}
      </section>`;
    })
    .join('');
};

const renderInvestmentTable = (
  parts: QuotePart[],
  t: DocLabels,
  money: (value: number) => string,
  subtotal: number,
  vatRate: number,
  vatAmount: number,
  totalIncl: number,
  discountLabel: string,
): string => {
  const rows = parts
    .map((part, index) => {
      const label = part.title?.trim() || `${t.partFallback} ${index + 1}`;
      const badge = part.optional
        ? ` <span class="part-badge">${escapeHtml(t.optional)}</span>`
        : '';
      const note = part.optional && part.priceNote?.trim()
        ? `<div class="row-desc">${escapeHtml(part.priceNote)}</div>`
        : '';
      return `<tr${part.optional ? ' class="optional-row"' : ''}>
        <td><div class="row-title">${escapeHtml(label)}${badge}</div>${note}</td>
        <td class="amount">${money(Number(part.price || 0))}</td>
      </tr>`;
    })
    .join('');

  return `<section class="doc-section avoid-break">
    <h2>${escapeHtml(t.investment)}</h2>
    <table class="grid-table invest">
      <thead><tr><th>${escapeHtml(t.deliverable)}</th><th class="amount">${escapeHtml(t.amountExcl)}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <table class="totals">
      <tbody>
        <tr><td>${escapeHtml(t.subtotalExcl)}</td><td class="amount">${money(subtotal)}</td></tr>
        ${discountLabel ? `<tr><td>${escapeHtml(t.discount)}</td><td class="amount">− ${discountLabel}</td></tr>` : ''}
        <tr><td>${escapeHtml(t.vat)} ${vatRate}%</td><td class="amount">${money(vatAmount)}</td></tr>
        <tr class="grand"><td>${escapeHtml(t.totalIncl)}</td><td class="amount">${money(totalIncl)}</td></tr>
      </tbody>
    </table>
  </section>`;
};

const renderConditionBlocks = (title: string, entries: QuoteCondition[]): string => {
  if (!entries?.length) return '';
  const body = entries
    .map((entry) => {
      const items = entry.items?.length
        ? `<ul>${entry.items
            .map((item) => {
              const subs = (item.subItems || [])
                .map((sub) => `<li>${escapeHtml(sub.text)}</li>`)
                .join('');
              return `<li>${escapeHtml(item.text)}${subs ? `<ul class="sub">${subs}</ul>` : ''}</li>`;
            })
            .join('')}</ul>`
        : renderRichText(entry.body);
      return `<div class="cond-block">
        ${entry.title ? `<h3>${escapeHtml(entry.title)}</h3>` : ''}
        ${items}
      </div>`;
    })
    .join('');
  return `<section class="doc-section avoid-break">
    <h2>${escapeHtml(title)}</h2>
    ${body}
  </section>`;
};

const buildSenderLines = (profile: UserProfile | null): string[] => {
  if (!profile) return [];
  const streetLine = [profile.billingStreet, profile.billingStreetNumber]
    .filter((v) => v && v.trim())
    .join(' ');
  const cityLine = [profile.billingPostalCode, profile.billingCity]
    .filter((v) => v && v.trim())
    .join(' ');
  const country = profile.billingCountry ? getCountryLabel(profile.billingCountry) : '';
  return [
    escapeHtml(streetLine),
    escapeHtml(cityLine),
    escapeHtml(country),
    linkify(profile.email || ''),
    linkify(profile.website || ''),
  ].filter(Boolean);
};

export const renderQuoteDocumentHtml = (
  quote: Quote,
  profile: UserProfile | null,
): string => {
  const lang: QuoteLanguage = quote.language || 'fr';
  const t = LABELS[lang];
  const locale = LOCALE_BY_LANG[lang];
  const money = (value: number) => formatCurrency(Number(value || 0), locale);

  const senderName = escapeHtml(profile?.displayName || '');
  const senderLines = buildSenderLines(profile)
    .map((line) => `<div>${line}</div>`)
    .join('');
  const logo = profile?.logoUrl
    ? `<img class="logo" src="${escapeHtml(profile.logoUrl)}" alt="" />`
    : '';

  const bigTitle = escapeHtml(quote.title || t.titleFallback).toUpperCase();
  const validity = quote.quoteDate
    ? formatQuoteDate(getQuoteValidityDate(quote.quoteDate), locale)
    : '';
  const quoteDate = quote.quoteDate ? formatQuoteDate(quote.quoteDate, locale) : '';
  const platformLabel = getQuotePlatformLabel(quote.platform, quote.customPlatformLabel);

  const clientBlock = [
    escapeHtml((quote.clientName || '').trim()),
    escapeHtml((quote.clientAddress || '').trim()),
    linkify(quote.clientWebsite || ''),
  ]
    .filter(Boolean)
    .map((v) => `<div>${v}</div>`)
    .join('');

  // Totaux
  const vatRate = quote.vatRate || 0;
  const subtotal = Number(quote.subtotal || 0);
  const vatAmount = Number((subtotal * (vatRate / 100)).toFixed(2));
  const totalIncl = Number(quote.totalWithVat || subtotal + vatAmount);
  const discountValue = Number(quote.discountValue || 0);
  const discountLabel =
    discountValue > 0
      ? quote.discountType === 'fixed'
        ? money(discountValue)
        : `${discountValue}%`
      : '';

  // Options / add-ons (affichés hors total)
  const addons = (quote.addons || []).filter((a) => a.enabled !== false);
  const optionsTable = addons.length
    ? `<section class="doc-section avoid-break">
        <h2>${escapeHtml(t.options)}</h2>
        <table class="grid-table">
          <thead><tr><th>${escapeHtml(t.deliverable)}</th><th class="amount">${escapeHtml(t.amountExcl)}</th></tr></thead>
          <tbody>
            ${addons
              .map(
                (addon) => `<tr>
                  <td>
                    <div class="row-title">${escapeHtml(addon.title)}</div>
                    ${addon.description ? `<div class="row-desc">${renderRichText(addon.description)}</div>` : ''}
                  </td>
                  <td class="amount">${money(addon.price)}${addon.unitLabel ? `<span class="unit"> / ${escapeHtml(addon.unitLabel)}</span>` : ''}</td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>
        <p class="hint">${escapeHtml(t.optionsHint)}</p>
      </section>`
    : '';

  const parts = quote.parts;
  const partsContent = renderParts(parts, t);

  const proposal = quote.projectSummary?.trim()
    ? `<section class="doc-section avoid-break">
        <h2>${escapeHtml(t.proposal)}</h2>
        ${renderRichText(quote.projectSummary)}
      </section>`
    : '';

  const totalsTable = renderInvestmentTable(
    parts,
    t,
    money,
    subtotal,
    vatRate,
    vatAmount,
    totalIncl,
    discountLabel,
  );

  const conditions = [
    renderConditionBlocks(t.roadmap, quote.roadmap || []),
    renderConditionBlocks(t.acceptance, quote.acceptance || []),
    renderConditionBlocks(t.principles, quote.principles || []),
    renderConditionBlocks(t.conditions, quote.conditions || []),
  ].join('');

  const footerText = [
    escapeHtml(profile?.displayName || ''),
    linkify(profile?.email || ''),
    linkify(profile?.website || ''),
  ]
    .filter(Boolean)
    .join('&nbsp;&nbsp;·&nbsp;&nbsp;');

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml([t.titleFallback, quote.clientName].filter(Boolean).join(' - ') || quote.quoteRef)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root {
    --ink: #23262f;
    --muted: #6b7280;
    --line: #e6e8ec;
    --band: #14161f;
    --soft: #f6f7f9;
    --accent: #b08d57;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: var(--ink);
    font-size: 10.5pt;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1, h2, h3, h4 { font-family: 'Fraunces', Georgia, 'Times New Roman', serif; font-weight: 600; }
  a { color: inherit; text-decoration: none; }
  .sender a, .doc-meta a, .print-footer a { color: inherit; }
  p { margin: 0 0 8px; }
  ul { margin: 6px 0 8px; padding-left: 18px; }
  ul.sub { margin: 4px 0 4px; }
  li { margin: 2px 0; }

  .page { max-width: 190mm; margin: 0 auto; padding: 0 0 24mm; }

  /* ---- En-tête / letterhead ---- */
  .letterhead { display: flex; gap: 14mm; align-items: flex-start; margin-bottom: 12mm; }
  .sender { flex: 1 1 45%; }
  .sender .logo { max-height: 58px; max-width: 200px; margin-bottom: 10px; object-fit: contain; }
  .sender .name { font-family: 'Fraunces', serif; font-size: 15pt; font-weight: 600; margin-bottom: 4px; }
  .sender .lines { font-size: 8.8pt; color: var(--muted); line-height: 1.6; }
  .doc-meta { flex: 1 1 55%; background: var(--band); color: #fff; border-radius: 12px; padding: 16px 18px; }
  .doc-meta .doc-title { font-family: 'Fraunces', serif; font-size: 15pt; line-height: 1.25; letter-spacing: .2px; margin-bottom: 12px; }
  .doc-meta .meta-row { display: flex; justify-content: space-between; gap: 12px; font-size: 9pt; padding: 3px 0; color: #d7dae2; }
  .doc-meta .meta-row strong { color: #fff; font-weight: 500; }
  .doc-meta .divider { height: 1px; background: rgba(255,255,255,.16); margin: 10px 0; }
  .doc-meta .client-label { font-size: 8pt; text-transform: uppercase; letter-spacing: .12em; color: #a7abb6; margin-bottom: 2px; }
  .doc-meta .client { font-size: 10pt; color: #fff; line-height: 1.5; }

  /* ---- Sections ---- */
  .doc-section { margin-bottom: 9mm; }
  .doc-section > h2 {
    font-size: 13pt; margin: 0 0 8px; padding-bottom: 6px;
    border-bottom: 2px solid var(--ink);
  }
  .doc-section p { text-align: justify; }

  .scope-cell {
    border: 1px solid var(--line); border-radius: 10px;
    padding: 12px 16px; margin-bottom: 9px; break-inside: avoid;
  }
  .scope-cell h3 { font-size: 11pt; margin: 0 0 4px; }
  .scope-cell .subsection { margin-top: 8px; }
  .scope-cell .subsection h4 { font-size: 9.5pt; margin: 0 0 2px; color: var(--ink); }

  .text-block { margin-bottom: 10px; break-inside: avoid; }
  .text-block h3 { font-size: 11pt; margin: 0 0 4px; }
  .text-block .subsection { margin-top: 8px; }
  .text-block .subsection h4 { font-size: 9.5pt; margin: 0 0 2px; }

  .quote-part > h2 { display: flex; align-items: center; gap: 10px; }
  .part-badge {
    font-family: 'Inter', sans-serif; font-size: 7.5pt; font-weight: 600;
    text-transform: uppercase; letter-spacing: .08em;
    color: var(--accent); border: 1px solid var(--accent); border-radius: 999px;
    padding: 1px 8px;
  }
  .invest .optional-row td { color: var(--muted); }

  .cond-block { margin-bottom: 8px; break-inside: avoid; }
  .cond-block h3 { font-size: 10.5pt; margin: 0 0 3px; }

  /* ---- Tableaux ---- */
  table { width: 100%; border-collapse: collapse; }
  .grid-table th, .grid-table td { padding: 9px 12px; border-bottom: 1px solid var(--line); vertical-align: top; text-align: left; }
  .grid-table thead th { background: var(--soft); font-family: 'Inter', sans-serif; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
  .grid-table .row-title { font-weight: 600; }
  .grid-table .row-desc { font-size: 9pt; color: var(--muted); margin-top: 2px; }
  .grid-table .row-desc ul { margin: 2px 0; }
  .amount { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .unit { color: var(--muted); font-weight: 400; }
  .hint { font-size: 8.5pt; color: var(--muted); font-style: italic; margin-top: 6px; }

  .totals td { padding: 9px 14px; border-bottom: 1px solid var(--line); font-size: 10.5pt; }
  .totals .grand td { background: var(--band); color: #fff; font-weight: 600; font-size: 12pt; border: none; }
  .totals .grand td:first-child { border-radius: 8px 0 0 8px; }
  .totals .grand td:last-child { border-radius: 0 8px 8px 0; }

  .avoid-break { break-inside: avoid; }

  /* ---- Pied de page répété ---- */
  .print-footer {
    position: fixed; bottom: 0; left: 0; right: 0;
    padding: 3mm 10mm; font-size: 7.5pt; color: var(--muted);
    border-top: 1px solid var(--line); text-align: center;
    background: #fff;
  }

  @page { size: A4; margin: 16mm 12mm 20mm; }

  @media screen {
    body { background: #eceef1; padding: 24px 0; }
    .page { background: #fff; padding: 20mm 16mm 24mm; box-shadow: 0 8px 40px rgba(0,0,0,.12); border-radius: 4px; }
    .print-footer { display: none; }
  }
</style>
</head>
<body>
  <main class="page">
    <header class="letterhead">
      <div class="sender">
        ${logo}
        ${senderName ? `<div class="name">${senderName}</div>` : ''}
        <div class="lines">${senderLines}</div>
      </div>
      <div class="doc-meta">
        <div class="doc-title">${bigTitle}</div>
        <div class="meta-row"><span>${escapeHtml(t.quoteNo)}</span><strong>${escapeHtml(quote.quoteRef)}</strong></div>
        ${quoteDate ? `<div class="meta-row"><span>${escapeHtml(t.date)}</span><strong>${escapeHtml(quoteDate)}</strong></div>` : ''}
        ${validity ? `<div class="meta-row"><span>${escapeHtml(t.validity)}</span><strong>${escapeHtml(validity)}</strong></div>` : ''}
        ${platformLabel ? `<div class="meta-row"><span>${escapeHtml(t.platform)}</span><strong>${escapeHtml(platformLabel)}</strong></div>` : ''}
        <div class="divider"></div>
        <div class="client-label">${escapeHtml(t.for)}</div>
        <div class="client">${clientBlock}</div>
      </div>
    </header>

    ${proposal}
    ${partsContent}
    ${totalsTable}
    ${optionsTable}
    ${conditions}
  </main>

  <footer class="print-footer">${footerText}</footer>

  <script>
    window.addEventListener('load', async () => {
      try { if (document.fonts && document.fonts.ready) { await document.fonts.ready; } } catch (e) {}
      await new Promise((r) => setTimeout(r, 200));
      window.focus();
      window.print();
    });
  </script>
</body>
</html>`;
};

/**
 * Ouvre le devis dans une nouvelle fenêtre et déclenche l'impression
 * (Enregistrer en PDF). À appeler depuis un gestionnaire de clic.
 */
export const printQuoteDocument = (quote: Quote, profile: UserProfile | null): boolean => {
  const html = renderQuoteDocumentHtml(quote, profile);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
};
