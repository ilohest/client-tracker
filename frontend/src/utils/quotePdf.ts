import type {
  Quote,
  QuoteCondition,
  QuoteLanguage,
  QuotePart,
  QuotePaymentScheduleStep,
  QuoteSection,
  UserProfile,
} from "@client-tracker/contracts";
import { getCountryLabel } from "@/lib/countries";
import {
  getQuotePdfFontStack,
  getQuotePdfFontVariantStyle,
  getQuotePdfGoogleFontsHref,
  mixHexWithWhite,
  normalizeQuotePdfTheme,
} from "@/lib/quotePdfTheme";
import { getEstimatedTimelineTitle } from "@/lib/clientPresets";
import {
  calculatePaymentScheduleStepAmounts,
  formatCurrency,
  formatQuoteDate,
  getQuoteValidityDate,
} from "@/utils/quote";

/**
 * Génère un document HTML/CSS « devis » prêt à imprimer (Enregistrer en PDF via
 * le moteur d'impression du navigateur). Un seul gabarit sert d'aperçu écran et
 * de source PDF. Aucune dépendance externe.
 */

type Locale = "fr-FR" | "en-GB" | "es-ES";

interface DocLabels {
  quoteNo: string;
  date: string;
  validity: string;
  for: string;
  proposal: string;
  scope: string;
  investment: string;
  paymentSchedule: string;
  paymentStep: string;
  paymentShare: string;
  amountIncl: string;
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
  clientDate: string;
  clientSignature: string;
  principles: string;
  titleFallback: string;
  optional: string;
  partFallback: string;
  email: string;
  website: string;
}

const LABELS: Record<QuoteLanguage, DocLabels> = {
  fr: {
    quoteNo: "Devis n°",
    date: "Date",
    validity: "Validité",
    for: "Pour",
    proposal: "Proposition de projet",
    scope: "Portée du projet",
    investment: "Investissement",
    paymentSchedule: "Échéancier de paiement",
    paymentStep: "Étape",
    paymentShare: "Part",
    amountIncl: "Montant (TTC)",
    deliverable: "Prestation",
    amountExcl: "Montant (HTVA)",
    options: "Options complémentaires",
    optionsHint: "Ces options ne sont pas incluses dans le forfait de base.",
    subtotalExcl: "Sous-total (HTVA)",
    discount: "Remise",
    vat: "TVA",
    totalIncl: "Total (TTC)",
    conditions: "Conditions générales",
    roadmap: "Feuille de route & calendrier",
    acceptance: "Acceptation de la proposition",
    clientDate: "Date",
    clientSignature: "Signature du client",
    principles: "Nos principes",
    titleFallback: "Devis",
    optional: "optionnel",
    partFallback: "Partie",
    email: "Email",
    website: "Site",
  },
  en: {
    quoteNo: "Quote no.",
    date: "Date",
    validity: "Valid until",
    for: "For",
    proposal: "Project proposal",
    scope: "Project scope",
    investment: "Investment",
    paymentSchedule: "Payment schedule",
    paymentStep: "Step",
    paymentShare: "Share",
    amountIncl: "Amount (incl. VAT)",
    deliverable: "Deliverable",
    amountExcl: "Amount (excl. VAT)",
    options: "Add-ons",
    optionsHint: "These options are not included in the base package.",
    subtotalExcl: "Subtotal (excl. VAT)",
    discount: "Discount",
    vat: "VAT",
    totalIncl: "Total (incl. VAT)",
    conditions: "Terms & conditions",
    roadmap: "Roadmap & timeline",
    acceptance: "Acceptance of proposal",
    clientDate: "Date",
    clientSignature: "Client signature",
    principles: "Our principles",
    titleFallback: "Quote",
    optional: "optional",
    partFallback: "Part",
    email: "Email",
    website: "Website",
  },
  es: {
    quoteNo: "Presupuesto n.º",
    date: "Fecha",
    validity: "Validez",
    for: "Para",
    proposal: "Propuesta de proyecto",
    scope: "Alcance del proyecto",
    investment: "Inversión",
    paymentSchedule: "Calendario de pago",
    paymentStep: "Etapa",
    paymentShare: "Parte",
    amountIncl: "Importe (con IVA)",
    deliverable: "Servicio",
    amountExcl: "Importe (sin IVA)",
    options: "Opciones adicionales",
    optionsHint: "Estas opciones no están incluidas en el paquete base.",
    subtotalExcl: "Subtotal (sin IVA)",
    discount: "Descuento",
    vat: "IVA",
    totalIncl: "Total (con IVA)",
    conditions: "Condiciones generales",
    roadmap: "Hoja de ruta y calendario",
    acceptance: "Aceptación de la propuesta",
    clientDate: "Fecha",
    clientSignature: "Firma del cliente",
    principles: "Nuestros principios",
    titleFallback: "Presupuesto",
    optional: "opcional",
    partFallback: "Parte",
    email: "Email",
    website: "Sitio",
  },
};

const LOCALE_BY_LANG: Record<QuoteLanguage, Locale> = {
  fr: "fr-FR",
  en: "en-GB",
  es: "es-ES",
};

const escapeHtml = (value: string): string =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const normalizeWebsiteDisplay = (website: string): string =>
  (website || "")
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/$/, "");

const HOUSE_NUMBER_LINE_RE =
  /^\d+[a-z]?(?:\s*(?:,|\/|-|bis|ter|bte|bt|boîte|boite|box|bus)\s*[\w\s-]*)?$/i;

const mergeDetachedHouseNumber = (lines: string[]): string[] =>
  lines.reduce<string[]>((acc, line) => {
    if (HOUSE_NUMBER_LINE_RE.test(line) && acc.length) {
      acc[acc.length - 1] = `${acc[acc.length - 1]} ${line}`;
      return acc;
    }
    acc.push(line);
    return acc;
  }, []);

