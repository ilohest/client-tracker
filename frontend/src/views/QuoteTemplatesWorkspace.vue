<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import type {
  QuoteAddon,
  QuoteCondition,
  QuoteConditionItem,
  QuoteDiscountType,
  QuoteLanguage,
  QuotePaymentScheduleStep,
  QuoteSection,
  QuoteTemplate,
  QuoteTemplateInput,
  QuoteTemplateLocalizedContent,
} from "@client-tracker/contracts";
import Button from "primevue/button";
import ConfirmDialog from "primevue/confirmdialog";
import Select from "primevue/select";
import { useConfirm } from "primevue/useconfirm";
import QuoteActionBar from "@/components/quotes/QuoteActionBar.vue";
import QuoteBuilderForm from "@/components/quotes/QuoteBuilderForm.vue";
import QuoteOutputPanel from "@/components/quotes/QuoteOutputPanel.vue";
import {
  createBlankAddon,
  createDefaultQuoteTemplate,
  createDefaultQuoteTemplateLocalizedContent,
  getEstimatedTimelineTitle,
  languageOptions,
} from "@/lib/clientPresets";
import { useQuoteTemplatesStore } from "@/stores/quoteTemplatesStore";
import { formatDateTime } from "@/utils/date";
import { cloneQuoteParts, createEntityId } from "@/utils/quote";
import { cloneBlocks, serializeBlocks } from "@/utils/quoteBlocks";
import {
  comparableQuoteTemplate,
  resolveCommonConditionReferences,
} from "@/utils/quoteTemplateDraft";
import { useToast } from "primevue/usetoast";

const quoteTemplatesStore = useQuoteTemplatesStore();
const toast = useToast();
const confirm = useConfirm();

const createTemplateDraft = (): QuoteTemplateInput =>
  createDefaultQuoteTemplate("Template de devis", "shopify", "fr");

const form = reactive<QuoteTemplateInput>(createTemplateDraft());
const selectedLibraryItem = ref<"base" | "mail" | "template">("base");
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
    blocks: cloneBlocks(section.blocks || []),
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
    commonConditionId: condition.commonConditionId || "",
    items: cloneItems(condition.items),
  }));

const cloneAddons = (addons: QuoteTemplateLocalizedContent["addons"] = []) =>
  addons.map((addon) => ({
    ...addon,
    id: addon.id || createEntityId(),
    unitLabel: addon.unitLabel || "",
    items: cloneItems(addon.items),
  }));

const clonePaymentSchedule = (
  steps: QuotePaymentScheduleStep[] = [],
): QuotePaymentScheduleStep[] =>
  steps.map((step) => ({
    id: step.id || createEntityId(),
    label: step.label || "",
    mode: step.mode || "percent",
    value: Number(step.value || 0),
  }));

