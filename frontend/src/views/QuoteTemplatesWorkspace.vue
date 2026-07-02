<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import type {
  QuoteAddon,
  QuoteCondition,
  QuoteConditionItem,
  QuoteDiscountType,
  QuoteLanguage,
  QuoteSection,
  QuoteTemplate,
  QuoteTemplateInput,
  QuoteTemplateLocalizedContent,
} from "@client-tracker/contracts";
import Button from "primevue/button";
import ConfirmDialog from "primevue/confirmdialog";
import InputText from "primevue/inputtext";
import { useConfirm } from "primevue/useconfirm";
import QuoteBuilderForm from "@/components/quotes/QuoteBuilderForm.vue";
import {
  createBlankAddon,
  createDefaultQuoteTemplate,
  createDefaultQuoteTemplateLocalizedContent,
} from "@/lib/clientPresets";
import { useQuoteTemplatesStore } from "@/stores/quoteTemplatesStore";
import { cloneQuoteParts, createEntityId } from "@/utils/quote";
import { useToast } from "primevue/usetoast";

const quoteTemplatesStore = useQuoteTemplatesStore();
const toast = useToast();
const confirm = useConfirm();

const createTemplateDraft = (): QuoteTemplateInput =>
  createDefaultQuoteTemplate("Template de devis", "shopify", "fr");

const form = reactive<QuoteTemplateInput>(createTemplateDraft());
let syncingLocalizedContent = false;
let hydratingTemplate = false;

const cloneItems = (items: QuoteConditionItem[] = []): QuoteConditionItem[] =>
  items.map((item) => ({
    id: item.id || createEntityId(),
    text: item.text || "",
    subItems: (item.subItems || []).map((subItem) => ({
      id: subItem.id || createEntityId(),
      text: subItem.text || "",
    })),
  }));

const cloneSections = (sections: QuoteSection[] = []) =>
  sections.map((section) => ({
    ...section,
    id: section.id || createEntityId(),
    items: cloneItems(section.items),
    subSections: (section.subSections || []).map((subSection) => ({
      ...subSection,
      id: subSection.id || createEntityId(),
    })),
  }));

const cloneParts = (parts: QuoteTemplateLocalizedContent["parts"] = []) =>
  parts.map((part) => ({
    ...part,
    id: part.id || createEntityId(),
    sections: cloneSections(part.sections || []),
  }));

const partsFromContent = (
  content: Pick<QuoteTemplateLocalizedContent, "parts">,
) => cloneQuoteParts(content.parts);

const cloneConditions = (
  conditions: QuoteTemplateLocalizedContent["conditions"] = [],
) =>
  conditions.map((condition) => ({
    ...condition,
    id: condition.id || createEntityId(),
    items: cloneItems(condition.items),
  }));

const cloneAddons = (addons: QuoteTemplateLocalizedContent["addons"] = []) =>
  addons.map((addon) => ({
    ...addon,
    id: addon.id || createEntityId(),
    unitLabel: addon.unitLabel || "",
    items: cloneItems(addon.items),
  }));

const cloneLocalizedSlice = (
  slice?: Partial<QuoteTemplateLocalizedContent> | null,
): QuoteTemplateLocalizedContent => ({
  projectSummary: slice?.projectSummary || "",
  parts: cloneParts(slice?.parts || []),
  conditions: cloneConditions(slice?.conditions || []),
  roadmap: cloneConditions(slice?.roadmap || []),
  acceptance: cloneConditions(slice?.acceptance || []),
  principles: cloneConditions(slice?.principles || []),
  addons: cloneAddons(slice?.addons || []),
});

const getLegacyLocalizedContent = (
  source: Pick<
    QuoteTemplateInput,
    | "projectSummary"
    | "parts"
    | "conditions"
    | "roadmap"
    | "acceptance"
    | "principles"
    | "addons"
  >,
): Record<QuoteLanguage, QuoteTemplateLocalizedContent> => ({
  fr: cloneLocalizedSlice(source),
  en: cloneLocalizedSlice(source),
  es: cloneLocalizedSlice(source),
});

const getNormalizedLocalizedContent = (
  source: Partial<QuoteTemplateInput> | QuoteTemplate | null | undefined,
): Record<QuoteLanguage, QuoteTemplateLocalizedContent> => {
  if (source?.localizedContent) {
    return {
      fr: cloneLocalizedSlice(source.localizedContent.fr),
      en: cloneLocalizedSlice(source.localizedContent.en),
      es: cloneLocalizedSlice(source.localizedContent.es),
    };
  }

  if (source) {
    return getLegacyLocalizedContent({
      projectSummary: source.projectSummary || "",
      parts: source.parts || [],
      conditions: source.conditions || [],
      roadmap: source.roadmap || [],
      acceptance: source.acceptance || [],
      principles: source.principles || [],
      addons: source.addons || [],
    });
  }

  return createDefaultQuoteTemplateLocalizedContent("shopify");
};

const normalizeItems = (
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

const normalizeTemplate = (draft: QuoteTemplateInput) => ({
  name: draft.name,
  isDefault: draft.isDefault ?? false,
  platform: draft.platform,
  customPlatformLabel: draft.customPlatformLabel,
  language: draft.language,
  vatRate: draft.vatRate,
  projectSummary: draft.projectSummary,
  discountType: draft.discountType,
  discountValue: draft.discountValue,
  localizedContent: {
    fr: cloneLocalizedSlice(draft.localizedContent?.fr),
    en: cloneLocalizedSlice(draft.localizedContent?.en),
    es: cloneLocalizedSlice(draft.localizedContent?.es),
  },
  parts: (draft.parts || []).map((part) => ({
    id: part.id,
    title: part.title,
    displayStyle: part.displayStyle,
    price: part.price,
    optional: part.optional,
    priceNote: part.priceNote,
    sections: (part.sections || []).map((section) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      items: normalizeItems(section.items).map((item) => ({
        id: item.id,
        text: item.text,
        subItems: item.subItems.map((subItem) => ({
          id: subItem.id,
          text: subItem.text,
        })),
      })),
      price: section.price,
      subSections: (section.subSections || []).map((subSection) => ({
        id: subSection.id,
        title: subSection.title,
        body: subSection.body,
      })),
    })),
  })),
  conditions: draft.conditions.map((condition) => ({
    id: condition.id,
    title: condition.title,
    body: condition.body,
    items: normalizeItems(condition.items).map((item) => ({
      id: item.id,
      text: item.text,
      subItems: item.subItems.map((subItem) => ({
        id: subItem.id,
        text: subItem.text,
      })),
    })),
  })),
  roadmap: draft.roadmap.map((phase) => ({
    id: phase.id,
    title: phase.title,
    body: phase.body,
    items: normalizeItems(phase.items).map((item) => ({
      id: item.id,
      text: item.text,
      subItems: item.subItems.map((subItem) => ({
        id: subItem.id,
        text: subItem.text,
      })),
    })),
  })),
  acceptance: draft.acceptance.map((entry) => ({
    id: entry.id,
    title: entry.title,
    body: entry.body,
    items: normalizeItems(entry.items).map((item) => ({
      id: item.id,
      text: item.text,
      subItems: item.subItems.map((subItem) => ({
        id: subItem.id,
        text: subItem.text,
      })),
    })),
  })),
  principles: draft.principles.map((principle) => ({
    id: principle.id,
    title: principle.title,
    body: principle.body,
    items: normalizeItems(principle.items).map((item) => ({
      id: item.id,
      text: item.text,
      subItems: item.subItems.map((subItem) => ({
        id: subItem.id,
        text: subItem.text,
      })),
    })),
  })),
  addons: draft.addons.map((addon) => ({
    id: addon.id,
    title: addon.title,
    description: addon.description,
    items: normalizeItems(addon.items).map((item) => ({
      id: item.id,
      text: item.text,
      subItems: item.subItems.map((subItem) => ({
        id: subItem.id,
        text: subItem.text,
      })),
    })),
    price: addon.price,
    unitLabel: addon.unitLabel || "",
    enabled: addon.enabled ?? true,
  })),
});