/** Transforme un email ou une URL en lien cliquable (sinon renvoie le texte échappé). */
const linkify = (value: string): string => {
  const v = (value || "").trim();
  if (!v) return "";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return `<a href="mailto:${escapeHtml(v)}">${escapeHtml(v)}</a>`;
  }
  if (/^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i.test(v)) {
    const href = /^https?:\/\//i.test(v) ? v : `https://${v}`;
    const display = v.replace(/^https?:\/\//i, "").replace(/\/$/, "");
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
  const text = (raw || "").trim();
  if (!text) return "";

  const lines = text.split(/\r?\n/);
  const out: string[] = [];
  let listBuffer: string[] = [];

  const flushList = () => {
    if (!listBuffer.length) return;
    out.push(
      `<ul>${listBuffer.map((li) => `<li>${escapeHtml(li)}</li>`).join("")}</ul>`,
    );
    listBuffer = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }
    if (BULLET_RE.test(trimmed)) {
      listBuffer.push(trimmed.replace(BULLET_RE, ""));
    } else {
      flushList();
      out.push(`<p>${escapeHtml(trimmed)}</p>`);
    }
  });
  flushList();
  return out.join("");
};

const stripStandaloneSignatureLabels = (
  raw: string,
  labels: string[],
): string => {
  if (!raw || !labels.length) return raw || "";
  const normalizedLabels = new Set(
    labels
      .map((label) =>
        label
          .trim()
          .toLowerCase()
          .replace(/[:：]$/, ""),
      )
      .filter(Boolean),
  );
  return raw
    .split(/\r?\n/)
    .filter((line) => {
      const normalizedLine = line
        .trim()
        .toLowerCase()
        .replace(/[:：]$/, "");
      return !normalizedLabels.has(normalizedLine);
    })
    .join("\n")
    .trim();
};

const stripAutoNumberPrefix = (title: string): string =>
  (title || "").replace(/^\s*\d+[.)]\s*/, "").trim();

const buildProfileVariableRenderer = (
  profile: UserProfile | null,
  locale: Locale,
): ((value: string) => string) => {
  const money = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  const hourlyRate = Number(profile?.hourlyRate || 0);
  const replacements: Record<string, string> = {
    taux_horaire: hourlyRate ? money(hourlyRate) : "",
    taux_journalier: hourlyRate ? money(hourlyRate * 8) : "",
  };
  return (value: string) =>
    (value || "").replace(
      /\{(taux_horaire|taux_journalier)\}/g,
      (_match, key: string) => replacements[key] || "",
    );
};

const resolveSectionDisplayMode = (
  value: unknown,
): NonNullable<QuoteSection["displayMode"]> => {
  if (value === "title" || value === "bullets" || value === "numbered") {
    return value;
  }
  if (value && typeof value === "object" && "value" in value) {
    const optionValue = (value as { value?: unknown }).value;
    if (
      optionValue === "title" ||
      optionValue === "bullets" ||
      optionValue === "numbered"
    ) {
      return optionValue;
    }
  }
  return "bullets";
};

const renderSectionItems = (
  section: QuoteSection,
  renderVariables: (value: string) => string,
): string => {
  const displayMode = resolveSectionDisplayMode(section.displayMode);
  if (displayMode === "title")
    return renderRichText(renderVariables(section.description));
  const description = section.description?.trim()
    ? `<div class="section-description">${renderRichText(renderVariables(section.description))}</div>`
    : "";
  if (section.items?.length) {
    const tag = displayMode === "numbered" ? "ol" : "ul";
    const items = section.items
      .map((item) => {
        const subs = (item.subItems || [])
          .map((sub) => `<li>${escapeHtml(renderVariables(sub.text))}</li>`)
          .join("");
        const subList = subs ? `<ul class="sub">${subs}</ul>` : "";
        return `<li>${escapeHtml(renderVariables(item.text))}${subList}</li>`;
      })
      .join("");
    return `${description}<${tag} class="section-items">${items}</${tag}>`;
  }
  return description;
};

const renderSectionInner = (
  section: QuoteSection,
  renderVariables: (value: string) => string,
): string => {
  const title = renderVariables(
    stripAutoNumberPrefix(section.title) || section.title,
  );
  const sub = (section.subSections || [])
    .map(
      (s) =>
        `<div class="subsection"><h4>${escapeHtml(renderVariables(s.title))}</h4>${renderRichText(renderVariables(s.body))}</div>`,
    )
    .join("");
  return `${title ? `<h3>${escapeHtml(title)}</h3>` : ""}
    ${renderSectionItems(section, renderVariables)}
    ${sub}`;
};

/** Rendu d'une partie : 'table' = cellules encadrées, 'text' = blocs fluides. */
const renderPartSections = (
  part: QuotePart,
  renderVariables: (value: string) => string,
): string =>
  (part.sections || [])
    .map((section) =>
      part.displayStyle === "table"
        ? `<section class="scope-cell">${renderSectionInner(section, renderVariables)}</section>`
        : `<div class="text-block">${renderSectionInner(section, renderVariables)}</div>`,
    )
    .join("");

