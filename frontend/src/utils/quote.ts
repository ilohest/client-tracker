import type { Quote, QuoteAddon, QuoteConditionItem, QuoteDiscountType, QuoteInput, VatRate } from '@client-tracker/contracts';

export const createEntityId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const getClientInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((chunk) => chunk[0]?.toUpperCase() || '')
    .join('');

export const generateQuoteReference = (clientName: string, creationDate: Date = new Date()): string => {
  const datePart = [
    creationDate.getFullYear(),
    `${creationDate.getMonth() + 1}`.padStart(2, '0'),
    `${creationDate.getDate()}`.padStart(2, '0'),
  ].join('_');

  const initials = getClientInitials(clientName);
  return initials ? `${datePart}_${initials}` : datePart;
};

export const getTodayQuoteDate = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseQuoteDate = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

export const formatQuoteDate = (value: string, locale: string = 'fr-FR'): string =>
  parseQuoteDate(value).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

export const getQuoteValidityDate = (quoteDate: string): string => {
  const parsed = parseQuoteDate(quoteDate);
  const next = new Date(parsed);
  next.setMonth(next.getMonth() + 1);
  const year = next.getFullYear();
  const month = `${next.getMonth() + 1}`.padStart(2, '0');
  const day = `${next.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const calculateAddonTotal = (addons: QuoteAddon[]): number =>
  addons.reduce((total, item) => total + Number(item.price || 0), 0);

export const calculateDiscountAmount = (
  amountBeforeDiscount: number,
  discountType: QuoteDiscountType,
  discountValue: number,
): number => {
  const normalizedAmount = Number(amountBeforeDiscount || 0);
  const normalizedDiscount = Math.max(Number(discountValue || 0), 0);
  const rawDiscount =
    discountType === 'percent'
      ? normalizedAmount * (normalizedDiscount / 100)
      : normalizedDiscount;

  return Number(Math.min(rawDiscount, normalizedAmount).toFixed(2));
};

export const calculateQuoteTotals = (
  basePrice: number,
  addons: QuoteAddon[],
  vatRate: VatRate,
  discountType: QuoteDiscountType,
  discountValue: number,
): { addonsTotal: number; discountAmount: number; subtotal: number; vatAmount: number; totalWithVat: number } => {
  const addonsTotal = calculateAddonTotal(addons);
  const amountBeforeDiscount = Number(basePrice || 0) + addonsTotal;
  const discountAmount = calculateDiscountAmount(amountBeforeDiscount, discountType, discountValue);
  const subtotal = Math.max(amountBeforeDiscount - discountAmount, 0);
  const vatAmount = subtotal * (vatRate / 100);
  const totalWithVat = subtotal * (1 + vatRate / 100);
  return {
    addonsTotal: Number(addonsTotal.toFixed(2)),
    discountAmount,
    subtotal: Number(subtotal.toFixed(2)),
    vatAmount: Number(vatAmount.toFixed(2)),
    totalWithVat: Number(totalWithVat.toFixed(2)),
  };
};

export const formatCurrency = (value: number, locale: string = 'fr-FR'): string =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 2,
  }).format(value);

export const getQuotePlatformLabel = (platform: Quote['platform'], customPlatformLabel: string = ''): string => {
  if (platform === 'other' && customPlatformLabel.trim()) return customPlatformLabel.trim();
  return platform;
};

const cloneConditionItems = (items: QuoteConditionItem[] = []): QuoteConditionItem[] =>
  items.map((item) => ({
    ...item,
    id: createEntityId(),
    subItems: (item.subItems || []).map((subItem) => ({
      ...subItem,
      id: createEntityId(),
    })),
  }));

export const duplicateQuoteInput = (quote: Quote): QuoteInput => {
  const nextQuoteDate = getTodayQuoteDate();

  return {
    clientId: quote.clientId || '',
    title: quote.title || '',
    quoteDate: nextQuoteDate,
    quoteRef: generateQuoteReference(quote.clientName, parseQuoteDate(nextQuoteDate)),
    platform: quote.platform,
    customPlatformLabel: quote.customPlatformLabel || '',
    language: quote.language,
    clientName: quote.clientName,
    clientAddress: quote.clientAddress,
    clientWebsite: quote.clientWebsite,
    vatRate: quote.vatRate,
    projectSummary: quote.projectSummary,
    emailDraft: quote.emailDraft,
    emailSubject: quote.emailSubject || '',
    emailBody: quote.emailBody || '',
    basePrice: quote.basePrice || 0,
    discountType: quote.discountType || 'percent',
    discountValue: quote.discountValue || 0,
    sections: quote.sections.map((section) => ({
      ...section,
      id: createEntityId(),
      subSections: (section.subSections || []).map((subSection) => ({
        ...subSection,
        id: createEntityId(),
      })),
    })),
    conditions: quote.conditions.map((condition) => ({
      ...condition,
      id: createEntityId(),
      items: cloneConditionItems(condition.items || []),
    })),
    addons: quote.addons.map((addon) => ({
      ...addon,
      id: createEntityId(),
      items: cloneConditionItems(addon.items || []),
    })),
    status: 'draft',
  };
};

export const buildQuotePlainText = (quote: Quote): string[] => {
  const lines: string[] = [];

  lines.push(`DEVIS ${quote.quoteRef}`);
  if (quote.title) lines.push(`Titre: ${quote.title}`);
  if (quote.quoteDate) {
    lines.push(`Date du devis: ${formatQuoteDate(quote.quoteDate)}`);
    lines.push(`Validite: ${formatQuoteDate(getQuoteValidityDate(quote.quoteDate))}`);
  }
  lines.push('');
  lines.push(`Client: ${quote.clientName}`);
  if (quote.clientAddress) lines.push(`Adresse: ${quote.clientAddress}`);
  if (quote.clientWebsite) lines.push(`Site: ${quote.clientWebsite}`);
  lines.push(`Plateforme: ${getQuotePlatformLabel(quote.platform, quote.customPlatformLabel)}`);
  lines.push(`Langue: ${quote.language}`);
  lines.push('');
  lines.push('Description du projet');
  lines.push(quote.projectSummary || 'A completer');
  lines.push('');
  lines.push('Prestations');
  quote.sections.forEach((section) => {
    lines.push(`- ${section.title}`);
    lines.push(`  ${section.description}`);
    (section.subSections || []).forEach((subSection) => {
      lines.push(`  > ${subSection.title}`);
      lines.push(`    ${subSection.body}`);
    });
  });
  if (quote.addons.length > 0) {
    lines.push('');
    lines.push('Add-ons');
    quote.addons.forEach((addon) => {
      lines.push(`- ${addon.title} | ${formatCurrency(addon.price)}`);
      if (addon.items?.length) {
        addon.items.forEach((item) => {
          lines.push(`  • ${item.text}`);
          (item.subItems || []).forEach((subItem) => {
            lines.push(`    ◦ ${subItem.text}`);
          });
        });
      } else {
        lines.push(`  ${addon.description}`);
      }
    });
  }
  lines.push('');
  lines.push('Conditions');
  quote.conditions.forEach((condition) => {
    lines.push(`- ${condition.title}`);
    if (condition.items?.length) {
      condition.items.forEach((item) => {
        lines.push(`  • ${item.text}`);
        (item.subItems || []).forEach((subItem) => {
          lines.push(`    ◦ ${subItem.text}`);
        });
      });
    } else if (condition.body) {
      lines.push(`  ${condition.body}`);
    }
  });
  lines.push('');
  lines.push(`Prix de base HT: ${formatCurrency(quote.basePrice || 0)}`);
  if ((quote.discountValue || 0) > 0) {
    const label = quote.discountType === 'fixed' ? formatCurrency(quote.discountValue || 0) : `${quote.discountValue || 0}%`;
    lines.push(`Reduction: ${label}`);
  }
  lines.push(`Sous-total HT: ${formatCurrency(quote.subtotal)}`);
  lines.push(`TVA: ${quote.vatRate}%`);
  lines.push(`Total TTC: ${formatCurrency(quote.totalWithVat)}`);
  return lines;
};