const templateId = computed(() => quoteTemplatesStore.selectedTemplateId);
const currencyLocale = computed(() =>
  form.language === "en" ? "en-GB" : form.language === "es" ? "es-ES" : "fr-FR",
);
const baselineTemplate = computed<QuoteTemplateInput>(() => {
  const current = quoteTemplatesStore.selectedTemplate;
  if (!current) return createTemplateDraft();

  const localizedContent = getNormalizedLocalizedContent(current);
  const activeContent = localizedContent[current.language];

  return {
    name: current.name,
    isDefault: current.isDefault ?? false,
    platform: current.platform,
    customPlatformLabel: current.customPlatformLabel || "",
    language: current.language,
    vatRate: current.vatRate,
    projectSummary: activeContent.projectSummary,
    discountType: current.discountType || "percent",
    discountValue: current.discountValue || 0,
    parts: partsFromContent(activeContent),
    conditions: cloneConditions(activeContent.conditions),
    roadmap: cloneConditions(activeContent.roadmap),
    acceptance: cloneConditions(activeContent.acceptance),
    principles: cloneConditions(activeContent.principles),
    addons: cloneAddons(activeContent.addons),
    localizedContent,
  };
});

/**
 * Retire récursivement les `id` (non sémantiques, régénérés à chaque clonage)
 * pour comparer le contenu réel et éviter les faux « modifications non
 * sauvegardées ».
 */
const stripIds = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stripIds);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => key !== "id")
        .map(([key, val]) => [key, stripIds(val)]),
    );
  }
  return value;
};

const hasUnsavedChanges = computed(
  () =>
    JSON.stringify(stripIds(normalizeTemplate(form))) !==
    JSON.stringify(stripIds(normalizeTemplate(baselineTemplate.value))),
);

const formatTemplateUpdatedAt = (template: QuoteTemplate) => {
  const rawDate = template.updatedAt || template.createdAt;
  if (!rawDate) return "Date inconnue";

  const parsed =
    typeof rawDate === "object" &&
    rawDate !== null &&
    "toDate" in rawDate &&
    typeof rawDate.toDate === "function"
      ? rawDate.toDate()
      : new Date(rawDate as string | Date);

  if (Number.isNaN(parsed.getTime())) return "Date inconnue";

  return new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
};

const hydrateFromTemplate = (template: QuoteTemplate | null) => {
  hydratingTemplate = true;

  if (!template) {
    Object.assign(form, createTemplateDraft());
    hydratingTemplate = false;
    return;
  }

  const localizedContent = getNormalizedLocalizedContent(template);
  const activeContent = localizedContent[template.language];

  Object.assign(form, {
    name: template.name,
    platform: template.platform,
    customPlatformLabel: template.customPlatformLabel || "",
    language: template.language,
    vatRate: template.vatRate,
    projectSummary: activeContent.projectSummary,
    discountType: template.discountType || "percent",
    discountValue: template.discountValue || 0,
    parts: partsFromContent(activeContent),
    conditions: cloneConditions(activeContent.conditions),
    roadmap: cloneConditions(activeContent.roadmap),
    acceptance: cloneConditions(activeContent.acceptance),
    principles: cloneConditions(activeContent.principles),
    addons: cloneAddons(activeContent.addons),
    localizedContent,
  });

  hydratingTemplate = false;
};

const persistActiveLanguageContent = (language: QuoteLanguage) => {
  form.localizedContent = {
    ...form.localizedContent,
    [language]: cloneLocalizedSlice({
      projectSummary: form.projectSummary,
      parts: form.parts,
      conditions: form.conditions,
      roadmap: form.roadmap,
      acceptance: form.acceptance,
      principles: form.principles,
      addons: form.addons,
    }),
  };
};

const hydrateVisibleContentFromLanguage = (language: QuoteLanguage) => {
  const activeContent = cloneLocalizedSlice(form.localizedContent?.[language]);
  syncingLocalizedContent = true;
  form.projectSummary = activeContent.projectSummary;
  form.parts = partsFromContent(activeContent);
  form.conditions = activeContent.conditions;
  form.roadmap = activeContent.roadmap;
  form.acceptance = activeContent.acceptance;
  form.principles = activeContent.principles;
  form.addons = activeContent.addons;
  syncingLocalizedContent = false;
};

const guardUnsaved = (action: () => void) => {
  if (hasUnsavedChanges.value) {
    toast.add({
      severity: "warn",
      summary: "Sauvegarde requise",
      detail: "Enregistre ou annule d’abord les modifications du template.",
      life: 2200,
    });
    return;
  }
  action();
};

watch(
  () => quoteTemplatesStore.selectedTemplate,
  (template) => hydrateFromTemplate(template),
  { immediate: true },
);

watch(
  () => form.platform,
  (platform, oldPlatform) => {
    if (hydratingTemplate) return;
    if (platform === oldPlatform) return;
    if (platform !== "other") form.customPlatformLabel = "";
  },
);

watch(
  () => form.language,
  (language, oldLanguage) => {
    if (hydratingTemplate) return;
    if (language === oldLanguage) return;
    if (oldLanguage) persistActiveLanguageContent(oldLanguage);
    hydrateVisibleContentFromLanguage(language);
  },
);

watch(
  () =>
    [
      form.projectSummary,
      form.parts,
      form.conditions,
      form.roadmap,
      form.acceptance,
      form.principles,
      form.addons,
    ] as const,
  () => {
    if (syncingLocalizedContent || hydratingTemplate) return;
    persistActiveLanguageContent(form.language);
  },
  { deep: true },
);

