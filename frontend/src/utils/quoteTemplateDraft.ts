import type {
  QuoteCondition,
  QuoteConditionItem,
  QuoteLanguage,
  QuoteTemplateInput,
  QuoteTemplateLocalizedContent,
} from "@client-tracker/contracts";
import { createEntityId } from "@/utils/quote";
import { comparableBlocks } from "@/utils/quoteBlocks";

const quoteTemplateLanguages: QuoteLanguage[] = ["fr", "en", "es"];

export const cloneQuoteConditionItems = (
  items: QuoteConditionItem[] = [],
): QuoteConditionItem[] =>
  items.map((item) => ({
    id: item.id || createEntityId(),
    text: item.text || "",
    subItems: (item.subItems || []).map((subItem) => ({
      id: subItem.id || createEntityId(),
      text: subItem.text || "",
    })),
  }));

export const cloneQuoteConditions = (
  conditions: QuoteCondition[] = [],
): QuoteCondition[] =>
  conditions.map((condition) => ({
    ...condition,
    id: condition.id || createEntityId(),
    commonConditionId: condition.commonConditionId || "",
    tag: condition.tag || "",
    body: condition.body || "",
    items: cloneQuoteConditionItems(condition.items || []),
  }));

export const resolveCommonConditionReferences = (
  conditions: QuoteCondition[] = [],
  commonConditions: QuoteCondition[] = [],
  options: { keepReference?: boolean } = {},
): QuoteCondition[] =>
  conditions.map((condition) => {
    const commonCondition = condition.commonConditionId
      ? commonConditions.find((entry) => entry.id === condition.commonConditionId)
      : null;
    const source = commonCondition || condition;
    return {
      ...source,
      id: condition.id || createEntityId(),
      commonConditionId: options.keepReference
        ? condition.commonConditionId || ""
        : "",
      tag: source.tag || "",
      body: source.body || "",
      items: cloneQuoteConditionItems(source.items || []),
    };
  });

const comparableItems = (items: QuoteConditionItem[] = []) =>
  items.map((item) => ({
    text: item.text || "",
    subItems: (item.subItems || []).map((subItem) => ({
      text: subItem.text || "",
    })),
  }));

export const comparableCondition = (condition: QuoteCondition) => {
  if (condition.commonConditionId) {
    return {
      commonConditionId: condition.commonConditionId,
    };
  }

  return {
    title: condition.title || "",
    tag: condition.tag || "",
    body: condition.body || "",
    items: comparableItems(condition.items || []),
  };
};

const comparableLocalizedSlice = (slice: QuoteTemplateLocalizedContent) => ({
  projectSummary: slice.projectSummary || "",
  emailSubject: slice.emailSubject || "",
  emailBody: slice.emailBody || "",
  parts: (slice.parts || []).map((part) => ({
    title: part.title || "",
    displayStyle: part.displayStyle || "text",
    price: Number(part.price || 0),
    optional: Boolean(part.optional),
    includeInInvestment: part.includeInInvestment !== false,
    priceNote: part.priceNote || "",
    sections: (part.sections || []).map((section) => ({
      title: section.title || "",
      blocks: comparableBlocks(section.blocks || []),
    })),
  })),
  conditions: (slice.conditions || []).map(comparableCondition),
  roadmap: (slice.roadmap || []).map(comparableCondition),
  acceptance: (slice.acceptance || []).map(comparableCondition),
  principles: (slice.principles || []).map(comparableCondition),
  addons: (slice.addons || []).map((addon) => ({
    title: addon.title || "",
    description: addon.description || "",
    items: comparableItems(addon.items || []),
    price: Number(addon.price || 0),
    unitLabel: addon.unitLabel || "",
    enabled: addon.enabled ?? true,
  })),
  paymentSchedule: (slice.paymentSchedule || []).map((step) => ({
    label: step.label || "",
    mode: step.mode || "percent",
    value: Number(step.value || 0),
  })),
});

export const comparableQuoteTemplate = (template: QuoteTemplateInput) => ({
  name: template.name || "",
  kind: template.kind || "custom",
  platform: template.platform,
  customPlatformLabel: template.customPlatformLabel || "",
  language: template.language,
  vatRate: template.vatRate,
  discountType: template.discountType || "percent",
  discountValue: Number(template.discountValue || 0),
  localizedContent: Object.fromEntries(
    quoteTemplateLanguages.map((language) => [
      language,
      comparableLocalizedSlice(
        template.localizedContent?.[language] || {
          projectSummary: "",
          emailSubject: "",
          emailBody: "",
          parts: [],
          conditions: [],
          roadmap: [],
          acceptance: [],
          principles: [],
          addons: [],
          paymentSchedule: [],
        },
      ),
    ]),
  ) as Record<QuoteLanguage, ReturnType<typeof comparableLocalizedSlice>>,
});