const renderParts = (
  parts: QuotePart[],
  t: DocLabels,
  renderVariables: (value: string) => string,
): string => {
  const single = parts.length === 1;
  return parts
    .map((part, index) => {
      const heading =
        single && !part.title?.trim()
          ? t.scope
          : part.title?.trim() || `${t.partFallback} ${index + 1}`;
      const optionalBadge = part.optional
        ? `<span class="part-badge">${escapeHtml(t.optional)}</span>`
        : "";
      return `<section class="doc-section quote-part">
        <h2>${escapeHtml(renderVariables(heading))}${optionalBadge}</h2>
        ${renderPartSections(part, renderVariables)}
      </section>`;
    })
    .join("");
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
  investmentSummary: string = "",
  investmentAmount: number = 0,
  renderVariables: (value: string) => string = (value) => value,
): string => {
  const investmentParts = parts.filter(
    (part) => part.includeInInvestment !== false,
  );
  const hasGlobalInvestment = Number(investmentAmount || 0) > 0;
  const rows = hasGlobalInvestment
    ? `<tr>
        <td><div class="row-title">${escapeHtml(renderVariables(investmentSummary.trim() || t.investment))}</div></td>
        <td class="amount">${money(Number(investmentAmount || 0))}</td>
      </tr>`
    : investmentParts
        .map((part, index) => {
          const label = part.title?.trim() || `${t.partFallback} ${index + 1}`;
          const badge = part.optional
            ? ` <span class="part-badge">${escapeHtml(t.optional)}</span>`
            : "";
          const note =
            part.optional && part.priceNote?.trim()
              ? `<div class="row-desc">${escapeHtml(renderVariables(part.priceNote))}</div>`
              : "";
          return `<tr${part.optional ? ' class="optional-row"' : ""}>
        <td><div class="row-title">${escapeHtml(renderVariables(label))}${badge}</div>${note}</td>
        <td class="amount">${money(Number(part.price || 0))}</td>
      </tr>`;
        })
        .join("");

  return `<section class="doc-section avoid-break">
    <h2>${escapeHtml(t.investment)}</h2>
    <table class="grid-table invest">
      <thead><tr><th>${escapeHtml(t.deliverable)}</th><th class="amount">${escapeHtml(t.amountExcl)}</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <table class="totals">
      <tbody>
        <tr><td>${escapeHtml(t.subtotalExcl)}</td><td class="amount">${money(subtotal)}</td></tr>
        ${discountLabel ? `<tr><td>${escapeHtml(t.discount)}</td><td class="amount">− ${discountLabel}</td></tr>` : ""}
        <tr><td>${escapeHtml(t.vat)} ${vatRate}%</td><td class="amount">${money(vatAmount)}</td></tr>
        <tr class="grand"><td>${escapeHtml(t.totalIncl)}</td><td class="amount">${money(totalIncl)}</td></tr>
      </tbody>
    </table>
  </section>`;
};

const renderPaymentScheduleTable = (
  steps: QuotePaymentScheduleStep[] = [],
  t: DocLabels,
  money: (value: number) => string,
  subtotal: number,
  totalIncl: number,
): string => {
  if (!steps.length) return "";

  const rows = steps
    .map((step, index) => {
      const amounts = calculatePaymentScheduleStepAmounts(
        step,
        subtotal,
        totalIncl,
      );
      const label = step.label?.trim() || `${t.paymentStep} ${index + 1}`;
      return `<tr>
        <td><div class="row-title">${escapeHtml(label)}</div></td>
        <td class="amount">${amounts.percent.toFixed(2)}%</td>
        <td class="amount">${money(amounts.amountExcl)}</td>
        <td class="amount">${money(amounts.amountIncl)}</td>
      </tr>`;
    })
    .join("");

  return `<section class="doc-section avoid-break">
    <h2>${escapeHtml(t.paymentSchedule)}</h2>
    <table class="grid-table payment-schedule">
      <thead>
        <tr>
          <th>${escapeHtml(t.paymentStep)}</th>
          <th class="amount">${escapeHtml(t.paymentShare)}</th>
          <th class="amount">${escapeHtml(t.amountExcl)}</th>
          <th class="amount">${escapeHtml(t.amountIncl)}</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
};

const renderConditionBlocks = (
  title: string,
  entries: QuoteCondition[],
  options: {
    relaxedTitles?: boolean;
    bulletEntries?: boolean;
    spacedEntries?: boolean;
    numberedEntries?: boolean;
    pageBreakBefore?: boolean;
    principleCards?: boolean;
    skipLastNumber?: boolean;
    signatureLabels?: { date: string; signature: string };
  } = {},
  renderVariables: (value: string) => string = (value) => value,
): string => {
  if (!entries?.length) return "";
  const sectionClass = [
    "doc-section",
    options.relaxedTitles ? "relaxed-condition-titles" : "",
    options.spacedEntries ? "spaced-condition-entries" : "",
    options.pageBreakBefore ? "page-break-before" : "",
    options.signatureLabels ? "has-signature-block" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const signatureLabels = options.signatureLabels
    ? [options.signatureLabels.date, options.signatureLabels.signature]
    : [];
  const cleanSignatureText = (value: string) =>
    stripStandaloneSignatureLabels(value || "", signatureLabels);
  if (options.principleCards) {
    const cards = entries
      .map((entry, index) => {
        const entryTitle = cleanSignatureText(entry.title);
        const rawTag = (entry.tag || "").trim();
        const displayTag = rawTag
          ? rawTag.startsWith("#")
            ? rawTag
            : `#${rawTag}`
          : "";
        const nestedItems = entry.items?.length
          ? `<ul>${entry.items
              .map((item) => ({ ...item, text: cleanSignatureText(item.text) }))
              .filter((item) => item.text.trim())
              .map((item) => {
                const subs = (item.subItems || [])
                  .map((sub) => cleanSignatureText(sub.text))
                  .filter((sub) => sub.trim())
                  .map((sub) => `<li>${escapeHtml(renderVariables(sub))}</li>`)
                  .join("");
                return `<li>${escapeHtml(renderVariables(item.text))}${subs ? `<ul class="sub">${subs}</ul>` : ""}</li>`;
              })
              .join("")}</ul>`
          : renderRichText(renderVariables(cleanSignatureText(entry.body)));
        return `<article class="principle-card principle-card-${index % 6} ${displayTag ? "has-seal" : "no-seal"}">
          ${displayTag ? `<div class="principle-seal principle-seal-${index % 6}">${escapeHtml(renderVariables(displayTag))}</div>` : ""}
          ${entryTitle ? `<h3>${escapeHtml(renderVariables(entryTitle))}</h3>` : ""}
          <div class="principle-card-body">${nestedItems}</div>
        </article>`;
      })
      .join("");
    return `<section class="${sectionClass} principle-card-section">
      <h2>${escapeHtml(title)}</h2>
      <div class="principle-card-grid">${cards}</div>
    </section>`;
  }
  if (options.bulletEntries) {
    const body = entries
      .map((entry) => {
        const entryTitle = cleanSignatureText(entry.title);
        const nestedItems = entry.items?.length
          ? `<ul>${entry.items
              .map((item) => ({ ...item, text: cleanSignatureText(item.text) }))
              .filter((item) => item.text.trim())
              .map((item) => {
                const subs = (item.subItems || [])
                  .map((sub) => cleanSignatureText(sub.text))
                  .filter((sub) => sub.trim())
                  .map((sub) => `<li>${escapeHtml(renderVariables(sub))}</li>`)
                  .join("");
                return `<li>${escapeHtml(renderVariables(item.text))}${subs ? `<ul class="sub">${subs}</ul>` : ""}</li>`;
              })
              .join("")}</ul>`
          : renderRichText(renderVariables(cleanSignatureText(entry.body)));
        return `<li class="cond-block">
          ${entryTitle ? `<h3>${escapeHtml(renderVariables(entryTitle))}</h3>` : ""}
          ${nestedItems}
        </li>`;
      })
      .join("");
    return `<section class="${sectionClass}">
      <h2>${escapeHtml(title)}</h2>
      <ul class="condition-entry-list">${body}</ul>
    </section>`;
  }
  const signatureGridHtml = options.signatureLabels
    ? `<div class="signature-grid">
      <div class="signature-box">
        <span>${escapeHtml(options.signatureLabels.date)}</span>
      </div>
      <div class="signature-box">
        <span>${escapeHtml(options.signatureLabels.signature)}</span>
      </div>
    </div>`
    : "";

  const body = entries
    .map((entry, index) => {
      const entryTitle = renderVariables(
        cleanSignatureText(stripAutoNumberPrefix(entry.title)),
      );
      const displayedTitle =
        options.numberedEntries &&
        entryTitle &&
        !(options.skipLastNumber && index === entries.length - 1)
          ? `${index + 1}. ${entryTitle}`
          : entryTitle;
      const items = entry.items?.length
        ? `<ul>${entry.items
            .map((item) => ({ ...item, text: cleanSignatureText(item.text) }))
            .filter((item) => item.text.trim())
            .map((item) => {
              const subs = (item.subItems || [])
                .map((sub) => cleanSignatureText(sub.text))
                .filter((sub) => sub.trim())
                .map((sub) => `<li>${escapeHtml(renderVariables(sub))}</li>`)
                .join("");
              return `<li>${escapeHtml(renderVariables(item.text))}${subs ? `<ul class="sub">${subs}</ul>` : ""}</li>`;
            })
            .join("")}</ul>`
        : renderRichText(renderVariables(cleanSignatureText(entry.body)));
      const condClass = [
        "cond-block",
        options.signatureLabels && index === entries.length - 1
          ? "signature-anchor"
          : "",
      ]
        .filter(Boolean)
        .join(" ");
      const block = `<div class="${condClass}">
        ${displayedTitle ? `<h3>${escapeHtml(displayedTitle)}</h3>` : ""}
        ${items}
      </div>`;
      return options.signatureLabels && index === entries.length - 1
        ? `<div class="signature-keep-together">${block}${signatureGridHtml}</div>`
        : block;
    })
    .join("");
  return `<section class="${sectionClass}">
    <h2>${escapeHtml(title)}</h2>
    ${body}
  </section>`;
};