const updateCondition = (
  id: string,
  field: "title" | "body",
  value: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === id);
  if (condition) (condition[field] as string) = value;
};

const moveCondition = (draggedId: string, targetId: string) => {
  const draggedIndex = form.conditions.findIndex(
    (condition) => condition.id === draggedId,
  );
  const targetIndex = form.conditions.findIndex(
    (condition) => condition.id === targetId,
  );
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...form.conditions];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  form.conditions = next;
};

const updateConditionItem = (
  conditionId: string,
  itemId: string,
  value: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  const item = condition?.items.find((entry) => entry.id === itemId);
  if (item) item.text = value;
};

const removeConditionItem = (conditionId: string, itemId: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  condition.items = condition.items.filter((entry) => entry.id !== itemId);
};

const moveConditionItem = (
  conditionId: string,
  draggedId: string,
  targetId: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  const draggedIndex = condition.items.findIndex(
    (entry) => entry.id === draggedId,
  );
  const targetIndex = condition.items.findIndex(
    (entry) => entry.id === targetId,
  );
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...condition.items];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  condition.items = next;
};

const nestConditionItemUnderItem = (
  conditionId: string,
  draggedId: string,
  targetId: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  const draggedIndex = condition.items.findIndex(
    (entry) => entry.id === draggedId,
  );
  const targetItem = condition.items.find((entry) => entry.id === targetId);
  if (draggedIndex === -1 || !targetItem || draggedId === targetId) return;
  const [dragged] = condition.items.splice(draggedIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: dragged.text },
  ];
};

const addConditionItem = (conditionId: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  condition.items = [
    ...(condition.items || []),
    { id: createEntityId(), text: "", subItems: [] },
  ];
};

const addConditionSubItem = (conditionId: string, itemId: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  const item = condition?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = [
    ...(item.subItems || []),
    { id: createEntityId(), text: "" },
  ];
};

const updateConditionSubItem = (
  conditionId: string,
  itemId: string,
  subItemId: string,
  value: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  const item = condition?.items.find((entry) => entry.id === itemId);
  const subItem = item?.subItems.find((entry) => entry.id === subItemId);
  if (subItem) subItem.text = value;
};

const removeConditionSubItem = (
  conditionId: string,
  itemId: string,
  subItemId: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  const item = condition?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = item.subItems.filter((entry) => entry.id !== subItemId);
};

const moveConditionSubItem = (
  conditionId: string,
  itemId: string,
  draggedId: string,
  targetId: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  const item = condition?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  const draggedIndex = item.subItems.findIndex(
    (entry) => entry.id === draggedId,
  );
  const targetIndex = item.subItems.findIndex((entry) => entry.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...item.subItems];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  item.subItems = next;
};

const moveConditionSubItemToItem = (
  conditionId: string,
  fromItemId: string,
  subItemId: string,
  targetItemId: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  const sourceItem = condition.items.find((entry) => entry.id === fromItemId);
  const targetItem = condition.items.find((entry) => entry.id === targetItemId);
  if (!sourceItem || !targetItem) return;
  const subItemIndex = sourceItem.subItems.findIndex(
    (entry) => entry.id === subItemId,
  );
  if (subItemIndex === -1) return;
  const [subItem] = sourceItem.subItems.splice(subItemIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: subItem.text },
  ];
};

const promoteConditionSubItemToItem = (
  conditionId: string,
  fromItemId: string,
  subItemId: string,
  targetId: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  const sourceIndex = condition.items.findIndex(
    (entry) => entry.id === fromItemId,
  );
  const targetIndex = condition.items.findIndex(
    (entry) => entry.id === targetId,
  );
  if (sourceIndex === -1 || targetIndex === -1) return;
  const item = condition.items[sourceIndex];
  const subItemIndex = item.subItems.findIndex(
    (entry) => entry.id === subItemId,
  );
  if (subItemIndex === -1) return;
  const [subItem] = item.subItems.splice(subItemIndex, 1);
  const promoted: QuoteConditionItem = {
    id: createEntityId(),
    text: subItem.text,
    subItems: [],
  };
  condition.items.splice(targetIndex, 0, promoted);
};

const updateRoadmapPhase = (
  id: string,
  field: "title" | "body",
  value: string,
) => {
  const phase = form.roadmap.find((entry) => entry.id === id);
  if (phase) (phase[field] as string) = value;
};

const moveRoadmapPhase = (draggedId: string, targetId: string) => {
  const draggedIndex = form.roadmap.findIndex(
    (phase) => phase.id === draggedId,
  );
  const targetIndex = form.roadmap.findIndex((phase) => phase.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...form.roadmap];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  form.roadmap = next;
};

const addRoadmapItem = (phaseId: string) => {
  const phase = form.roadmap.find((entry) => entry.id === phaseId);
  if (!phase) return;
  phase.items = [
    ...(phase.items || []),
    { id: createEntityId(), text: "", subItems: [] },
  ];
};

const updateRoadmapItem = (
  conditionId: string,
  itemId: string,
  value: string,
) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  const item = phase?.items.find((entry) => entry.id === itemId);
  if (item) item.text = value;
};

const removeRoadmapItem = (conditionId: string, itemId: string) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  if (!phase) return;
  phase.items = phase.items.filter((entry) => entry.id !== itemId);
};

const moveRoadmapItem = (
  conditionId: string,
  draggedId: string,
  targetId: string,
) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  if (!phase) return;
  const draggedIndex = phase.items.findIndex((entry) => entry.id === draggedId);
  const targetIndex = phase.items.findIndex((entry) => entry.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...phase.items];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  phase.items = next;
};

const nestRoadmapItemUnderItem = (
  conditionId: string,
  draggedId: string,
  targetId: string,
) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  if (!phase) return;
  const draggedIndex = phase.items.findIndex((entry) => entry.id === draggedId);
  const targetItem = phase.items.find((entry) => entry.id === targetId);
  if (draggedIndex === -1 || !targetItem || draggedId === targetId) return;
  const [dragged] = phase.items.splice(draggedIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: dragged.text },
  ];
};

const addRoadmapSubItem = (conditionId: string, itemId: string) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  const item = phase?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = [
    ...(item.subItems || []),
    { id: createEntityId(), text: "" },
  ];
};

const updateRoadmapSubItem = (
  conditionId: string,
  itemId: string,
  subItemId: string,
  value: string,
) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  const item = phase?.items.find((entry) => entry.id === itemId);
  const subItem = item?.subItems.find((entry) => entry.id === subItemId);
  if (subItem) subItem.text = value;
};

const removeRoadmapSubItem = (
  conditionId: string,
  itemId: string,
  subItemId: string,
) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  const item = phase?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = item.subItems.filter((entry) => entry.id !== subItemId);
};

