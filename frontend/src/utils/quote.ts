import type { Quote, QuoteAddon, QuoteConditionItem, QuoteDiscountType, QuoteInput, QuotePart, QuoteSection, VatRate } from '@client-tracker/contracts';

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

/** Crée une partie vide (prête à remplir dans le builder). */
export const createEmptyQuotePart = (): QuotePart => ({
  id: createEntityId(),
  title: '',
  displayStyle: 'text',
  price: 0,
  optional: false,
  priceNote: '',
  sections: [],
});

/** Sous-total = somme des prix des parties non optionnelles (hors add-ons). */
export const calculatePartsSubtotal = (parts: QuotePart[] = []): number =>
  Number(
    parts
      .filter((part) => !part.optional)
      .reduce((sum, part) => sum + Number(part.price || 0), 0)
      .toFixed(2),
  );

export const calculateQuotePartsTotals = (
  parts: QuotePart[],
  vatRate: VatRate,
  discountType: QuoteDiscountType,
  discountValue: number,
): { partsSubtotal: number; discountAmount: number; subtotal: number; vatAmount: number; totalWithVat: number } => {
  const partsSubtotal = calculatePartsSubtotal(parts);
  const discountAmount = calculateDiscountAmount(partsSubtotal, discountType, discountValue);
  const subtotal = Math.max(partsSubtotal - discountAmount, 0);
  const vatAmount = subtotal * (vatRate / 100);
  const totalWithVat = subtotal * (1 + vatRate / 100);
  return {
    partsSubtotal,
    discountAmount,
    subtotal: Number(subtotal.toFixed(2)),
    vatAmount: Number(vatAmount.toFixed(2)),
    totalWithVat: Number(totalWithVat.toFixed(2)),
  };
};

export const calculateAddonTotal = (addons: QuoteAddon[]): number =>
  addons.reduce((total, item) => {
    if (item.enabled === false) return total;
    return total + Number(item.price || 0);
  }, 0);

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

const cloneSections = (sections: QuoteSection[] = []): QuoteSection[] =>
  sections.map((section) => ({
    ...section,
    id: createEntityId(),
    items: cloneConditionItems(section.items || []),
    subSections: (section.subSections || []).map((subSection) => ({
      ...subSection,
      id: createEntityId(),
    })),
  }));

export const cloneQuoteParts = (parts: QuotePart[] = []): QuotePart[] =>
  parts.map((part) => ({
    ...part,
    id: createEntityId(),
    sections: cloneSections(part.sections || []),
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
    discountType: quote.discountType || 'percent',
    discountValue: quote.discountValue || 0,
    version: 1,
    versionGroupId: createEntityId(),
    parts: cloneQuoteParts(quote.parts),
    conditions: quote.conditions.map((condition) => ({
      ...condition,
      id: createEntityId(),
      items: cloneConditionItems(condition.items || []),
    })),
    roadmap: (quote.roadmap || []).map((phase) => ({
      ...phase,
      id: createEntityId(),
      items: cloneConditionItems(phase.items || []),
    })),
    acceptance: (quote.acceptance || []).map((entry) => ({
      ...entry,
      id: createEntityId(),
      items: cloneConditionItems(entry.items || []),
    })),
    principles: (quote.principles || []).map((principle) => ({
      ...principle,
      id: createEntityId(),
      items: cloneConditionItems(principle.items || []),
    })),
    addons: quote.addons.map((addon) => ({
      ...addon,
      id: createEntityId(),
      items: cloneConditionItems(addon.items || []),
    })),
    status: 'draft',
  };
};

/**
 * Crée l'input d'une NOUVELLE VERSION d'un devis : même famille
 * (`versionGroupId`) et même référence, contenu cloné, statut remis à
 * `draft`. À utiliser quand le client demande des modifications après envoi.
 */
export const createQuoteVersionInput = (quote: Quote, nextVersion: number): QuoteInput => ({
  ...duplicateQuoteInput(quote),
  quoteRef: quote.quoteRef,
  version: nextVersion,
  versionGroupId: quote.versionGroupId || quote.id,
});