const buildSenderLines = (profile: UserProfile | null): string[] => {
  if (!profile) return [];
  const streetLine = [profile.billingStreet, profile.billingStreetNumber]
    .filter((v) => v && v.trim())
    .join(" ");
  const cityLine = [profile.billingPostalCode, profile.billingCity]
    .filter((v) => v && v.trim())
    .join(" ");
  const country = profile.billingCountry
    ? getCountryLabel(profile.billingCountry)
    : "";
  return [
    escapeHtml(streetLine),
    escapeHtml(cityLine),
    escapeHtml(country),
    linkify(profile.contactEmail || ""),
    linkify(profile.website || ""),
  ].filter(Boolean);
};

const buildSenderAddressHtml = (
  profile: UserProfile | null,
  t: DocLabels,
): string => {
  if (!profile) return "";
  const streetLine = [profile.billingStreet, profile.billingStreetNumber]
    .filter((v) => v && v.trim())
    .join(" ");
  const cityLine = [profile.billingPostalCode, profile.billingCity]
    .filter((v) => v && v.trim())
    .join(" ");
  const country = profile.billingCountry
    ? getCountryLabel(profile.billingCountry)
    : "";
  const postalLines = [streetLine, cityLine, country].filter(Boolean);
  const rows = [
    postalLines.length
      ? `<div class="address-row address-postal">${postalLines
          .map((line) => `<span>${escapeHtml(line)}</span>`)
          .join("")}</div>`
      : "",
    profile.contactEmail
      ? `<div class="address-row address-contact">${linkify(profile.contactEmail)}</div>`
      : "",
    profile.website
      ? `<div class="address-row address-contact">${linkify(profile.website)}</div>`
      : "",
  ].filter(Boolean);
  return rows.join("");
};