const moveRoadmapSubItem = (
  conditionId: string,
  itemId: string,
  draggedId: string,
  targetId: string,
) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  const item = phase?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  const draggedIndex = item.subItems.findIndex(
    (entry) => entry.id === draggedId,
  );
  const targetIndex = item.subItems.findIndex((entry) => entry.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...item.subItems];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  item.subItems = next;
};

const moveRoadmapSubItemToItem = (
  conditionId: string,
  fromItemId: string,
  subItemId: string,
  targetItemId: string,
) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  if (!phase) return;
  const sourceItem = phase.items.find((entry) => entry.id === fromItemId);
  const targetItem = phase.items.find((entry) => entry.id === targetItemId);
  if (!sourceItem || !targetItem) return;
  const subItemIndex = sourceItem.subItems.findIndex(
    (entry) => entry.id === subItemId,
  );
  if (subItemIndex === -1) return;
  const [subItem] = sourceItem.subItems.splice(subItemIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: subItem.text },
  ];
};

const promoteRoadmapSubItemToItem = (
  conditionId: string,
  fromItemId: string,
  subItemId: string,
  targetId: string,
) => {
  const phase = form.roadmap.find((entry) => entry.id === conditionId);
  if (!phase) return;
  const sourceIndex = phase.items.findIndex((entry) => entry.id === fromItemId);
  const targetIndex = phase.items.findIndex((entry) => entry.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;
  const item = phase.items[sourceIndex];
  const subItemIndex = item.subItems.findIndex(
    (entry) => entry.id === subItemId,
  );
  if (subItemIndex === -1) return;
  const [subItem] = item.subItems.splice(subItemIndex, 1);
  const promoted: QuoteConditionItem = {
    id: createEntityId(),
    text: subItem.text,
    subItems: [],
  };
  phase.items.splice(targetIndex, 0, promoted);
};

const updateAcceptance = (
  id: string,
  field: "title" | "body",
  value: string,
) => {
  const entry = form.acceptance.find((item) => item.id === id);
  if (entry) (entry[field] as string) = value;
};

const moveAcceptance = (draggedId: string, targetId: string) => {
  const draggedIndex = form.acceptance.findIndex(
    (entry) => entry.id === draggedId,
  );
  const targetIndex = form.acceptance.findIndex(
    (entry) => entry.id === targetId,
  );
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...form.acceptance];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  form.acceptance = next;
};

const addAcceptanceItem = (acceptanceId: string) => {
  const entry = form.acceptance.find((item) => item.id === acceptanceId);
  if (!entry) return;
  entry.items = [
    ...(entry.items || []),
    { id: createEntityId(), text: "", subItems: [] },
  ];
};

const updateAcceptanceItem = (
  conditionId: string,
  itemId: string,
  value: string,
) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  const item = entry?.items.find((row) => row.id === itemId);
  if (item) item.text = value;
};

const removeAcceptanceItem = (conditionId: string, itemId: string) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  if (!entry) return;
  entry.items = entry.items.filter((row) => row.id !== itemId);
};

const moveAcceptanceItem = (
  conditionId: string,
  draggedId: string,
  targetId: string,
) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  if (!entry) return;
  const draggedIndex = entry.items.findIndex((row) => row.id === draggedId);
  const targetIndex = entry.items.findIndex((row) => row.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...entry.items];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  entry.items = next;
};

const nestAcceptanceItemUnderItem = (
  conditionId: string,
  draggedId: string,
  targetId: string,
) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  if (!entry) return;
  const draggedIndex = entry.items.findIndex((row) => row.id === draggedId);
  const targetItem = entry.items.find((row) => row.id === targetId);
  if (draggedIndex === -1 || !targetItem || draggedId === targetId) return;
  const [dragged] = entry.items.splice(draggedIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: dragged.text },
  ];
};

const addAcceptanceSubItem = (conditionId: string, itemId: string) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  const item = entry?.items.find((row) => row.id === itemId);
  if (!item) return;
  item.subItems = [
    ...(item.subItems || []),
    { id: createEntityId(), text: "" },
  ];
};

const updateAcceptanceSubItem = (
  conditionId: string,
  itemId: string,
  subItemId: string,
  value: string,
) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  const item = entry?.items.find((row) => row.id === itemId);
  const subItem = item?.subItems.find((row) => row.id === subItemId);
  if (subItem) subItem.text = value;
};

const removeAcceptanceSubItem = (
  conditionId: string,
  itemId: string,
  subItemId: string,
) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  const item = entry?.items.find((row) => row.id === itemId);
  if (!item) return;
  item.subItems = item.subItems.filter((row) => row.id !== subItemId);
};

const moveAcceptanceSubItem = (
  conditionId: string,
  itemId: string,
  draggedId: string,
  targetId: string,
) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  const item = entry?.items.find((row) => row.id === itemId);
  if (!item) return;
  const draggedIndex = item.subItems.findIndex((row) => row.id === draggedId);
  const targetIndex = item.subItems.findIndex((row) => row.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...item.subItems];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  item.subItems = next;
};

const moveAcceptanceSubItemToItem = (
  conditionId: string,
  fromItemId: string,
  subItemId: string,
  targetItemId: string,
) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  if (!entry) return;
  const sourceItem = entry.items.find((row) => row.id === fromItemId);
  const targetItem = entry.items.find((row) => row.id === targetItemId);
  if (!sourceItem || !targetItem) return;
  const subItemIndex = sourceItem.subItems.findIndex(
    (row) => row.id === subItemId,
  );
  if (subItemIndex === -1) return;
  const [subItem] = sourceItem.subItems.splice(subItemIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: subItem.text },
  ];
};

const promoteAcceptanceSubItemToItem = (
  conditionId: string,
  fromItemId: string,
  subItemId: string,
  targetId: string,
) => {
  const entry = form.acceptance.find((item) => item.id === conditionId);
  if (!entry) return;
  const sourceIndex = entry.items.findIndex((row) => row.id === fromItemId);
  const targetIndex = entry.items.findIndex((row) => row.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;
  const item = entry.items[sourceIndex];
  const subItemIndex = item.subItems.findIndex((row) => row.id === subItemId);
  if (subItemIndex === -1) return;
  const [subItem] = item.subItems.splice(subItemIndex, 1);
  const promoted: QuoteConditionItem = {
    id: createEntityId(),
    text: subItem.text,
    subItems: [],
  };
  entry.items.splice(targetIndex, 0, promoted);
};

const updatePrinciple = (
  id: string,
  field: "title" | "body",
  value: string,
) => {
  const principle = form.principles.find((entry) => entry.id === id);
  if (principle) (principle[field] as string) = value;
};

const movePrinciple = (draggedId: string, targetId: string) => {
  const draggedIndex = form.principles.findIndex(
    (principle) => principle.id === draggedId,
  );
  const targetIndex = form.principles.findIndex(
    (principle) => principle.id === targetId,
  );
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...form.principles];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  form.principles = next;
};

