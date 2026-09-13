import type {
  QuoteBlock,
  QuoteLanguage,
  QuoteTemplate,
  QuoteTemplateInput,
  QuoteTemplateLocalizedContent,
} from "@client-tracker/contracts";

export type TemplateLanguageStatus = "complete" | "partial" | "empty";

const hasBlocks = (blocks: QuoteBlock[] = []) =>
  blocks.some(
    (block) =>
      block.text?.trim() ||
      block.table?.columns.some((cell) => cell.trim()) ||
      block.table?.rows.some((row) => row.cells.some((cell) => cell.trim())),
  );

const hasLocalizedContent = (content: QuoteTemplateLocalizedContent) =>
  Boolean(
    content.projectSummary.trim() ||
      content.emailSubject.trim() ||
      content.emailBody.trim() ||
      content.parts.some(
        (part) =>
          part.title.trim() ||
          part.sections.some((section) => section.title.trim() || hasBlocks(section.blocks)),
      ) ||
      content.deliverables.some(
        (section) => section.title.trim() || hasBlocks(section.blocks),
      ) ||
      [...content.conditions, ...content.roadmap, ...content.acceptance, ...content.principles].some(
        (entry) => entry.title.trim() || hasBlocks(entry.blocks),
      ) ||
      content.addons.some((addon) => addon.title.trim() || hasBlocks(addon.blocks)),
  );

export const getTemplateLanguageContent = (
  template: QuoteTemplate | QuoteTemplateInput,
  language: QuoteLanguage,
): QuoteTemplateLocalizedContent | null => {
  const localized = template.localizedContent?.[language];
  if (localized) return localized;
  if (template.language !== language) return null;
  return {
    projectSummary: template.projectSummary || "",
    emailSubject: template.emailSubject || "",
    emailBody: template.emailBody || "",
    parts: template.parts || [],
    deliverables: template.deliverables || [],
    conditions: template.conditions || [],
    roadmap: template.roadmap || [],
    acceptance: template.acceptance || [],
    principles: template.principles || [],
    addons: template.addons || [],
    paymentSchedule: template.paymentSchedule || [],
  };
};

export const getTemplateLanguageStatus = (
  template: QuoteTemplate | QuoteTemplateInput,
  language: QuoteLanguage,
): TemplateLanguageStatus => {
  const content = getTemplateLanguageContent(template, language);
  if (!content || !hasLocalizedContent(content)) return "empty";

  const isBase = template.kind === "base";
  const complete = isBase
    ? Boolean(
        content.emailSubject.trim() &&
          content.emailBody.trim() &&
          content.conditions.length &&
          content.acceptance.length &&
          content.principles.length,
      )
    : Boolean(
        content.projectSummary.trim() &&
          content.parts.some(
            (part) =>
              part.title.trim() ||
              part.sections.some((section) => section.title.trim() || hasBlocks(section.blocks)),
          ) &&
          content.conditions.length,
      );

  return complete ? "complete" : "partial";
};
