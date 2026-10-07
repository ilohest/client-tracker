import type {
  QuoteCondition,
  QuoteLanguage,
  QuoteTemplateInput,
  QuoteTemplateLocalizedContent,
} from "@client-tracker/contracts";
import { createEntityId } from "@/utils/quote";
import { cloneBlocks, comparableBlocks } from "@/utils/quoteBlocks";

const quoteTemplateLanguages: QuoteLanguage[] = ["fr", "en", "es"];

export const cloneQuoteConditions = (
  conditions: QuoteCondition[] = [],
): QuoteCondition[] =>
  conditions.map((condition) => ({
    ...condition,
    id: condition.id || createEntityId(),
    commonConditionId: condition.commonConditionId || "",
    tag: condition.tag || "",
    blocks: cloneBlocks(condition.blocks || []),
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
      blocks: cloneBlocks(source.blocks || []),
    };
  });

export const comparableCondition = (condition: QuoteCondition) => {
  if (condition.commonConditionId) {
    return {
      commonConditionId: condition.commonConditionId,
    };
  }

  return {
    title: condition.title || "",
    tag: condition.tag || "",
    blocks: comparableBlocks(condition.blocks || []),
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
  deliverables: (slice.deliverables || []).map((section) => ({
    title: section.title || "",
    blocks: comparableBlocks(section.blocks || []),
  })),
  deliverablesDisplayStyle: slice.deliverablesDisplayStyle || "flow",
  conditions: (slice.conditions || []).map(comparableCondition),
  roadmap: (slice.roadmap || []).map(comparableCondition),
  roadmapDisplayStyle: slice.roadmapDisplayStyle || "flow",
  acceptance: (slice.acceptance || []).map(comparableCondition),
  principles: (slice.principles || []).map(comparableCondition),
  addons: (slice.addons || []).map((addon) => ({
    title: addon.title || "",
    blocks: comparableBlocks(addon.blocks || []),
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
  discountLabel: template.discountLabel || "",
  investmentNote: template.investmentNote || "",
  localizedContent: Object.fromEntries(
    quoteTemplateLanguages.map((language) => [
      language,
      comparableLocalizedSlice(
        template.localizedContent?.[language] || {
          projectSummary: "",
          emailSubject: "",
          emailBody: "",
          parts: [],
          deliverables: [],
          deliverablesDisplayStyle: "flow",
          conditions: [],
          roadmap: [],
          roadmapDisplayStyle: "flow",
          acceptance: [],
          principles: [],
          addons: [],
          paymentSchedule: [],
        },
      ),
    ]),
  ) as Record<QuoteLanguage, ReturnType<typeof comparableLocalizedSlice>>,
});