const addPrincipleItem = (principleId: string) => {
  const principle = form.principles.find((entry) => entry.id === principleId);
  if (!principle) return;
  principle.items = [
    ...(principle.items || []),
    { id: createEntityId(), text: "", subItems: [] },
  ];
};

const updatePrincipleItem = (
  conditionId: string,
  itemId: string,
  value: string,
) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  const item = principle?.items.find((entry) => entry.id === itemId);
  if (item) item.text = value;
};

const removePrincipleItem = (conditionId: string, itemId: string) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  if (!principle) return;
  principle.items = principle.items.filter((entry) => entry.id !== itemId);
};

const movePrincipleItem = (
  conditionId: string,
  draggedId: string,
  targetId: string,
) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  if (!principle) return;
  const draggedIndex = principle.items.findIndex(
    (entry) => entry.id === draggedId,
  );
  const targetIndex = principle.items.findIndex(
    (entry) => entry.id === targetId,
  );
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...principle.items];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  principle.items = next;
};

const nestPrincipleItemUnderItem = (
  conditionId: string,
  draggedId: string,
  targetId: string,
) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  if (!principle) return;
  const draggedIndex = principle.items.findIndex(
    (entry) => entry.id === draggedId,
  );
  const targetItem = principle.items.find((entry) => entry.id === targetId);
  if (draggedIndex === -1 || !targetItem || draggedId === targetId) return;
  const [dragged] = principle.items.splice(draggedIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: dragged.text },
  ];
};

const addPrincipleSubItem = (conditionId: string, itemId: string) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  const item = principle?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = [
    ...(item.subItems || []),
    { id: createEntityId(), text: "" },
  ];
};

const updatePrincipleSubItem = (
  conditionId: string,
  itemId: string,
  subItemId: string,
  value: string,
) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  const item = principle?.items.find((entry) => entry.id === itemId);
  const subItem = item?.subItems.find((entry) => entry.id === subItemId);
  if (subItem) subItem.text = value;
};

const removePrincipleSubItem = (
  conditionId: string,
  itemId: string,
  subItemId: string,
) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  const item = principle?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = item.subItems.filter((entry) => entry.id !== subItemId);
};

const movePrincipleSubItem = (
  conditionId: string,
  itemId: string,
  draggedId: string,
  targetId: string,
) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  const item = principle?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  const draggedIndex = item.subItems.findIndex(
    (entry) => entry.id === draggedId,
  );
  const targetIndex = item.subItems.findIndex((entry) => entry.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...item.subItems];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  item.subItems = next;
};

const movePrincipleSubItemToItem = (
  conditionId: string,
  fromItemId: string,
  subItemId: string,
  targetItemId: string,
) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  if (!principle) return;
  const sourceItem = principle.items.find((entry) => entry.id === fromItemId);
  const targetItem = principle.items.find((entry) => entry.id === targetItemId);
  if (!sourceItem || !targetItem) return;
  const subItemIndex = sourceItem.subItems.findIndex(
    (entry) => entry.id === subItemId,
  );
  if (subItemIndex === -1) return;
  const [subItem] = sourceItem.subItems.splice(subItemIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: subItem.text },
  ];
};

const promotePrincipleSubItemToItem = (
  conditionId: string,
  fromItemId: string,
  subItemId: string,
  targetId: string,
) => {
  const principle = form.principles.find((entry) => entry.id === conditionId);
  if (!principle) return;
  const sourceIndex = principle.items.findIndex(
    (entry) => entry.id === fromItemId,
  );
  const targetIndex = principle.items.findIndex(
    (entry) => entry.id === targetId,
  );
  if (sourceIndex === -1 || targetIndex === -1) return;
  const item = principle.items[sourceIndex];
  const subItemIndex = item.subItems.findIndex(
    (entry) => entry.id === subItemId,
  );
  if (subItemIndex === -1) return;
  const [subItem] = item.subItems.splice(subItemIndex, 1);
  const promoted: QuoteConditionItem = {
    id: createEntityId(),
    text: subItem.text,
    subItems: [],
  };
  principle.items.splice(targetIndex, 0, promoted);
};

const updateAddon = (
  id: string,
  field: "title" | "description" | "price" | "unitLabel",
  value: string | number,
) => {
  const addon = form.addons.find((entry) => entry.id === id);
  if (addon) (addon[field] as string | number) = value;
};

const addAddonItem = (addonId: string) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  if (!addon) return;
  addon.items = [
    ...(addon.items || []),
    { id: createEntityId(), text: "", subItems: [] },
  ];
};

const updateAddonItem = (addonId: string, itemId: string, value: string) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  const item = addon?.items.find((entry) => entry.id === itemId);
  if (item) item.text = value;
};

const removeAddonItem = (addonId: string, itemId: string) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  if (!addon) return;
  addon.items = addon.items.filter((entry) => entry.id !== itemId);
};

const moveAddonItem = (
  addonId: string,
  draggedId: string,
  targetId: string,
) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  if (!addon) return;
  const draggedIndex = addon.items.findIndex((entry) => entry.id === draggedId);
  const targetIndex = addon.items.findIndex((entry) => entry.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...addon.items];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  addon.items = next;
};

const nestAddonItemUnderItem = (
  addonId: string,
  draggedId: string,
  targetId: string,
) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  if (!addon) return;
  const draggedIndex = addon.items.findIndex((entry) => entry.id === draggedId);
  const targetItem = addon.items.find((entry) => entry.id === targetId);
  if (draggedIndex === -1 || !targetItem || draggedId === targetId) return;
  const [dragged] = addon.items.splice(draggedIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: dragged.text },
  ];
};

const addAddonSubItem = (addonId: string, itemId: string) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  const item = addon?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = [
    ...(item.subItems || []),
    { id: createEntityId(), text: "" },
  ];
};

const updateAddonSubItem = (
  addonId: string,
  itemId: string,
  subItemId: string,
  value: string,
) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  const item = addon?.items.find((entry) => entry.id === itemId);
  const subItem = item?.subItems.find((entry) => entry.id === subItemId);
  if (subItem) subItem.text = value;
};

const removeAddonSubItem = (
  addonId: string,
  itemId: string,
  subItemId: string,
) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  const item = addon?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  item.subItems = item.subItems.filter((entry) => entry.id !== subItemId);
};

const moveAddonSubItem = (
  addonId: string,
  itemId: string,
  draggedId: string,
  targetId: string,
) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  const item = addon?.items.find((entry) => entry.id === itemId);
  if (!item) return;
  const draggedIndex = item.subItems.findIndex(
    (entry) => entry.id === draggedId,
  );
  const targetIndex = item.subItems.findIndex((entry) => entry.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...item.subItems];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  item.subItems = next;
};

