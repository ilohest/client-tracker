import type { Quote, QuoteAddon, QuoteConditionItem, QuoteDiscountType, QuoteInput, QuoteInvestmentLine, QuotePart, QuotePaymentScheduleStep, QuoteSection, VatRate } from '@client-tracker/contracts';

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
  includeInInvestment: true,
  priceNote: '',
  sections: [],
});

/** Sous-total = somme des prix des parties facturées et non optionnelles (hors add-ons). */
export const calculatePartsSubtotal = (parts: QuotePart[] = []): number =>
  Number(
    parts
      .filter((part) => !part.optional && part.includeInInvestment !== false)
      .reduce((sum, part) => sum + Number(part.price || 0), 0)
      .toFixed(2),
  );

export const calculateQuotePartsTotals = (
  parts: QuotePart[],
  vatRate: VatRate,
  discountType: QuoteDiscountType,
  discountValue: number,
  investmentAmount: number = 0,
): { partsSubtotal: number; discountAmount: number; subtotal: number; vatAmount: number; totalWithVat: number } => {
  const partsSubtotal = calculatePartsSubtotal(parts);
  const amountBeforeDiscount =
    Number(investmentAmount || 0) > 0
      ? Number(investmentAmount || 0)
      : partsSubtotal;
  const discountAmount = calculateDiscountAmount(amountBeforeDiscount, discountType, discountValue);
  const subtotal = Math.max(amountBeforeDiscount - discountAmount, 0);
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

export const createPaymentScheduleStep = (
  index: number,
  totalSteps: number,
): QuotePaymentScheduleStep => ({
  id: createEntityId(),
  label: `Étape ${index + 1}`,
  mode: 'percent',
  value: totalSteps > 0 ? Number((100 / totalSteps).toFixed(2)) : 100,
});

export const createDefaultPaymentSchedule = (): QuotePaymentScheduleStep[] => [
  { id: createEntityId(), label: 'Acompte à la validation du devis', mode: 'percent', value: 40 },
  { id: createEntityId(), label: 'Paiement intermédiaire', mode: 'percent', value: 40 },
  { id: createEntityId(), label: 'Solde à la livraison', mode: 'percent', value: 20 },
];

export const clonePaymentSchedule = (
  steps: QuotePaymentScheduleStep[] = [],
): QuotePaymentScheduleStep[] =>
  steps.map((step, index) => ({
    id: step.id || createEntityId(),
    label: step.label || `Étape ${index + 1}`,
    mode: step.mode || 'percent',
    value: Number(step.value || 0),
  }));

export const resizePaymentSchedule = (
  steps: QuotePaymentScheduleStep[] = [],
  count: number,
): QuotePaymentScheduleStep[] => {
  const normalizedCount = Math.max(1, Math.min(12, Math.round(Number(count || 1))));
  const next = clonePaymentSchedule(steps).slice(0, normalizedCount);
  while (next.length < normalizedCount) {
    next.push(createPaymentScheduleStep(next.length, normalizedCount));
  }

  if (!steps.length || next.every((step) => step.mode === 'percent')) {
    const base = Math.floor((100 / normalizedCount) * 100) / 100;
    const remainder = Number((100 - base * normalizedCount).toFixed(2));
    return next.map((step, index) => ({
      ...step,
      value: Number((base + (index === normalizedCount - 1 ? remainder : 0)).toFixed(2)),
    }));
  }

  return next;
};

export const calculatePaymentScheduleStepAmounts = (
  step: QuotePaymentScheduleStep,
  subtotal: number,
  totalWithVat: number,
): { amountExcl: number; amountIncl: number; percent: number } => {
  const normalizedSubtotal = Number(subtotal || 0);
  const normalizedTotal = Number(totalWithVat || 0);
  const value = Math.max(Number(step.value || 0), 0);
  const amountExcl = step.mode === 'percent' ? normalizedSubtotal * (value / 100) : value;
  const percent = normalizedSubtotal > 0 ? (amountExcl / normalizedSubtotal) * 100 : 0;
  const amountIncl = normalizedSubtotal > 0
    ? normalizedTotal * (amountExcl / normalizedSubtotal)
    : step.mode === 'fixed'
      ? value
      : 0;

  return {
    amountExcl: Number(amountExcl.toFixed(2)),
    amountIncl: Number(amountIncl.toFixed(2)),
    percent: Number(percent.toFixed(2)),
  };
};

/** Crée une ligne d'investissement vide (montant fixe par défaut). */
export const createInvestmentLine = (): QuoteInvestmentLine => ({
  id: createEntityId(),
  label: '',
  mode: 'fixed',
  value: 0,
  note: '',
});

/**
 * Montant HT d'une ligne d'investissement. En mode `percent`, la valeur est un
 * pourcentage du Prix global HT (`investmentAmount`) passé en base.
 */
export const calculateInvestmentLineAmount = (
  line: QuoteInvestmentLine,
  investmentAmount: number,
): number => {
  const value = Math.max(Number(line.value || 0), 0);
  const amount =
    line.mode === 'percent'
      ? Number(investmentAmount || 0) * (value / 100)
      : value;
  return Number(amount.toFixed(2));
};

/** Somme HT des lignes d'investissement (base = Prix global HT). */
export const calculateInvestmentLinesTotal = (
  lines: QuoteInvestmentLine[] = [],
  investmentAmount: number = 0,
): number =>
  Number(
    lines
      .reduce((sum, line) => sum + calculateInvestmentLineAmount(line, investmentAmount), 0)
      .toFixed(2),
  );

export const cloneInvestmentLines = (
  lines: QuoteInvestmentLine[] = [],
): QuoteInvestmentLine[] =>
  lines.map((line) => ({
    id: line.id || createEntityId(),
    label: line.label || '',
    mode: line.mode || 'fixed',
    value: Number(line.value || 0),
    note: line.note || '',
  }));

/** Convertit les parties incluses en lignes d'investissement (montant fixe). */
export const investmentLinesFromParts = (
  parts: QuotePart[] = [],
): QuoteInvestmentLine[] =>
  parts
    .filter((part) => part.includeInInvestment !== false)
    .map((part, index) => ({
      id: createEntityId(),
      label: part.title?.trim() || `Partie ${index + 1}`,
      mode: 'fixed' as const,
      value: Number(part.price || 0),
      note: part.optional && part.priceNote?.trim() ? part.priceNote.trim() : '',
    }));

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
    templateId: quote.templateId || '',
    title: quote.title || '',
    projectName: quote.projectName || '',
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
    investmentSummary: quote.investmentSummary || '',
    investmentAmount: Number(quote.investmentAmount || 0),
    investmentLines: cloneInvestmentLines(quote.investmentLines || []),
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
    paymentSchedule: clonePaymentSchedule(quote.paymentSchedule || []),
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
  projectId: quote.projectId || '',
});