const cloneLocalizedSlice = (
  slice?: Partial<QuoteTemplateLocalizedContent> | null,
): QuoteTemplateLocalizedContent => ({
  projectSummary: slice?.projectSummary || "",
  emailSubject: slice?.emailSubject || "",
  emailBody: slice?.emailBody || "",
  parts: cloneParts(slice?.parts || []),
  conditions: cloneConditions(slice?.conditions || []),
  roadmap: cloneConditions(slice?.roadmap || []),
  acceptance: cloneConditions(slice?.acceptance || []),
  principles: cloneConditions(slice?.principles || []),
  addons: cloneAddons(slice?.addons || []),
  paymentSchedule: clonePaymentSchedule(slice?.paymentSchedule || []),
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
    | "paymentSchedule"
    | "emailSubject"
    | "emailBody"
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
      paymentSchedule: source.paymentSchedule || [],
      emailSubject: source.emailSubject || "",
      emailBody: source.emailBody || "",
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
  kind: draft.kind || "custom",
  platform: draft.platform,
  customPlatformLabel: draft.customPlatformLabel,
  language: draft.language,
  vatRate: draft.vatRate,
  projectSummary: draft.projectSummary,
  emailSubject: draft.emailSubject || "",
  emailBody: draft.emailBody || "",
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
    includeInInvestment: part.includeInInvestment !== false,
    priceNote: part.priceNote,
    sections: (part.sections || []).map((section) => ({
      id: section.id,
      title: section.title,
      blocks: serializeBlocks(section.blocks || [], { withIds: true }),
    })),
  })),
  conditions: draft.conditions.map((condition) => ({
    id: condition.id,
    commonConditionId: condition.commonConditionId || "",
    title: condition.title,
    tag: condition.tag || "",
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
    tag: phase.tag || "",
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
    tag: entry.tag || "",
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
    tag: principle.tag || "",
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
  paymentSchedule: clonePaymentSchedule(draft.paymentSchedule || []),
});

const templateId = computed(() => quoteTemplatesStore.selectedTemplateId);
const baseTemplate = computed(() => quoteTemplatesStore.baseTemplate);
const customTemplates = computed(() =>
  quoteTemplatesStore.templates.filter((template) => template.kind !== "base"),
);
const currencyLocale = computed(() =>
  form.language === "en" ? "en-GB" : form.language === "es" ? "es-ES" : "fr-FR",
);

const getBaseConditionsForLanguage = (language: QuoteLanguage): QuoteCondition[] => {
  const base = quoteTemplatesStore.baseTemplate;
  if (!base) return [];
  const localizedContent = getNormalizedLocalizedContent(base);
  return localizedContent[language]?.conditions || [];
};

const resolveTemplateConditionReferencesForEditor = (
  conditions: QuoteCondition[] = [],
  language: QuoteLanguage,
  enabled = true,
): QuoteCondition[] => {
  if (!enabled) return cloneConditions(conditions);
  return resolveCommonConditionReferences(
    conditions,
    getBaseConditionsForLanguage(language),
    { keepReference: true },
  );
};

const baselineTemplate = computed<QuoteTemplateInput>(() => {
  const current = quoteTemplatesStore.selectedTemplate;
  if (!current) return createTemplateDraft();

  const localizedContent = getNormalizedLocalizedContent(current);
  const activeContent = localizedContent[current.language];
  const shouldResolveCommonConditions = (current.kind || "custom") !== "base";

  return {
    name: current.name,
    kind: current.kind || "custom",
    platform: current.platform,
    customPlatformLabel: current.customPlatformLabel || "",
    language: current.language,
    vatRate: current.vatRate,
    projectSummary: activeContent.projectSummary,
    emailSubject: activeContent.emailSubject,
    emailBody: activeContent.emailBody,
    discountType: current.discountType || "percent",
    discountValue: current.discountValue || 0,
    parts: partsFromContent(activeContent),
    conditions: resolveTemplateConditionReferencesForEditor(
      activeContent.conditions,
      current.language,
      shouldResolveCommonConditions,
    ),
    roadmap: cloneConditions(activeContent.roadmap),
    acceptance: cloneConditions(activeContent.acceptance),
    principles: cloneConditions(activeContent.principles),
    addons: cloneAddons(activeContent.addons),
    paymentSchedule: clonePaymentSchedule(activeContent.paymentSchedule),
    localizedContent,
  };
});

const withVisibleLanguageContent = (
  draft: QuoteTemplateInput,
): QuoteTemplateInput => ({
  ...draft,
  localizedContent: {
    ...draft.localizedContent,
    [draft.language]: cloneLocalizedSlice({
      projectSummary: draft.projectSummary,
      emailSubject: draft.emailSubject,
      emailBody: draft.emailBody,
      parts: draft.parts,
      conditions: draft.conditions,
      roadmap: draft.roadmap,
      acceptance: draft.acceptance,
      principles: draft.principles,
      addons: draft.addons,
      paymentSchedule: draft.paymentSchedule,
    }),
  },
});

const hasUnsavedChanges = computed(
  () =>
    JSON.stringify(comparableQuoteTemplate(withVisibleLanguageContent(form))) !==
    JSON.stringify(
      comparableQuoteTemplate(withVisibleLanguageContent(baselineTemplate.value)),
    ),
);

const formatTemplateCreatedAt = (template: QuoteTemplate) =>
  formatDateTime(template.createdAt);

const formatTemplateUpdatedAt = (template: QuoteTemplate) =>
  formatDateTime(template.updatedAt || template.createdAt);

const selectedTemplateMetadata = computed(() => {
  const template = quoteTemplatesStore.selectedTemplate;
  if (!templateId.value || !template) return null;
  return {
    createdAt: formatTemplateCreatedAt(template),
    updatedAt: formatTemplateUpdatedAt(template),
  };
});

const hydrateFromTemplate = (template: QuoteTemplate | null) => {
  hydratingTemplate = true;

  if (!template) {
    Object.assign(form, createTemplateDraft());
    void Promise.resolve().then(() => {
      hydratingTemplate = false;
    });
    return;
  }

  const localizedContent = getNormalizedLocalizedContent(template);
  const activeContent = localizedContent[template.language];
  const shouldResolveCommonConditions = (template.kind || "custom") !== "base";

  Object.assign(form, {
    name: template.name,
    kind: template.kind || "custom",
    platform: template.platform,
    customPlatformLabel: template.customPlatformLabel || "",
    language: template.language,
    vatRate: template.vatRate,
    projectSummary: activeContent.projectSummary,
    emailSubject: activeContent.emailSubject,
    emailBody: activeContent.emailBody,
    discountType: template.discountType || "percent",
    discountValue: template.discountValue || 0,
    parts: partsFromContent(activeContent),
    conditions: resolveTemplateConditionReferencesForEditor(
      activeContent.conditions,
      template.language,
      shouldResolveCommonConditions,
    ),
    roadmap: cloneConditions(activeContent.roadmap),
    acceptance: cloneConditions(activeContent.acceptance),
    principles: cloneConditions(activeContent.principles),
    addons: cloneAddons(activeContent.addons),
    paymentSchedule: clonePaymentSchedule(activeContent.paymentSchedule),
    localizedContent,
  });

  void Promise.resolve().then(() => {
    hydratingTemplate = false;
  });
};

const persistActiveLanguageContent = (language: QuoteLanguage) => {
  form.localizedContent = {
    ...form.localizedContent,
    [language]: cloneLocalizedSlice({
      projectSummary: form.projectSummary,
      emailSubject: form.emailSubject,
      emailBody: form.emailBody,
      parts: form.parts,
      conditions: form.conditions,
      roadmap: form.roadmap,
      acceptance: form.acceptance,
      principles: form.principles,
      addons: form.addons,
      paymentSchedule: form.paymentSchedule,
    }),
  };
};

const hydrateVisibleContentFromLanguage = (language: QuoteLanguage) => {
  const activeContent = cloneLocalizedSlice(form.localizedContent?.[language]);
  syncingLocalizedContent = true;
  form.projectSummary = activeContent.projectSummary;
  form.emailSubject = activeContent.emailSubject;
  form.emailBody = activeContent.emailBody;
  form.parts = partsFromContent(activeContent);
  form.conditions = resolveTemplateConditionReferencesForEditor(
    activeContent.conditions,
    language,
    (form.kind || "custom") !== "base",
  );
  form.roadmap = activeContent.roadmap;
  form.acceptance = activeContent.acceptance;
  form.principles = activeContent.principles;
  form.addons = activeContent.addons;
  form.paymentSchedule = clonePaymentSchedule(activeContent.paymentSchedule);
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
    if (platform !== "other" && platform !== "custom") form.customPlatformLabel = "";
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
      form.paymentSchedule,
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
  if (condition?.commonConditionId) return;
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
  if (condition?.commonConditionId) return;
  const item = condition?.items.find((entry) => entry.id === itemId);
  if (item) item.text = value;
};

const removeConditionItem = (conditionId: string, itemId: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  if (condition.commonConditionId) return;
  condition.items = condition.items.filter((entry) => entry.id !== itemId);
};

const moveConditionItem = (
  conditionId: string,
  draggedId: string,
  targetId: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (!condition) return;
  if (condition.commonConditionId) return;
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
  if (condition.commonConditionId) return;
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
  if (condition.commonConditionId) return;
  condition.items = [
    ...(condition.items || []),
    { id: createEntityId(), text: "", subItems: [] },
  ];
};

const addConditionSubItem = (conditionId: string, itemId: string) => {
  const condition = form.conditions.find((entry) => entry.id === conditionId);
  if (condition?.commonConditionId) return;
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
  if (condition?.commonConditionId) return;
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
  if (condition?.commonConditionId) return;
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
  if (condition?.commonConditionId) return;
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
  if (condition.commonConditionId) return;
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
  if (condition.commonConditionId) return;
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
  const estimatedIndex = form.roadmap.length - 1;
  if (field === "title" && form.roadmap[estimatedIndex]?.id === id) return;
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
  const lockedIndex = form.roadmap.length - 1;
  if (draggedIndex === lockedIndex || targetIndex === lockedIndex) return;
  const next = [...form.roadmap];
  const [dragged] = next.splice(draggedIndex, 1);
  next.splice(targetIndex, 0, dragged);
  form.roadmap = next;
};

const normalizeEstimatedTimelineTitle = () => {
  const estimatedPhase = form.roadmap[form.roadmap.length - 1];
  if (estimatedPhase) estimatedPhase.title = getEstimatedTimelineTitle(form.language);
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
  field: "title" | "body" | "tag",
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
    commonConditionId: "",
    title: "",
    body: "",
    items: [],
  });
};