const moveAddonSubItemToItem = (
  addonId: string,
  fromItemId: string,
  subItemId: string,
  targetItemId: string,
) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  if (!addon) return;
  const sourceItem = addon.items.find((entry) => entry.id === fromItemId);
  const targetItem = addon.items.find((entry) => entry.id === targetItemId);
  if (!sourceItem || !targetItem) return;
  const subItemIndex = sourceItem.subItems.findIndex(
    (entry) => entry.id === subItemId,
  );
  if (subItemIndex === -1) return;
  const [subItem] = sourceItem.subItems.splice(subItemIndex, 1);
  targetItem.subItems = [
    ...(targetItem.subItems || []),
    { id: createEntityId(), text: subItem.text },
  ];
};

const promoteAddonSubItemToItem = (
  addonId: string,
  fromItemId: string,
  subItemId: string,
  targetId: string,
) => {
  const addon = form.addons.find((entry) => entry.id === addonId);
  if (!addon) return;
  const sourceIndex = addon.items.findIndex((entry) => entry.id === fromItemId);
  const targetIndex = addon.items.findIndex((entry) => entry.id === targetId);
  if (sourceIndex === -1 || targetIndex === -1) return;
  const item = addon.items[sourceIndex];
  const subItemIndex = item.subItems.findIndex(
    (entry) => entry.id === subItemId,
  );
  if (subItemIndex === -1) return;
  const [subItem] = item.subItems.splice(subItemIndex, 1);
  const promoted: QuoteConditionItem = {
    id: createEntityId(),
    text: subItem.text,
    subItems: [],
  };
  addon.items.splice(targetIndex, 0, promoted);
};

const addCondition = () => {
  form.conditions.push({
    id: createEntityId(),
    title: "",
    body: "",
    items: [],
  });
};

const addRoadmapPhase = () => {
  form.roadmap.push({
    id: createEntityId(),
    title: "",
    body: "",
    items: [],
  });
};

const addAcceptance = () => {
  form.acceptance.push({
    id: createEntityId(),
    title: "",
    body: "",
    items: [],
  });
};

const addPrinciple = () => {
  form.principles.push({
    id: createEntityId(),
    title: "",
    body: "",
    items: [],
  });
};

const addAddonPreset = () => {
  form.addons.push(createBlankAddon());
};

const duplicateAddon = (addonId: string) => {
  const source = form.addons.find((entry) => entry.id === addonId);
  if (!source) return;
  const duplicated: QuoteAddon = {
    ...source,
    id: createEntityId(),
    title: source.title?.trim() ? `${source.title} - copy` : "Add-on - copy",
    unitLabel: source.unitLabel || "",
    items: normalizeItems(source.items).map((item) => ({
      id: createEntityId(),
      text: item.text || "",
      subItems: (item.subItems || []).map((subItem) => ({
        id: createEntityId(),
        text: subItem.text || "",
      })),
    })),
  };
  const sourceIndex = form.addons.findIndex((entry) => entry.id === addonId);
  form.addons.splice(sourceIndex + 1, 0, duplicated);
};

const moveAddon = (draggedId: string, targetId: string) => {
  const draggedIndex = form.addons.findIndex((addon) => addon.id === draggedId);
  const targetIndex = form.addons.findIndex((addon) => addon.id === targetId);
  if (draggedIndex === -1 || targetIndex === -1 || draggedIndex === targetIndex)
    return;
  const next = [...form.addons];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  form.addons = next;
};

const createTemplate = () => {
  guardUnsaved(() => {
    quoteTemplatesStore.selectTemplate(null);
    hydrateFromTemplate(null);
  });
};

const selectTemplate = (id: string) => {
  guardUnsaved(() => {
    quoteTemplatesStore.selectTemplate(id);
  });
};

const setDefaultTemplate = async (id: string) => {
  const target = quoteTemplatesStore.templates.find((entry) => entry.id === id);
  if (target?.isDefault) return;
  try {
    await quoteTemplatesStore.setDefaultTemplate(id);
    toast.add({
      severity: "success",
      summary: "Template par défaut",
      detail:
        "Les nouveaux devis reprendront le contenu standard de ce template.",
      life: 2500,
    });
  } catch {
    toast.add({
      severity: "error",
      summary: "Erreur",
      detail: "Impossible de définir ce template par défaut.",
      life: 3000,
    });
  }
};

const saveTemplate = async () => {
  persistActiveLanguageContent(form.language);
  const payload = normalizeTemplate(form);
  const template = await quoteTemplatesStore.saveTemplate(
    templateId.value,
    payload,
  );
  hydrateFromTemplate(template);
  toast.add({
    severity: "success",
    summary: "Template sauvegardé",
    detail: "Le template de devis a été enregistré.",
    life: 2200,
  });
};

const deleteTemplate = async () => {
  if (!templateId.value) {
    hydrateFromTemplate(null);
    return;
  }

  const current = quoteTemplatesStore.selectedTemplate;
  const templateName = current?.name?.trim() || "ce template";
  confirm.require({
    message: `Supprimer définitivement ${templateName} ?`,
    header: "Supprimer le template ?",
    icon: "warning",
    rejectProps: {
      label: "Annuler",
      severity: "secondary",
      outlined: true,
    },
    acceptProps: {
      label: "Supprimer",
      severity: "danger",
    },
    accept: async () => {
      await quoteTemplatesStore.deleteTemplate(templateId.value as string);
      toast.add({
        severity: "secondary",
        summary: "Template supprimé",
        detail: "Le template a été retiré.",
        life: 2200,
      });
      hydrateFromTemplate(quoteTemplatesStore.selectedTemplate);
    },
  });
};

const duplicateTemplate = async () => {
  const source = quoteTemplatesStore.selectedTemplate;
  if (!source) return;

  persistActiveLanguageContent(form.language);

  const duplicatedName = form.name?.trim()
    ? `${form.name} - copy`
    : "Template - copy";
  const sourceClone = JSON.parse(JSON.stringify(source)) as Record<
    string,
    unknown
  > & QuoteTemplateInput;

  delete sourceClone.id;
  delete sourceClone.userId;
  delete sourceClone.createdAt;
  delete sourceClone.updatedAt;

  const localizedContent = {
    ...(sourceClone.localizedContent || {}),
    [form.language]: cloneLocalizedSlice({
      projectSummary: form.projectSummary,
      parts: form.parts,
      conditions: form.conditions,
      roadmap: form.roadmap,
      acceptance: form.acceptance,
      principles: form.principles,
      addons: form.addons,
    }),
  } as QuoteTemplateInput["localizedContent"];

  const payload: QuoteTemplateInput = {
    ...(sourceClone as QuoteTemplateInput),
    name: duplicatedName,
    isDefault: false,
    platform: form.platform,
    customPlatformLabel: form.customPlatformLabel || "",
    language: form.language,
    vatRate: form.vatRate,
    projectSummary: form.projectSummary,
    discountType: form.discountType || "percent",
    discountValue: form.discountValue || 0,
    parts: cloneQuoteParts(form.parts),
    conditions: cloneConditions(form.conditions),
    roadmap: cloneConditions(form.roadmap),
    acceptance: cloneConditions(form.acceptance),
    principles: cloneConditions(form.principles),
    addons: cloneAddons(form.addons),
    localizedContent,
  };

  const template = await quoteTemplatesStore.saveTemplate(null, payload);
  hydrateFromTemplate(template);
  toast.add({
    severity: "success",
    summary: "Template dupliqué",
    detail: "Une copie du template a été créée.",
    life: 2200,
  });
};