const buildClientAddressHtml = (quote: Quote, t: DocLabels): string => {
  const addressLines = (quote.clientAddress || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const displayAddressLines = mergeDetachedHouseNumber(addressLines).map(
    (line) =>
      /^[A-Z]{2}$/i.test(line) ? getCountryLabel(line.toUpperCase()) : line,
  );
  const rows = [
    quote.clientName?.trim()
      ? `<div class="client-name">${escapeHtml(quote.clientName.trim())}</div>`
      : "",
    displayAddressLines.length
      ? `<div class="client-address">${displayAddressLines
          .map((line) => `<span>${escapeHtml(line)}</span>`)
          .join("")}</div>`
      : "",
    quote.clientWebsite
      ? `<div class="client-contact">${linkify(quote.clientWebsite)}</div>`
      : "",
  ].filter(Boolean);
  return rows.join("");
};

export const renderQuoteDocumentHtml = (
  quote: Quote,
  profile: UserProfile | null,
  options: { showPreviewToolbar?: boolean } = {},
): string => {
  const lang: QuoteLanguage = quote.language || "fr";
  const t = LABELS[lang];
  const locale = LOCALE_BY_LANG[lang];
  const money = (value: number) => formatCurrency(Number(value || 0), locale);
  const theme = normalizeQuotePdfTheme(profile);
  const mutedColor = mixHexWithWhite(theme.textColor, 0.38);
  const lineColor = mixHexWithWhite(theme.accentColor, 0.82);
  const softColor = mixHexWithWhite(theme.accentColor, 0.94);
  const metaTextColor = mixHexWithWhite(theme.accentColor, 0.78);
  const metaLabelColor = mixHexWithWhite(theme.accentColor, 0.62);
  const headingFontStack = getQuotePdfFontStack(theme.headingFont);
  const bodyFontStack = getQuotePdfFontStack(theme.bodyFont);
  const headingFontStyle = getQuotePdfFontVariantStyle(
    theme.headingFontVariant,
  );
  const bodyFontStyle = getQuotePdfFontVariantStyle(theme.bodyFontVariant);
  const fontsHref = getQuotePdfGoogleFontsHref(
    theme.headingFontGoogleFamily,
    theme.bodyFontGoogleFamily,
  );
  const showPreviewToolbar = options.showPreviewToolbar ?? true;
  const renderVariables = buildProfileVariableRenderer(profile, locale);

  const senderName = escapeHtml(profile?.displayName || "");
  const senderTitle = escapeHtml(profile?.jobTitle || "");
  const senderLines = buildSenderAddressHtml(profile, t);
  const logo = profile?.logoUrl
    ? `<img class="logo" src="${escapeHtml(profile.logoUrl)}" alt="" />`
    : "";

  const bigTitle = escapeHtml(quote.title || t.titleFallback).toUpperCase();
  const validity = quote.quoteDate
    ? formatQuoteDate(getQuoteValidityDate(quote.quoteDate), locale)
    : "";
  const quoteDate = quote.quoteDate
    ? formatQuoteDate(quote.quoteDate, locale)
    : "";
  const clientBlock = buildClientAddressHtml(quote, t);

  // Totaux
  const vatRate = quote.vatRate || 0;
  const subtotal = Number(quote.subtotal || 0);
  const vatAmount = Number((subtotal * (vatRate / 100)).toFixed(2));
  const totalIncl = Number(quote.totalWithVat || subtotal + vatAmount);
  const discountValue = Number(quote.discountValue || 0);
  const discountLabel =
    discountValue > 0
      ? quote.discountType === "fixed"
        ? money(discountValue)
        : `${discountValue}%`
      : "";

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
                    <div class="row-title">${escapeHtml(renderVariables(addon.title))}</div>
                    ${addon.description ? `<div class="row-desc">${renderRichText(renderVariables(addon.description))}</div>` : ""}
                  </td>
                  <td class="amount">${money(addon.price)}${addon.unitLabel ? `<span class="unit"> / ${escapeHtml(renderVariables(addon.unitLabel))}</span>` : ""}</td>
                </tr>`,
              )
              .join("")}
          </tbody>
        </table>
        <p class="hint">${escapeHtml(t.optionsHint)}</p>
      </section>`
    : "";

  const parts = quote.parts;
  const partsContent = renderParts(parts, t, renderVariables);

  const proposal = quote.projectSummary?.trim()
    ? `<section class="doc-section avoid-break">
        <h2>${escapeHtml(t.proposal)}</h2>
        ${renderRichText(renderVariables(quote.projectSummary))}
      </section>`
    : "";

  const totalsTable = renderInvestmentTable(
    parts,
    t,
    money,
    subtotal,
    vatRate,
    vatAmount,
    totalIncl,
    discountLabel,
    quote.investmentSummary || "",
    quote.investmentAmount || 0,
    renderVariables,
  );
  const paymentScheduleTable = renderPaymentScheduleTable(
    quote.paymentSchedule || [],
    t,
    money,
    subtotal,
    totalIncl,
  );

  const roadmapEntries = (quote.roadmap || []).map((entry, index, list) =>
    index === list.length - 1
      ? { ...entry, title: getEstimatedTimelineTitle(lang) }
      : entry,
  );

  const conditions = [
    renderConditionBlocks(
      t.roadmap,
      roadmapEntries,
      {
        numberedEntries: true,
        skipLastNumber: true,
        spacedEntries: true,
      },
      renderVariables,
    ),
    renderConditionBlocks(
      t.acceptance,
      quote.acceptance || [],
      {
        relaxedTitles: true,
        signatureLabels: { date: t.clientDate, signature: t.clientSignature },
      },
      renderVariables,
    ),
    renderConditionBlocks(
      t.conditions,
      quote.conditions || [],
      {
        numberedEntries: true,
        spacedEntries: true,
        pageBreakBefore: true,
      },
      renderVariables,
    ),
    renderConditionBlocks(
      t.principles,
      quote.principles || [],
      {
        relaxedTitles: true,
        bulletEntries: true,
        principleCards: true,
        pageBreakBefore: true,
      },
      renderVariables,
    ),
  ].join("");

  const footerWebsite = escapeHtml(
    normalizeWebsiteDisplay(profile?.website || ""),
  );

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(quote.quoteRef || t.titleFallback)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="${escapeHtml(fontsHref)}" rel="stylesheet" />
<style>
  :root {
    --ink: ${theme.textColor};
    --title: ${theme.titleColor};
    --muted: ${mutedColor};
    --line: ${lineColor};
    --band: ${theme.accentColor};
    --soft: ${softColor};
    --accent: ${theme.accentColor};
    --meta-text: ${metaTextColor};
    --meta-label: ${metaLabelColor};
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  body {
    font-family: ${bodyFontStack};
    font-style: ${bodyFontStyle.style};
    font-weight: ${bodyFontStyle.weight};
    color: var(--ink);
    font-size: 10.5pt;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  h1, h2, h3, h4 {
    font-family: ${headingFontStack};
    font-style: ${headingFontStyle.style};
    font-weight: ${headingFontStyle.weight};
    color: var(--title);
  }
  a { color: inherit; text-decoration: none; }
  .sender a, .doc-meta a, .print-footer a { color: inherit; }
  p { margin: 0 0 8px; }
  ul { margin: 6px 0 8px; padding-left: 18px; }
  ul.sub { margin: 4px 0 4px; }
  li { margin: 2px 0; }

  .page {
    position: relative;
    max-width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 14mm 16mm 24mm;
  }

  .print-header,
  .print-footer {
    position: fixed;
    left: 16mm;
    right: 16mm;
    z-index: 10;
    display: flex;
    align-items: center;
    color: var(--muted);
    font-size: 7.5pt;
    line-height: 1;
    background: #fff;
  }
  .print-header {
    top: 7mm;
    justify-content: flex-end;
    text-align: right;
  }
  .print-footer {
    bottom: 7mm;
    justify-content: space-between;
    border-top: 1px solid var(--line);
    padding-top: 3mm;
  }
  .print-page-footers { display: none; }
  .print-page-footer {
    position: absolute;
    left: 16mm;
    right: 16mm;
    z-index: 110;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-top: 1px solid var(--line);
    padding-top: 3mm;
    color: var(--muted);
    font-size: 7.5pt;
    line-height: 1;
    background: #fff;
  }
  .first-page-header-mask {
    position: absolute;
    z-index: 120;
    top: 0;
    left: 0;
    right: 0;
    height: 18mm;
    background: #fff;
  }

  /* ---- En-tête / letterhead ---- */
  .letterhead { display: flex; gap: 12mm; align-items: flex-start; margin-bottom: 12mm; }
  .sender { flex: 1 1 42%; }
  .sender .logo { max-height: 72px; max-width: 195px; margin-bottom: 10px; object-fit: contain; }
  .sender .name { font-family: ${headingFontStack}; color: var(--title); font-size: 18pt; font-style: ${headingFontStyle.style}; font-weight: ${headingFontStyle.weight}; margin-bottom: 4px; }
  .sender .title { font-size: 10.5pt; font-style: italic; color: var(--ink); margin-bottom: 8px; }
  .sender .lines { display: grid; gap: 4px; font-size: 8.8pt; color: var(--muted); line-height: 1.35; }
  .address-row { display: grid; grid-template-columns: 36px minmax(0, 1fr); gap: 8px; align-items: baseline; }
  .address-row.address-postal { display: flex; flex-direction: column; gap: 2px; }
  .address-row.address-contact { display: block; white-space: nowrap; overflow-wrap: normal; word-break: normal; }
  .address-label { color: var(--title); font-size: 7.4pt; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; }
  .doc-meta { flex: 1 1 58%; background: var(--band); color: #fff; border-radius: 12px; padding: 16px 18px; }
  .doc-meta .doc-title {     text-align: right; font-family: ${bodyFontStack}; color: #fff; font-size: 19pt; font-style: ${bodyFontStyle.style}; font-weight: 600; line-height: 1.2; letter-spacing: .2px; margin-bottom: 12px; }
  .doc-meta .meta-row { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 12px; align-items: baseline; font-size: 9pt; padding: 3px 0; color: var(--meta-text); }
  .doc-meta .meta-label { color: var(--meta-label); font-size: 7.4pt; font-weight: 600; text-transform: uppercase; letter-spacing: .12em; }
  .doc-meta .meta-value { color: #fff; font-weight: 500; text-align: right; }
  .doc-meta .divider { height: 1px; background: rgba(255,255,255,.16); margin: 10px 0; }
  .doc-meta .client-row { align-items: start; padding-top: 0; }
  .doc-meta .client { display: grid; gap: 5px; font-size: 10pt; color: #fff; line-height: 1.35; text-align: right; }
  .doc-meta .client-name { font-weight: 700; }
  .doc-meta .client-address { display: flex; flex-direction: column; gap: 2px; color: rgba(255,255,255,.88); }
  .doc-meta .client-contact { color: rgba(255,255,255,.88); }
  .doc-meta .client-contact span { color: var(--meta-label); font-size: 7.4pt; font-weight: 600; text-transform: uppercase; letter-spacing: .08em; }

  /* ---- Sections ---- */
  .doc-section { margin-bottom: 9mm; }
  .doc-section > h2 {
    font-size: 16pt; margin: 0 0 10px; padding-bottom: 7px;
    color: var(--title); border-bottom: 1px solid var(--title);
    break-after: avoid;
    page-break-after: avoid;
  }
  .doc-section,
  .doc-section p,
  .doc-section li,
  .doc-section .cond-block,
  .doc-section .row-desc,
  .text-block,
  .scope-cell { text-align: justify; }

  .scope-cell {
    border: 1px solid var(--line); border-radius: 10px;
    background: var(--soft);
    padding: 12px 16px; margin-bottom: 13px;
  }
  .scope-cell h3 { font-size: 13pt; font-weight: 700; margin: 0 0 7px; break-after: avoid; page-break-after: avoid; }
  .scope-cell .subsection { margin-top: 8px; }
  .scope-cell .subsection h4 { font-size: 11pt; margin: 0 0 3px; color: var(--ink); break-after: avoid; page-break-after: avoid; }

  .text-block { margin-bottom: 15px; }
  .text-block h3 { font-size: 13pt; font-weight: 700; margin: 0 0 7px; break-after: avoid; page-break-after: avoid; }
  .text-block .subsection { margin-top: 8px; }
  .text-block .subsection h4 { font-size: 11pt; margin: 0 0 3px; break-after: avoid; page-break-after: avoid; }
  .text-block ul,
  .text-block ol,
  .scope-cell ul,
  .scope-cell ol { margin: 4px 0 0; padding-left: 20px; }
  .text-block li,
  .scope-cell li { margin: 3px 0; padding-left: 2px; }
  .text-block li ul,
  .text-block li ol,
  .scope-cell li ul,
  .scope-cell li ol { margin-top: 3px; padding-left: 16px; }

  .quote-part > h2 { display: flex; align-items: center; gap: 10px; }
  .part-badge {
    font-family: ${bodyFontStack}; font-size: 7.5pt; font-weight: 600;
    text-transform: uppercase; letter-spacing: .08em;
    color: var(--accent); border: 1px solid var(--accent); border-radius: 999px;
    padding: 1px 8px;
  }
  .invest .optional-row td { color: var(--muted); }

  .cond-block { margin-bottom: 8px; }
  .cond-block h3 { font-size: 12.5pt; margin: 0 0 4px; break-after: avoid; page-break-after: avoid; }
  .spaced-condition-entries .cond-block { margin-bottom: 13px; }
  .spaced-condition-entries .cond-block h3 { margin-bottom: 7px; }
  .spaced-condition-entries .cond-block > ul { margin-top: 5px; }
  .condition-entry-list { padding-left: 18px; }
  .condition-entry-list > .cond-block { display: list-item; margin-bottom: 6px; }
  .condition-entry-list > .cond-block > p:last-child,
  .condition-entry-list > .cond-block > ul:last-child { margin-bottom: 0; }
  .condition-entry-list,
  .condition-entry-list ul,
  .condition-entry-list li,
  .condition-entry-list p,
  .condition-entry-list .cond-block,
  .condition-entry-list .cond-block h3,
  .relaxed-condition-titles,
  .relaxed-condition-titles ul,
  .relaxed-condition-titles li,
  .relaxed-condition-titles p,
  .relaxed-condition-titles .cond-block,
  .relaxed-condition-titles .cond-block h3 {
    font-size: 10.5pt;
    line-height: 1.55;
  }
  .relaxed-condition-titles .cond-block h3 { font-family: ${bodyFontStack}; font-weight: 400; color: var(--ink); }
  .principle-card-section {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .principle-card-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8mm;
    align-items: start;
    padding-top: 5mm;
  }
  .principle-card {
    position: relative;
    min-height: 52mm;
    border: 1px solid rgba(35, 38, 47, .14);
    border-radius: 12px;
    background: color-mix(in srgb, var(--soft) 58%, #fff 42%);
    padding: 12mm 5mm 5mm;
    break-inside: avoid;
    page-break-inside: avoid;
    text-align: left;
    overflow-wrap: anywhere;
    word-break: normal;
    hyphens: auto;
  }
  .principle-card.no-seal {
    padding-top: 8mm;
  }
  .principle-card.has-seal {
    padding-top: 12mm;
  }
  .principle-card h3 {
    font-family: ${bodyFontStack};
    font-size: 9.2pt;
    font-style: ${bodyFontStyle.style};
    font-weight: 500;
    color: var(--ink);
    line-height: 1.22;
    margin: 0 0 4px;
    text-align: left;
  }
  .principle-card-body,
  .principle-card-body p,
  .principle-card-body li {
    font-family: ${bodyFontStack};
    font-size: 8.4pt;
    font-style: ${bodyFontStyle.style};
    font-weight: ${bodyFontStyle.weight};
    line-height: 1.24;
    text-align: left;
  }
  .principle-card-body ul {
    margin: 3px 0 0;
    padding-left: 12px;
  }
  .principle-card-body li {
    margin: 1.5px 0;
    padding-left: 1px;
  }
  .principle-card-body .sub {
    margin-top: 2px;
    padding-left: 10px;
  }
  .principle-seal {
    position: absolute;
    z-index: 1;
    max-width: 82%;
    padding: 2px 8px 3px;
    border: 1px solid color-mix(in srgb, var(--accent) 50%, transparent);
    border-radius: 999px;
    background: color-mix(in srgb, var(--accent) 8%, #fff 92%);
    color: var(--accent);
    font-size: 8.2pt;
    font-weight: 700;
    line-height: 1.15;
    letter-spacing: .02em;
    text-transform: lowercase;
    white-space: nowrap;
  }
  .principle-seal-0 { top: -3mm; left: 6mm; transform: rotate(-5deg); }
  .principle-seal-1 { top: 4mm; right: -2mm; transform: rotate(7deg); }
  .principle-seal-2 { top: -2mm; right: 6mm; transform: rotate(4deg); }
  .principle-seal-3 { top: 5mm; left: -2mm; transform: rotate(-8deg); }
  .principle-seal-4 { top: -3mm; left: 12mm; transform: rotate(6deg); }
  .principle-seal-5 { top: 4mm; right: 4mm; transform: rotate(-4deg); }
  .has-signature-block .signature-anchor {
    break-after: avoid;
    page-break-after: avoid;
  }
  .signature-keep-together {
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .signature-grid {
    display: grid;
    grid-template-columns: 1fr 1.35fr;
    gap: 18mm;
    margin-top: 10mm;
    break-before: avoid;
    page-break-before: avoid;
    break-inside: avoid;
  }
  .signature-box {
    min-height: 24mm;
    border: 1px solid var(--line);
    border-radius: 10px;
    padding: 10px 12px;
    background: #fff;
  }
  .signature-box span {
    display: block;
    color: var(--title);
    font-size: 9pt;
    font-weight: 600;
  }
  .page-break-before { break-before: page; page-break-before: always; }

  /* ---- Tableaux ---- */
  table { width: 100%; border-collapse: collapse; }
  .grid-table.invest,
  .grid-table.payment-schedule,
  .totals {
    border-collapse: separate;
    border-spacing: 0;
    overflow: hidden;
  }
  .grid-table.invest,
  .grid-table.payment-schedule {
    border: 1px solid var(--line);
    border-radius: 10px;
  }
  .grid-table.invest { border-radius: 10px 10px 0 0; }
  .grid-table th, .grid-table td { padding: 9px 12px; border-bottom: 1px solid var(--line); vertical-align: top; text-align: left; }
  .grid-table th.amount, .grid-table td.amount,
  .totals td.amount { text-align: right; }
  .grid-table thead th { background: var(--soft); font-family: ${bodyFontStack}; font-size: 8.5pt; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); }
  .grid-table thead th:first-child { border-radius: 10px 0 0 0; }
  .grid-table thead th:last-child { border-radius: 0 10px 0 0; }
  .grid-table.invest tbody tr:last-child td,
  .grid-table.payment-schedule tbody tr:last-child td { border-bottom: 0; }
  .grid-table .row-title { font-weight: 600; break-after: avoid; page-break-after: avoid; }
  .grid-table .row-desc { font-size: 9pt; color: var(--muted); margin-top: 2px; }
  .grid-table .row-desc ul { margin: 2px 0; }
  .amount { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .unit { color: var(--muted); font-weight: 400; }
  .hint { font-size: 8.5pt; color: var(--muted); font-style: italic; margin-top: 6px; }

  .totals {
    border: 1px solid var(--line);
    border-top: 3px solid var(--band);
    border-radius: 0 0 10px 10px;
    background: #fff;
  }
  .totals td { padding: 9px 14px; border-bottom: 1px solid var(--line); font-size: 10.5pt; }
  .totals .grand td {
    background: var(--soft);
    color: var(--ink);
    font-weight: 700;
    font-size: 11.5pt;
    border-bottom: 0;
  }
  .totals .grand td:first-child { border-radius: 0 0 0 10px; }
  .totals .grand td:last-child { border-radius: 0 0 10px 0; color: var(--band); }

  .avoid-break { break-inside: avoid; }

  @page { size: A4; margin: 0; }

  @media screen {
    body { background: #eceef1; padding: 84px 0 24px; }
    body.embedded-preview { background: #fff; padding: 0; }
    .page { background: #fff; padding: 20mm 16mm 24mm; box-shadow: 0 8px 40px rgba(0,0,0,.12); border-radius: 4px; }
    body.embedded-preview .page { box-shadow: none; border-radius: 0; }
    .print-header, .print-footer, .print-page-footers, .first-page-header-mask { display: none; }
    .preview-toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 50;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 24px;
      background: rgba(255,255,255,.94);
      border-bottom: 1px solid var(--line);
      box-shadow: 0 8px 28px rgba(0,0,0,.08);
      backdrop-filter: blur(10px);
    }
    .preview-toolbar strong {
      color: var(--title);
      font-family: ${headingFontStack};
      font-size: 12pt;
    }
    .preview-toolbar span {
      color: var(--muted);
      font-size: 9pt;
    }
    .preview-toolbar button {
      appearance: none;
      border: 1px solid var(--band);
      border-radius: 999px;
      background: var(--band);
      color: #fff;
      cursor: pointer;
      font: 600 9pt ${bodyFontStack};
      padding: 9px 15px;
    }
  }

  @media print {
    .preview-toolbar { display: none; }
    .print-header,
    .print-footer {
      display: flex !important;
      position: fixed !important;
      left: 16mm;
      right: 16mm;
      background: #fff;
      z-index: 100;
    }
    .print-footer {
      display: none !important;
    }
    .print-page-footers { display: block !important; }
    .page {
      padding-top: 22mm;
      padding-bottom: 26mm;
      -webkit-box-decoration-break: clone;
      box-decoration-break: clone;
    }
  }
</style>
</head>
<body class="${showPreviewToolbar ? "standalone-preview" : "embedded-preview"}">
  ${
    showPreviewToolbar
      ? `<div class="preview-toolbar">
    <div>
      <strong>Aperçu du devis</strong>
      <span>${escapeHtml(quote.quoteRef)}</span>
    </div>
    <button type="button" onclick="window.print()">Imprimer / enregistrer en PDF</button>
  </div>`
      : ""
  }

  <div class="print-header">${escapeHtml(quote.quoteRef)}</div>
  <footer class="print-footer">
    <span>${footerWebsite}</span>
  </footer>

  <main class="page">
    <div class="first-page-header-mask" aria-hidden="true"></div>
    <div class="print-page-footers" data-website="${footerWebsite}" aria-hidden="true"></div>
    <header class="letterhead">
      <div class="sender">
        ${logo}
        ${senderName ? `<div class="name">${senderName}</div>` : ""}
        ${senderTitle ? `<div class="title">${senderTitle}</div>` : ""}
        <div class="lines">${senderLines}</div>
      </div>
      <div class="doc-meta">
        <div class="doc-title">${bigTitle}</div>
        <div class="meta-row"><span class="meta-label">${escapeHtml(t.quoteNo)}</span><strong class="meta-value">${escapeHtml(quote.quoteRef)}</strong></div>
        ${quoteDate ? `<div class="meta-row"><span class="meta-label">${escapeHtml(t.date)}</span><strong class="meta-value">${escapeHtml(quoteDate)}</strong></div>` : ""}
        ${validity ? `<div class="meta-row"><span class="meta-label">${escapeHtml(t.validity)}</span><strong class="meta-value">${escapeHtml(validity)}</strong></div>` : ""}
        <div class="divider"></div>
        <div class="meta-row client-row">
          <span class="meta-label">${escapeHtml(t.for)}</span>
          <div class="client">${clientBlock}</div>
        </div>
      </div>
    </header>

    ${proposal}
    ${partsContent}
    ${totalsTable}
    ${paymentScheduleTable}
    ${optionsTable}
    ${conditions}
  </main>

  <script>
    const renderPrintPageFooters = () => {
      const page = document.querySelector('.page');
      const footers = document.querySelector('.print-page-footers');
      if (!page || !footers) return;

      footers.innerHTML = '';

      const measure = document.createElement('div');
      measure.style.position = 'absolute';
      measure.style.left = '-9999px';
      measure.style.top = '0';
      measure.style.width = '1px';
      measure.style.height = '297mm';
      document.body.appendChild(measure);
      const pageHeightPx = measure.getBoundingClientRect().height || 1122;
      measure.remove();

      const pageCount = Math.max(1, Math.ceil(page.scrollHeight / pageHeightPx));
      const website = footers.getAttribute('data-website') || '';

      for (let index = 0; index < pageCount; index += 1) {
        const footer = document.createElement('div');
        footer.className = 'print-page-footer';
        footer.style.top = String(index * 297 + 287) + 'mm';

        const site = document.createElement('span');
        site.textContent = website;
        const number = document.createElement('span');
        number.textContent = String(index + 1) + '/' + String(pageCount);

        footer.append(site, number);
        footers.appendChild(footer);
      }
    };

    window.addEventListener('load', async () => {
      try { if (document.fonts && document.fonts.ready) { await document.fonts.ready; } } catch (e) {}
      renderPrintPageFooters();
    });
    window.addEventListener('beforeprint', renderPrintPageFooters);
  </script>
</body>
</html>`;
};

/**
 * Ouvre le devis dans une nouvelle fenêtre de prévisualisation.
 */
export const previewQuoteDocument = (
  quote: Quote,
  profile: UserProfile | null,
): boolean => {
  const html = renderQuoteDocumentHtml(quote, profile);
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
};