const addRoadmapPhase = () => {
  const phase = {
    id: createEntityId(),
    title: "",
    body: "",
    items: [],
  };
  const insertIndex = Math.max(form.roadmap.length - 1, 0);
  form.roadmap.splice(insertIndex, 0, phase);
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
    tag: "",
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
    selectedLibraryItem.value = "template";
    quoteTemplatesStore.selectTemplate(null);
    hydrateFromTemplate(null);
  });
};

const selectTemplate = (id: string) => {
  guardUnsaved(() => {
    const target = quoteTemplatesStore.templates.find((template) => template.id === id);
    selectedLibraryItem.value = target?.kind === "base" ? "base" : "template";
    quoteTemplatesStore.selectTemplate(id);
  });
};

const selectMailTemplate = () => {
  const baseTemplate = quoteTemplatesStore.baseTemplate;
  if (!baseTemplate) return;

  guardUnsaved(() => {
    selectedLibraryItem.value = "mail";
    quoteTemplatesStore.selectTemplate(baseTemplate.id);
  });
};

const isBaseSelected = computed(
  () =>
    selectedLibraryItem.value === "base" &&
    quoteTemplatesStore.selectedTemplate?.kind === "base",
);

const isMailSelected = computed(
  () =>
    selectedLibraryItem.value === "mail" &&
    quoteTemplatesStore.selectedTemplate?.kind === "base",
);