const discardChanges = () => {
  hydrateFromTemplate(quoteTemplatesStore.selectedTemplate);
};

onMounted(async () => {
  await quoteTemplatesStore.fetchTemplates();
  hydrateFromTemplate(quoteTemplatesStore.selectedTemplate);
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <ConfirmDialog />

    <div
      class="sticky top-0 z-20 bg-surface-light/95 py-1 backdrop-blur supports-[backdrop-filter]:bg-surface-light/80"
    >
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h1 class="text-3xl font-heading font-bold text-surface-dark">
          Templates de devis
        </h1>
        <div class="flex items-center gap-2">
          <Button
            v-if="templateId"
            severity="secondary"
            @click="duplicateTemplate"
          >
            <template #icon
              ><span class="material-symbols-outlined text-lg"
                >content_copy</span
              ></template
            >
            Dupliquer
          </Button>
          <Button severity="secondary" @click="discardChanges">Annuler</Button>
          <Button @click="saveTemplate">Sauvegarder</Button>
        </div>
      </div>
    </div>

    <div
      class="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)] items-start"
    >
      <section
        class="rounded-3xl border border-surface-dark/5 bg-surface-card p-5 xl:sticky xl:top-6"
      >
        <div class="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 class="font-heading font-bold text-surface-dark">
              Bibliothèque
            </h2>
          </div>
          <Button severity="secondary" @click="createTemplate">
            <template #icon
              ><span class="material-symbols-outlined text-lg"
                >add</span
              ></template
            >
            Nouveau
          </Button>
        </div>

        <div class="flex flex-col gap-3">
          <div
            v-for="template in quoteTemplatesStore.templates"
            :key="template.id"
            class="w-full cursor-pointer rounded-2xl border p-4 text-left transition-all"
            :class="
              templateId === template.id
                ? 'border-primary/20 bg-primary/10'
                : 'border-surface-dark/8 bg-white hover:border-primary/15'
            "
            @click="selectTemplate(template.id)"
          >
            <div class="flex items-start justify-between gap-2">
              <p class="font-heading font-bold text-surface-dark">
                {{ template.name }}
              </p>
              <button
                type="button"
                class="shrink-0 rounded-lg p-1 transition-colors"
                :class="
                  template.isDefault
                    ? 'text-amber-500'
                    : 'text-surface-dark/25 hover:text-amber-500'
                "
                :title="
                  template.isDefault
                    ? 'Template par défaut'
                    : 'Définir comme template par défaut'
                "
                @click.stop="setDefaultTemplate(template.id)"
              >
                <span class="material-symbols-outlined text-lg">{{
                  template.isDefault ? "star" : "star_border"
                }}</span>
              </button>
            </div>
            <div class="mt-1 flex items-center gap-2">
              <span class="text-sm text-surface-dark/60">
                {{ template.platform || "other" }}
              </span>
              <span
                v-if="template.isDefault"
                class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700"
                >Par défaut</span
              >
            </div>
            <p class="mt-2 text-xs text-surface-dark/45">
              Dernière modification :
              {{ formatTemplateUpdatedAt(template) }}
            </p>
          </div>

          <div
            v-if="quoteTemplatesStore.templates.length === 0"
            class="rounded-2xl border border-dashed border-surface-dark/10 p-5 text-sm text-surface-dark/55"
          >
            Aucun template pour l’instant.
          </div>
        </div>
      </section>

      <div class="flex flex-col gap-6">
        <section class="rounded-3xl border border-surface-dark/5 bg-white p-5">
          <div
            class="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_180px_auto] items-end"
          >
            <label class="flex flex-col gap-2">
              <span class="text-sm font-semibold text-surface-dark"
                >Nom du template</span
              >
              <InputText
                v-model="form.name"
                placeholder="Ex: Shopify premium"
              />
            </label>
            <div
              class="rounded-2xl border border-surface-dark/6 bg-surface-light px-4 py-3 text-sm text-surface-dark/65"
            >
              {{
                hasUnsavedChanges
                  ? "Modifications non enregistrées"
                  : "Template synchronisé"
              }}
            </div>
            <Button
              v-if="templateId"
              text
              severity="danger"
              class="justify-self-start lg:justify-self-center"
              @click="deleteTemplate"
            >
              <template #icon
                ><span class="material-symbols-outlined text-lg"
                  >delete</span
                ></template
              >
            </Button>
          </div>
        </section>

        <QuoteBuilderForm
          mode="template"
          quote-ref=""
          :title="form.name"
          :quote-date="null"
          valid-until=""
          client-id=""
          client-name=""
          client-address=""
          client-website=""
          client-country=""
          client-vat-label=""
          :platform="form.platform"
          :custom-platform-label="form.customPlatformLabel"
          :language="form.language"
          :vat-rate="form.vatRate"
          :discount-type="form.discountType"
          :discount-value="form.discountValue"
          :project-summary="form.projectSummary"
          :parts="form.parts"
          :currency-locale="currencyLocale"
          :conditions="form.conditions"
          :roadmap="form.roadmap"
          :acceptance="form.acceptance"
          :principles="form.principles"
          :addons="form.addons"
          :clients="[]"
          :addons-total="0"
          :discount-amount="0"
          :subtotal="0"
          :vat-amount="0"
          :total-with-vat="0"
          vat-explanation=""
          @update:title="form.name = $event"
          @update:quote-date="() => undefined"
          @update:client-id="() => undefined"
          @update:platform="form.platform = $event"
          @update:custom-platform-label="form.customPlatformLabel = $event"
          @update:language="form.language = $event"
          @update:vat-rate="form.vatRate = $event"
          @update:discount-type="form.discountType = $event as QuoteDiscountType"
          @update:discount-value="form.discountValue = $event"
          @update:project-summary="form.projectSummary = $event"
          @update:parts="form.parts = $event"
          @add-condition="addCondition"
          @move-condition="moveCondition($event.draggedId, $event.targetId)"
          @update-condition="
            updateCondition($event.id, $event.field, $event.value)
          "
          @remove-condition="
            form.conditions = form.conditions.filter(
              (condition) => condition.id !== $event,
            )
          "
          @add-condition-item="addConditionItem"
          @update-condition-item="
            updateConditionItem($event.conditionId, $event.itemId, $event.value)
          "
          @remove-condition-item="
            removeConditionItem($event.conditionId, $event.itemId)
          "
          @move-condition-item="
            moveConditionItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @nest-condition-item-under-item="
            nestConditionItemUnderItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @add-condition-sub-item="
            addConditionSubItem($event.conditionId, $event.itemId)
          "
          @update-condition-sub-item="
            updateConditionSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
              $event.value,
            )
          "
          @remove-condition-sub-item="
            removeConditionSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
            )
          "
          @move-condition-sub-item="
            moveConditionSubItem(
              $event.conditionId,
              $event.itemId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @move-condition-sub-item-to-item="
            moveConditionSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetItemId,
            )
          "
          @promote-condition-sub-item-to-item="
            promoteConditionSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetId,
            )
          "
          @add-roadmap-phase="addRoadmapPhase"
          @move-roadmap-phase="
            moveRoadmapPhase($event.draggedId, $event.targetId)
          "
          @update-roadmap-phase="
            updateRoadmapPhase($event.id, $event.field, $event.value)
          "
          @remove-roadmap-phase="
            form.roadmap = form.roadmap.filter((phase) => phase.id !== $event)
          "
          @add-roadmap-item="addRoadmapItem"
          @update-roadmap-item="
            updateRoadmapItem($event.conditionId, $event.itemId, $event.value)
          "
          @remove-roadmap-item="
            removeRoadmapItem($event.conditionId, $event.itemId)
          "
          @move-roadmap-item="
            moveRoadmapItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @nest-roadmap-item-under-item="
            nestRoadmapItemUnderItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @add-roadmap-sub-item="
            addRoadmapSubItem($event.conditionId, $event.itemId)
          "
          @update-roadmap-sub-item="
            updateRoadmapSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
              $event.value,
            )
          "
          @remove-roadmap-sub-item="
            removeRoadmapSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
            )
          "
          @move-roadmap-sub-item="
            moveRoadmapSubItem(
              $event.conditionId,
              $event.itemId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @move-roadmap-sub-item-to-item="
            moveRoadmapSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetItemId,
            )
          "
          @promote-roadmap-sub-item-to-item="
            promoteRoadmapSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetId,
            )
          "
          @add-acceptance="addAcceptance"
          @move-acceptance="moveAcceptance($event.draggedId, $event.targetId)"
          @update-acceptance="
            updateAcceptance($event.id, $event.field, $event.value)
          "
          @remove-acceptance="
            form.acceptance = form.acceptance.filter(
              (entry) => entry.id !== $event,
            )
          "
          @add-acceptance-item="addAcceptanceItem"
          @update-acceptance-item="
            updateAcceptanceItem(
              $event.conditionId,
              $event.itemId,
              $event.value,
            )
          "
          @remove-acceptance-item="
            removeAcceptanceItem($event.conditionId, $event.itemId)
          "
          @move-acceptance-item="
            moveAcceptanceItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @nest-acceptance-item-under-item="
            nestAcceptanceItemUnderItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @add-acceptance-sub-item="
            addAcceptanceSubItem($event.conditionId, $event.itemId)
          "
          @update-acceptance-sub-item="
            updateAcceptanceSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
              $event.value,
            )
          "
          @remove-acceptance-sub-item="
            removeAcceptanceSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
            )
          "
          @move-acceptance-sub-item="
            moveAcceptanceSubItem(
              $event.conditionId,
              $event.itemId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @move-acceptance-sub-item-to-item="
            moveAcceptanceSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetItemId,
            )
          "
          @promote-acceptance-sub-item-to-item="
            promoteAcceptanceSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetId,
            )
          "
          @add-principle="addPrinciple"
          @move-principle="movePrinciple($event.draggedId, $event.targetId)"
          @update-principle="
            updatePrinciple($event.id, $event.field, $event.value)
          "
          @remove-principle="
            form.principles = form.principles.filter(
              (principle) => principle.id !== $event,
            )
          "
          @add-principle-item="addPrincipleItem"
          @update-principle-item="
            updatePrincipleItem($event.conditionId, $event.itemId, $event.value)
          "
          @remove-principle-item="
            removePrincipleItem($event.conditionId, $event.itemId)
          "
          @move-principle-item="
            movePrincipleItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @nest-principle-item-under-item="
            nestPrincipleItemUnderItem(
              $event.conditionId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @add-principle-sub-item="
            addPrincipleSubItem($event.conditionId, $event.itemId)
          "
          @update-principle-sub-item="
            updatePrincipleSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
              $event.value,
            )
          "
          @remove-principle-sub-item="
            removePrincipleSubItem(
              $event.conditionId,
              $event.itemId,
              $event.subItemId,
            )
          "
          @move-principle-sub-item="
            movePrincipleSubItem(
              $event.conditionId,
              $event.itemId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @move-principle-sub-item-to-item="
            movePrincipleSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetItemId,
            )
          "
          @promote-principle-sub-item-to-item="
            promotePrincipleSubItemToItem(
              $event.conditionId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetId,
            )
          "
          @add-addon-preset="addAddonPreset"
          @duplicate-addon="duplicateAddon"
          @update-addon="updateAddon($event.id, $event.field, $event.value)"
          @remove-addon="
            form.addons = form.addons.filter((addon) => addon.id !== $event)
          "
          @move-addon="moveAddon($event.draggedId, $event.targetId)"
          @add-addon-item="addAddonItem"
          @update-addon-item="
            updateAddonItem($event.addonId, $event.itemId, $event.value)
          "
          @remove-addon-item="removeAddonItem($event.addonId, $event.itemId)"
          @move-addon-item="
            moveAddonItem($event.addonId, $event.draggedId, $event.targetId)
          "
          @nest-addon-item-under-item="
            nestAddonItemUnderItem(
              $event.addonId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @add-addon-sub-item="addAddonSubItem($event.addonId, $event.itemId)"
          @update-addon-sub-item="
            updateAddonSubItem(
              $event.addonId,
              $event.itemId,
              $event.subItemId,
              $event.value,
            )
          "
          @remove-addon-sub-item="
            removeAddonSubItem($event.addonId, $event.itemId, $event.subItemId)
          "
          @move-addon-sub-item="
            moveAddonSubItem(
              $event.addonId,
              $event.itemId,
              $event.draggedId,
              $event.targetId,
            )
          "
          @move-addon-sub-item-to-item="
            moveAddonSubItemToItem(
              $event.addonId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetItemId,
            )
          "
          @promote-addon-sub-item-to-item="
            promoteAddonSubItemToItem(
              $event.addonId,
              $event.fromItemId,
              $event.subItemId,
              $event.targetId,
            )
          "
        />
      </div>
    </div>
  </div>
</template>