const commonConditionOptions = computed<QuoteCondition[]>(() => {
  if (isBaseSelected.value || isMailSelected.value) return [];
  const base = quoteTemplatesStore.baseTemplate;
  if (!base) return [];
  const localizedContent = getNormalizedLocalizedContent(base);
  const activeConditions = localizedContent[form.language]?.conditions || [];
  const usedCommonIds = new Set(
    form.conditions
      .map((condition) => condition.commonConditionId)
      .filter(Boolean),
  );
  return activeConditions.filter(
    (condition) =>
      condition.id &&
      !usedCommonIds.has(condition.id) &&
      ((condition.title || "").trim() || condition.items.length),
  );
});

const cloneCommonConditionReference = (condition: QuoteCondition): QuoteCondition => ({
  ...condition,
  id: createEntityId(),
  commonConditionId: condition.id,
  tag: condition.tag || "",
  body: condition.body || "",
  items: cloneItems(condition.items || []),
});

const addCommonCondition = (conditionId: string) => {
  const source = commonConditionOptions.value.find(
    (condition) => condition.id === conditionId,
  );
  if (!source) return;
  form.conditions.push(cloneCommonConditionReference(source));
};

const saveTemplate = async () => {
  normalizeEstimatedTimelineTitle();
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
  if (current?.kind === "base") {
    toast.add({
      severity: "warn",
      summary: "Suppression impossible",
      detail:
        "La base commune préremplit les nouveaux devis et ne peut pas être supprimée.",
      life: 3000,
    });
    return;
  }

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
      emailSubject: form.emailSubject,
      emailBody: form.emailBody,
      parts: form.parts,
      conditions: form.conditions,
      roadmap: form.roadmap,
      acceptance: form.acceptance,
      principles: form.principles,
      addons: form.addons,
      paymentSchedule: form.paymentSchedule,
    }),
  } as QuoteTemplateInput["localizedContent"];

  const payload: QuoteTemplateInput = {
    ...(sourceClone as QuoteTemplateInput),
    name: duplicatedName,
    kind: "custom",
    platform: form.platform,
    customPlatformLabel: form.customPlatformLabel || "",
    language: form.language,
    vatRate: form.vatRate,
    projectSummary: form.projectSummary,
    emailSubject: form.emailSubject,
    emailBody: form.emailBody,
    discountType: form.discountType || "percent",
    discountValue: form.discountValue || 0,
    parts: cloneQuoteParts(form.parts),
    conditions: cloneConditions(form.conditions),
    roadmap: cloneConditions(form.roadmap),
    acceptance: cloneConditions(form.acceptance),
    principles: cloneConditions(form.principles),
    addons: cloneAddons(form.addons),
    paymentSchedule: clonePaymentSchedule(form.paymentSchedule),
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

    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex items-start gap-3">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <span class="material-symbols-outlined text-2xl text-primary">library_books</span>
        </span>
        <div>
          <h1 class="text-3xl font-heading font-bold text-surface-dark">
            Templates
          </h1>
          <p class="mt-1 text-sm text-surface-dark/55">
            Base commune et templates de stack réutilisables pour vos devis.
          </p>
        </div>
      </div>
      <Button label="Nouveau template" @click="createTemplate">
        <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
      </Button>
    </div>

    <div
      class="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)] items-start"
    >
      <div class="flex flex-col gap-4 xl:sticky xl:top-6">
        <section
          class="rounded-3xl border border-surface-dark/5 bg-surface-card p-5"
        >
            <div class="mb-3">
              <h2 class="font-heading font-bold text-surface-dark">
                Réglages communs
              </h2>
            </div>

            <div
              v-if="baseTemplate"
              class="w-full cursor-pointer rounded-2xl border p-4 text-left transition-all"
              :class="
                isBaseSelected
                  ? 'border-primary/20 bg-primary/10'
                  : 'border-surface-dark/8 bg-white hover:border-primary/15'
              "
              @click="selectTemplate(baseTemplate.id)"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="font-heading font-bold text-surface-dark">
                  Base commune
                </p>
                <span
                  class="material-symbols-outlined shrink-0 text-lg text-primary"
                  title="Base commune protégée — préremplit les nouveaux devis"
                  >verified</span
                >
              </div>
              <p class="mt-2 text-xs text-surface-dark/45">
                Modifié : {{ formatTemplateUpdatedAt(baseTemplate) }}
              </p>
            </div>

            <div
              v-if="baseTemplate"
              class="mt-3 w-full cursor-pointer rounded-2xl border p-4 text-left transition-all"
              :class="
                isMailSelected
                  ? 'border-primary/20 bg-primary/10'
                  : 'border-surface-dark/8 bg-white hover:border-primary/15'
              "
              @click="selectMailTemplate"
            >
              <div class="flex items-start justify-between gap-2">
                <p class="font-heading font-bold text-surface-dark">
                  Mail d’envoi
                </p>
                <span
                  class="material-symbols-outlined shrink-0 text-lg text-surface-dark/50"
                  >mail</span
                >
              </div>
              <p class="mt-2 text-xs text-surface-dark/45">
                Modifié : {{ formatTemplateUpdatedAt(baseTemplate) }}
              </p>
            </div>
        </section>

        <section
          class="rounded-3xl border border-surface-dark/5 bg-surface-card p-5"
        >
            <div class="mb-4">
              <div class="min-w-0">
                <h2 class="font-heading font-bold text-surface-dark">
                  Bibliothèque
                </h2>
              </div>
            </div>

            <div class="flex flex-col gap-3">
              <div
                v-for="template in customTemplates"
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
                </div>
                <div class="mt-1 flex items-center gap-2">
                  <span class="text-sm text-surface-dark/60">
                    {{ template.platform || "other" }}
                  </span>
                </div>
                <p class="mt-2 text-xs text-surface-dark/45">
                  Modifié : {{ formatTemplateUpdatedAt(template) }}
                </p>
              </div>

              <div
                v-if="customTemplates.length === 0"
                class="rounded-2xl border border-dashed border-surface-dark/10 p-5 text-sm text-surface-dark/55"
              >
                Aucun template pour l’instant.
              </div>
            </div>
        </section>
      </div>

      <div class="flex flex-col gap-6">
        <QuoteActionBar
          :can-duplicate="Boolean(templateId) && !isBaseSelected && !isMailSelected"
          :can-delete="Boolean(templateId) && !isBaseSelected && !isMailSelected"
          :has-unsaved-changes="hasUnsavedChanges"
          @save="saveTemplate"
          @discard="discardChanges"
          @duplicate="duplicateTemplate"
          @delete="deleteTemplate"
        />

        <div
          v-if="isBaseSelected"
          class="flex items-center gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-surface-dark/75"
        >
          <span class="material-symbols-outlined text-lg text-primary"
            >verified</span
          >
          Base commune : le mail, la validation et les principes sont appliqués à chaque
          devis. Les conditions communes définies ici peuvent être placées librement dans
          chaque template. Elle ne peut pas être supprimée.
        </div>

        <section
          v-if="isMailSelected"
          class="rounded-3xl border border-surface-dark/5 bg-white p-5"
        >
          <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
            <div class="flex items-start gap-3">
              <span
                class="material-symbols-outlined mt-0.5 text-lg text-surface-dark/55"
                >mail</span
              >
              <div>
                <h2 class="font-heading text-lg font-bold text-surface-dark">
                  Mail d’envoi
                </h2>
                <p class="text-sm text-surface-dark/55">
                  Objet et contenu utilisés lors de l’envoi d’un devis.
                </p>
              </div>
            </div>
            <div>
              <label class="mb-2 block text-sm font-semibold text-surface-dark"
                >Langue</label
              >
              <Select
                v-model="form.language"
                :options="languageOptions"
                option-label="label"
                option-value="value"
                class="w-40"
              />
            </div>
          </div>
          <QuoteOutputPanel
            embedded
            :language="form.language"
            :email-subject="form.emailSubject"
            :email-body="form.emailBody"
            @update:email-subject="form.emailSubject = $event"
            @update:email-body="form.emailBody = $event"
            @copy-email-subject="() => undefined"
            @copy-email-body="() => undefined"
          />
          <p
            v-if="selectedTemplateMetadata"
            class="mt-4 border-t border-surface-dark/6 pt-3 text-xs text-surface-dark/45"
          >
            Créé : {{ selectedTemplateMetadata.createdAt }} · Dernière modification :
            {{ selectedTemplateMetadata.updatedAt }}
          </p>
        </section>

        <QuoteBuilderForm
          v-if="!isMailSelected"
          :mode="isBaseSelected ? 'base' : 'template'"
          quote-ref=""
          :title="form.name"
          project-name=""
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
          investment-summary=""
          :investment-amount="0"
          :parts="form.parts"
          :currency-locale="currencyLocale"
          :conditions="form.conditions"
          :reusable-conditions="commonConditionOptions"
          :roadmap="form.roadmap"
          :acceptance="form.acceptance"
          :principles="form.principles"
          :addons="form.addons"
          :payment-schedule="form.paymentSchedule"
          :clients="[]"
          :addons-total="0"
          :discount-amount="0"
          :subtotal="0"
          :vat-amount="0"
          :total-with-vat="0"
          vat-explanation=""
          @update:title="form.name = $event"
          @update:project-name="() => undefined"
          @update:quote-date="() => undefined"
          @update:client-id="() => undefined"
          @update:platform="form.platform = $event"
          @update:custom-platform-label="form.customPlatformLabel = $event"
          @update:language="form.language = $event"
          @update:vat-rate="form.vatRate = $event"
          @update:discount-type="form.discountType = $event as QuoteDiscountType"
          @update:discount-value="form.discountValue = $event"
          @update:project-summary="form.projectSummary = $event"
          @update:investment-summary="() => undefined"
          @update:investment-amount="() => undefined"
          @update:parts="form.parts = $event"
          @update:payment-schedule="form.paymentSchedule = $event"
          @add-condition="addCondition"
          @add-reusable-condition="addCommonCondition"
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
        <p
          v-if="!isMailSelected && selectedTemplateMetadata"
          class="rounded-2xl border border-surface-dark/6 bg-white px-4 py-3 text-xs text-surface-dark/45"
        >
          Créé : {{ selectedTemplateMetadata.createdAt }} · Dernière modification :
          {{ selectedTemplateMetadata.updatedAt }}
        </p>
      </div>
    </div>
  </div>
</template>
