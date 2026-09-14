<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type {
  QuoteAddon,
  QuoteBlock,
  QuoteCondition,
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
import { useConfirm } from "primevue/useconfirm";
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
import {
  getTemplateLanguageStatus,
  type TemplateLanguageStatus,
} from "@/utils/quoteTemplateLanguages";
import { useToast } from "primevue/usetoast";

const quoteTemplatesStore = useQuoteTemplatesStore();
const route = useRoute();
const router = useRouter();
const toast = useToast();
const confirm = useConfirm();

const createTemplateDraft = (): QuoteTemplateInput =>
  createDefaultQuoteTemplate("Template de devis", "shopify", "fr");

const form = reactive<QuoteTemplateInput>(createTemplateDraft());
const selectedLibraryItem = ref<"base" | "mail" | "template">("base");
let syncingLocalizedContent = false;
let hydratingTemplate = false;


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
    blocks: cloneBlocks(condition.blocks || []),
  }));

const cloneAddons = (addons: QuoteTemplateLocalizedContent["addons"] = []) =>
  addons.map((addon) => ({
    ...addon,
    id: addon.id || createEntityId(),
    unitLabel: addon.unitLabel || "",
    blocks: cloneBlocks(addon.blocks || []),
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
  deliverables: (slice?.deliverables || []).map((section) => ({
    ...section,
    id: section.id || createEntityId(),
    blocks: cloneBlocks(section.blocks || []),
  })),
  deliverablesDisplayStyle: slice?.deliverablesDisplayStyle || "flow",
  conditions: cloneConditions(slice?.conditions || []),
  roadmap: cloneConditions(slice?.roadmap || []),
  roadmapDisplayStyle: slice?.roadmapDisplayStyle || "flow",
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
    | "deliverables"
    | "deliverablesDisplayStyle"
    | "roadmapDisplayStyle"
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
      deliverables: source.deliverables || [],
      deliverablesDisplayStyle: source.deliverablesDisplayStyle || "flow",
      conditions: source.conditions || [],
      roadmap: source.roadmap || [],
      roadmapDisplayStyle: source.roadmapDisplayStyle || "flow",
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
  deliverablesDisplayStyle: draft.deliverablesDisplayStyle || "flow",
  deliverables: (draft.deliverables || []).map((section) => ({
    id: section.id,
    title: section.title,
    blocks: serializeBlocks(section.blocks || [], { withIds: true }),
  })),
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
    blocks: serializeBlocks(condition.blocks || [], { withIds: true }),
  })),
  roadmap: draft.roadmap.map((phase) => ({
    id: phase.id,
    commonConditionId: phase.commonConditionId || "",
    title: phase.title,
    tag: phase.tag || "",
    blocks: serializeBlocks(phase.blocks || [], { withIds: true }),
  })),
  roadmapDisplayStyle: draft.roadmapDisplayStyle || "flow",
  acceptance: draft.acceptance.map((entry) => ({
    id: entry.id,
    commonConditionId: entry.commonConditionId || "",
    title: entry.title,
    tag: entry.tag || "",
    blocks: serializeBlocks(entry.blocks || [], { withIds: true }),
  })),
  principles: draft.principles.map((principle) => ({
    id: principle.id,
    commonConditionId: principle.commonConditionId || "",
    title: principle.title,
    tag: principle.tag || "",
    blocks: serializeBlocks(principle.blocks || [], { withIds: true }),
  })),
  addons: draft.addons.map((addon) => ({
    id: addon.id,
    title: addon.title,
    blocks: serializeBlocks(addon.blocks || [], { withIds: true }),
    price: addon.price,
    unitLabel: addon.unitLabel || "",
    enabled: addon.enabled !== false,
  })),
  paymentSchedule: clonePaymentSchedule(draft.paymentSchedule || []),
});

const templateId = computed(() => quoteTemplatesStore.selectedTemplateId);
const routeTemplateId = computed(() =>
  typeof route.params.id === "string" ? route.params.id : "",
);
const currencyLocale = computed(() =>
  form.language === "en" ? "en-GB" : form.language === "es" ? "es-ES" : "fr-FR",
);
const templateLanguages = languageOptions.map((option) => option.value);
const languageLabel = (language: QuoteLanguage) =>
  languageOptions.find((option) => option.value === language)?.label || language;

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
    deliverables: (activeContent.deliverables || []).map((section) => ({
      ...section,
      id: section.id || createEntityId(),
      blocks: cloneBlocks(section.blocks || []),
    })),
    deliverablesDisplayStyle: activeContent.deliverablesDisplayStyle || "flow",
    conditions: resolveTemplateConditionReferencesForEditor(
      activeContent.conditions,
      current.language,
      shouldResolveCommonConditions,
    ),
    roadmap: cloneConditions(activeContent.roadmap),
    roadmapDisplayStyle: activeContent.roadmapDisplayStyle || "flow",
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
      deliverables: draft.deliverables,
      deliverablesDisplayStyle: draft.deliverablesDisplayStyle,
      conditions: draft.conditions,
      roadmap: draft.roadmap,
      roadmapDisplayStyle: draft.roadmapDisplayStyle,
      acceptance: draft.acceptance,
      principles: draft.principles,
      addons: draft.addons,
      paymentSchedule: draft.paymentSchedule,
    }),
  },
});

const languageStatus = (language: QuoteLanguage): TemplateLanguageStatus =>
  getTemplateLanguageStatus(withVisibleLanguageContent(form), language);

const languageStatusLabel = (status: TemplateLanguageStatus) =>
  status === "complete" ? "Complet" : status === "partial" ? "Incomplet" : "Non renseigné";

const languageStatusClass = (status: TemplateLanguageStatus) => {
  if (status === "complete") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "partial") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-surface-dark/10 bg-white text-surface-dark/35";
};

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
    deliverables: (activeContent.deliverables || []).map((section) => ({
      ...section,
      id: section.id || createEntityId(),
      blocks: cloneBlocks(section.blocks || []),
    })),
    deliverablesDisplayStyle: activeContent.deliverablesDisplayStyle || "flow",
    conditions: resolveTemplateConditionReferencesForEditor(
      activeContent.conditions,
      template.language,
      shouldResolveCommonConditions,
    ),
    roadmap: cloneConditions(activeContent.roadmap),
    roadmapDisplayStyle: activeContent.roadmapDisplayStyle || "flow",
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
      deliverables: form.deliverables,
      deliverablesDisplayStyle: form.deliverablesDisplayStyle,
      conditions: form.conditions,
      roadmap: form.roadmap,
      roadmapDisplayStyle: form.roadmapDisplayStyle,
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
  form.deliverables = cloneSections(activeContent.deliverables);
  form.deliverablesDisplayStyle = activeContent.deliverablesDisplayStyle || "flow";
  form.conditions = resolveTemplateConditionReferencesForEditor(
    activeContent.conditions,
    language,
    (form.kind || "custom") !== "base",
  );
  form.roadmap = activeContent.roadmap;
  form.roadmapDisplayStyle = activeContent.roadmapDisplayStyle || "flow";
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
      form.deliverables,
      form.deliverablesDisplayStyle,
      form.conditions,
      form.roadmap,
      form.roadmapDisplayStyle,
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
  field: "title",
  value: string,
) => {
  const condition = form.conditions.find((entry) => entry.id === id);
  if (!condition) return;
  condition.commonConditionId = "";
  (condition[field] as string) = value;
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

const setConditionBlocks = (
  collection: "conditions" | "roadmap" | "acceptance" | "principles",
  conditionId: string,
  blocks: QuoteBlock[],
) => {
  const entry = form[collection].find((item: QuoteCondition) => item.id === conditionId);
  if (!entry) return;
  if (collection === "conditions") entry.commonConditionId = "";
  entry.blocks = blocks;
};

const setAddonBlocks = (addonId: string, blocks: QuoteBlock[]) => {
  const addon = form.addons.find((entry: QuoteAddon) => entry.id === addonId);
  if (addon) addon.blocks = blocks;
};

const updateRoadmapPhase = (
  id: string,
  field: "title",
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

const updateAcceptance = (
  id: string,
  field: "title",
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

const updatePrinciple = (
  id: string,
  field: "title" | "tag",
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

const updateAddon = (
  id: string,
  field: "title" | "price" | "unitLabel",
  value: string | number,
) => {
  const addon = form.addons.find((entry) => entry.id === id);
  if (addon) (addon[field] as string | number) = value;
};

const addCondition = () => {
  form.conditions.push({
    id: createEntityId(),
    commonConditionId: "",
    title: "",
    blocks: [],
  });
};

const addRoadmapPhase = () => {
  const phase = {
    id: createEntityId(),
    title: "",
    blocks: [],
  };
  const insertIndex = Math.max(form.roadmap.length - 1, 0);
  form.roadmap.splice(insertIndex, 0, phase);
};

const addAcceptance = () => {
  form.acceptance.push({
    id: createEntityId(),
    title: "",
    blocks: [],
  });
};

const addPrinciple = () => {
  form.principles.push({
    id: createEntityId(),
    title: "",
    tag: "",
    blocks: [],
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
    blocks: cloneBlocks(source.blocks || []),
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

const selectMailTemplate = () => {
  const baseTemplate = quoteTemplatesStore.baseTemplate;
  if (!baseTemplate) return;

  guardUnsaved(() => {
    clearEditorSearch();
    selectedLibraryItem.value = "mail";
    quoteTemplatesStore.selectTemplate(baseTemplate.id);
  });
};

const showTemplateContent = () => {
  if (!quoteTemplatesStore.baseTemplate) return;
  guardUnsaved(() => {
    clearEditorSearch();
    selectedLibraryItem.value = "base";
  });
};

const returnToTemplates = () => {
  guardUnsaved(() => {
    void router.push({ name: "quote-templates" });
  });
};

const syncSelectionFromRoute = () => {
  clearEditorSearch();
  if (route.name === "quote-template-new") {
    selectedLibraryItem.value = "template";
    quoteTemplatesStore.selectTemplate(null);
    hydrateFromTemplate(null);
    return;
  }

  const target = quoteTemplatesStore.templates.find(
    (template) => template.id === routeTemplateId.value,
  );
  if (!target) {
    void router.replace({ name: "quote-templates" });
    return;
  }

  selectedLibraryItem.value = target.kind === "base" ? "base" : "template";
  quoteTemplatesStore.selectTemplate(target.id);
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
      ((condition.title || "").trim() || (condition.blocks || []).length),
  );
});

const cloneCommonConditionReference = (condition: QuoteCondition): QuoteCondition => ({
  ...condition,
  id: createEntityId(),
  commonConditionId: condition.id,
  tag: condition.tag || "",
  blocks: cloneBlocks(condition.blocks || []),
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
  if (route.name === "quote-template-new") {
    await router.replace({
      name: "quote-template-detail",
      params: { id: template.id },
    });
  }
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
      await router.push({ name: "quote-templates" });
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
      deliverables: form.deliverables,
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
    deliverables: cloneSections(form.deliverables),
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
  await router.push({
    name: "quote-template-detail",
    params: { id: template.id },
  });
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

const templateEditorRoot = ref<HTMLElement | null>(null);
const editorSearchQuery = ref("");
const editorSearchMatches = ref<HTMLElement[]>([]);
const editorSearchIndex = ref(-1);
let editorSearchTimer: ReturnType<typeof setTimeout> | null = null;

const normalizeEditorSearchText = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").replace(/\s+/g, " ").trim();

const clearEditorSearchHighlight = () => {
  templateEditorRoot.value
    ?.querySelectorAll(".template-editor-search-hit")
    .forEach((element) => element.classList.remove("template-editor-search-hit"));
};

const searchableElementValue = (element: HTMLElement) =>
  element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
    ? element.value
    : element.innerText || element.textContent || "";

const collectEditorSearchMatches = (query: string) => {
  const root = templateEditorRoot.value;
  if (!root) return [];
  const terms = normalizeEditorSearchText(query).split(" ").filter(Boolean);
  if (!terms.length) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'input:not([type="hidden"]), textarea, [contenteditable="true"], h2, h3, h4, p, label',
    ),
  ).filter((element) => {
    if (element.offsetParent === null) return false;
    const value = normalizeEditorSearchText(searchableElementValue(element));
    return value.length > 0 && terms.every((term) => value.includes(term));
  });
};

const templateToolbarOffset = () => {
  const toolbar = document.querySelector<HTMLElement>("[data-template-toolbar]");
  if (!toolbar) return 24;
  const styles = window.getComputedStyle(toolbar);
  return toolbar.getBoundingClientRect().height + (Number.parseFloat(styles.top) || 0) + 12;
};

const revealCollapsedEditorContent = async () => {
  const root = templateEditorRoot.value;
  if (!root) return;
  const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>("button")).filter(
    (button) =>
      button.offsetParent !== null &&
      button.querySelector(".material-symbols-outlined")?.textContent?.trim() === "expand_more",
  );
  buttons.forEach((button) => button.click());
  if (buttons.length) await nextTick();
};

const focusEditorSearchMatch = (index: number) => {
  clearEditorSearchHighlight();
  if (!editorSearchMatches.value.length) {
    editorSearchIndex.value = -1;
    return;
  }
  editorSearchIndex.value =
    ((index % editorSearchMatches.value.length) + editorSearchMatches.value.length) %
    editorSearchMatches.value.length;
  const target = editorSearchMatches.value[editorSearchIndex.value];
  target.classList.add("template-editor-search-hit");
  const top = target.getBoundingClientRect().top + window.scrollY - templateToolbarOffset() - 12;
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
};

const runEditorSearch = async () => {
  clearEditorSearchHighlight();
  const query = editorSearchQuery.value.trim();
  if (!query) {
    editorSearchMatches.value = [];
    editorSearchIndex.value = -1;
    return;
  }
  let matches = collectEditorSearchMatches(query);
  if (!matches.length) {
    await revealCollapsedEditorContent();
    matches = collectEditorSearchMatches(query);
  }
  editorSearchMatches.value = matches;
  focusEditorSearchMatch(0);
};

const scheduleEditorSearch = () => {
  if (editorSearchTimer) clearTimeout(editorSearchTimer);
  editorSearchTimer = setTimeout(() => void runEditorSearch(), 220);
};

const goToNextEditorSearchMatch = () => {
  if (!editorSearchQuery.value.trim()) return;
  if (!editorSearchMatches.value.length) void runEditorSearch();
  else focusEditorSearchMatch(editorSearchIndex.value + 1);
};

const clearEditorSearch = () => {
  editorSearchQuery.value = "";
  editorSearchMatches.value = [];
  editorSearchIndex.value = -1;
  clearEditorSearchHighlight();
};

const templateDocumentSections = computed(() => {
  if (isMailSelected.value) {
    return [{ id: "mail", label: "Mail d’envoi", count: 0 }];
  }
  const countById: Record<string, number> = {
    quoteInfo: 0,
    proposal: 0,
    scope: form.parts.reduce((total, part) => total + part.sections.length, 0),
    deliverables: form.deliverables.length,
    addons: form.addons.length,
    roadmap: form.roadmap.length,
    conditions: form.conditions.length,
    acceptance: form.acceptance.length,
    principles: form.principles.length,
  };
  const sections = isBaseSelected.value
    ? [
        ["quoteInfo", "Informations du template"],
        ["conditions", "Conditions communes"],
        ["acceptance", "Acceptation"],
        ["principles", "Nos principes"],
      ]
    : [
        ["quoteInfo", "Informations du template"],
        ["proposal", "Proposition de projet"],
        ["scope", "Portée du projet"],
        ["deliverables", "Livrables"],
        ["addons", "Options complémentaires"],
        ["roadmap", "Feuille de route"],
        ["conditions", "Conditions"],
      ];
  return sections.map(([id, label]) => ({ id, label, count: countById[id] || 0 }));
});

const activeTemplateSectionId = ref("");
let templateSectionSpyFrame = 0;

const scrollToTemplateSection = (id: string) => {
  const target = templateEditorRoot.value?.querySelector<HTMLElement>(
    `[data-section-id="${id}"]`,
  );
  if (!target) return;
  activeTemplateSectionId.value = id;
  const top = target.getBoundingClientRect().top + window.scrollY - templateToolbarOffset();
  window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
};

const syncActiveTemplateSection = () => {
  if (templateSectionSpyFrame) return;
  templateSectionSpyFrame = window.requestAnimationFrame(() => {
    templateSectionSpyFrame = 0;
    const nodes = Array.from(
      templateEditorRoot.value?.querySelectorAll<HTMLElement>("[data-section-id]") || [],
    )
      .map((node) => ({ node, top: node.getBoundingClientRect().top }))
      .sort((a, b) => a.top - b.top);
    if (!nodes.length) return;
    const threshold = templateToolbarOffset() + 8;
    let current = nodes[0].node;
    for (const entry of nodes) if (entry.top <= threshold) current = entry.node;
    activeTemplateSectionId.value = current.dataset.sectionId || "";
  });
};

const copyFrenchContentToActiveLanguage = () => {
  if (form.language === "fr") return;
  const targetLanguage = form.language;
  confirm.require({
    message: `Le contenu ${languageLabel(targetLanguage).toLowerCase()} actuel sera remplacé par une copie du français. Continuer ?`,
    header: "Copier le contenu français ?",
    icon: "warning",
    rejectProps: { label: "Annuler", severity: "secondary", outlined: true },
    acceptProps: { label: "Copier", severity: "primary" },
    accept: () => {
      persistActiveLanguageContent(targetLanguage);
      const frenchContent = cloneLocalizedSlice(form.localizedContent?.fr);
      form.localizedContent = {
        ...form.localizedContent,
        [targetLanguage]: frenchContent,
      };
      hydrateVisibleContentFromLanguage(targetLanguage);
      clearEditorSearch();
      toast.add({
        severity: "success",
        summary: "Contenu copié",
        detail: `La version ${languageLabel(targetLanguage).toLowerCase()} reprend maintenant le contenu français.`,
        life: 2600,
      });
    },
  });
};

onUnmounted(() => {
  if (editorSearchTimer) clearTimeout(editorSearchTimer);
  clearEditorSearchHighlight();
  window.removeEventListener("scroll", syncActiveTemplateSection);
  if (templateSectionSpyFrame) cancelAnimationFrame(templateSectionSpyFrame);
});

onMounted(async () => {
  window.addEventListener("scroll", syncActiveTemplateSection, { passive: true });
  await quoteTemplatesStore.fetchTemplates();
  syncSelectionFromRoute();
  await nextTick();
  syncActiveTemplateSection();
});

watch(
  () => [route.name, routeTemplateId.value],
  () => {
    if (!quoteTemplatesStore.loading && quoteTemplatesStore.templates.length) {
      syncSelectionFromRoute();
    } else if (route.name === "quote-template-new") {
      syncSelectionFromRoute();
    }
  },
);

watch([selectedLibraryItem, () => form.language], async () => {
  activeTemplateSectionId.value = "";
  await nextTick();
  syncActiveTemplateSection();
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <ConfirmDialog />

    <div
      data-template-toolbar
      class="sticky top-4 z-20 flex flex-wrap items-center gap-3 rounded-3xl border border-surface-dark/8 bg-surface-card/95 p-2.5 shadow-sm backdrop-blur"
    >
      <div class="flex min-w-0 flex-1 basis-[300px] items-center gap-3">
        <Button
          text
          severity="secondary"
          class="!h-9 !w-9 !shrink-0 !rounded-xl !p-0"
          aria-label="Retour aux templates"
          title="Retour aux templates"
          @click="returnToTemplates"
        >
          <template #icon><span class="material-symbols-outlined text-lg">arrow_back</span></template>
        </Button>
        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h1 class="truncate font-heading text-lg font-bold text-surface-dark">
              {{ templateId ? form.name : "Nouveau template" }}
            </h1>
            <span
              v-if="isBaseSelected || isMailSelected"
              class="shrink-0 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary"
            >
              Base commune
            </span>
          </div>
          <p class="truncate text-xs text-surface-dark/55">
            {{ languageOptions.find((option) => option.value === form.language)?.label || form.language }}
            <template v-if="isMailSelected"> · Mail d’envoi</template>
            <template v-else-if="templateId"> · Template de devis</template>
            <template v-else> · En création</template>
          </p>
        </div>
      </div>

      <div class="relative min-w-[210px] flex-1 basis-[250px] lg:max-w-[320px]">
        <span class="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-lg text-surface-dark/35">search</span>
        <input
          v-model="editorSearchQuery"
          type="search"
          class="h-10 w-full rounded-xl border border-surface-dark/10 bg-white py-2 pl-10 pr-14 text-sm text-surface-dark outline-none transition placeholder:text-surface-dark/35 focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
          placeholder="Rechercher dans le template…"
          aria-label="Rechercher dans l’éditeur du template"
          @input="scheduleEditorSearch"
          @keydown.enter.prevent="goToNextEditorSearchMatch"
          @keydown.esc="clearEditorSearch"
        />
        <span
          v-if="editorSearchQuery.trim()"
          class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] tabular-nums"
          :class="editorSearchMatches.length ? 'text-surface-dark/45' : 'text-red-500'"
        >{{ editorSearchMatches.length ? `${editorSearchIndex + 1}/${editorSearchMatches.length}` : "0" }}</span>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <span class="flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold text-surface-dark/45">
          <span class="material-symbols-outlined text-base">{{ hasUnsavedChanges ? "edit" : "cloud_done" }}</span>
          {{ hasUnsavedChanges ? "Modifié" : "Enregistré" }}
        </span>
        <Button v-if="hasUnsavedChanges" text severity="secondary" class="!rounded-xl" label="Annuler" @click="discardChanges">
          <template #icon><span class="material-symbols-outlined text-lg">undo</span></template>
        </Button>
        <Button
          v-if="templateId && !isBaseSelected && !isMailSelected"
          text
          severity="secondary"
          class="!h-9 !w-9 !rounded-xl !p-0"
          aria-label="Dupliquer le template"
          title="Dupliquer le template"
          @click="duplicateTemplate"
        >
          <template #icon><span class="material-symbols-outlined text-lg">content_copy</span></template>
        </Button>
        <Button class="!rounded-xl !px-5 font-semibold" label="Sauvegarder" :disabled="!hasUnsavedChanges" @click="saveTemplate">
          <template #icon><span class="material-symbols-outlined text-lg">save</span></template>
        </Button>
        <Button
          v-if="templateId && !isBaseSelected && !isMailSelected"
          text
          severity="danger"
          class="!h-9 !w-9 !rounded-xl !p-0"
          aria-label="Supprimer le template"
          title="Supprimer le template"
          @click="deleteTemplate"
        >
          <template #icon><span class="material-symbols-outlined text-lg">delete</span></template>
        </Button>
      </div>
    </div>

    <section class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-dark/7 bg-surface-card px-3 py-2.5 shadow-sm">
      <div class="flex flex-wrap items-center gap-2">
        <span class="mr-1 text-[11px] font-semibold uppercase tracking-wider text-surface-dark/40">Langue du contenu</span>
        <button
          v-for="language in templateLanguages"
          :key="language"
          type="button"
          class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold transition"
          :class="[
            form.language === language
              ? 'border-primary/25 bg-primary/10 text-primary'
              : 'border-transparent bg-surface-dark/[0.035] text-surface-dark/60 hover:bg-surface-dark/6 hover:text-surface-dark',
          ]"
          @click="form.language = language"
        >
          <span class="uppercase">{{ language }}</span>
          <span class="hidden sm:inline">{{ languageLabel(language) }}</span>
          <span
            class="h-2 w-2 rounded-full"
            :class="
              languageStatus(language) === 'complete'
                ? 'bg-emerald-500'
                : languageStatus(language) === 'partial'
                  ? 'bg-amber-500'
                  : 'bg-surface-dark/20'
            "
            :title="languageStatusLabel(languageStatus(language))"
          ></span>
        </button>
      </div>
      <div class="flex items-center gap-3">
        <span
          class="hidden rounded-full border px-2.5 py-1 text-xs font-semibold sm:inline-flex"
          :class="languageStatusClass(languageStatus(form.language))"
        >{{ languageStatusLabel(languageStatus(form.language)) }}</span>
        <Button
          v-if="form.language !== 'fr'"
          text
          severity="secondary"
          size="small"
          class="!rounded-xl"
          label="Copier depuis le français"
          @click="copyFrenchContentToActiveLanguage"
        >
          <template #icon><span class="material-symbols-outlined text-base">content_copy</span></template>
        </Button>
      </div>
    </section>

    <div
      v-if="quoteTemplatesStore.selectedTemplate?.kind === 'base'"
      class="inline-flex w-fit rounded-xl bg-surface-dark/5 p-1"
    >
      <button
        type="button"
        class="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
        :class="isBaseSelected ? 'bg-white text-surface-dark shadow-sm' : 'text-surface-dark/50 hover:text-surface-dark'"
        @click="showTemplateContent"
      >
        Contenu du template
      </button>
      <button
        type="button"
        class="rounded-lg px-3 py-1.5 text-sm font-semibold transition"
        :class="isMailSelected ? 'bg-white text-surface-dark shadow-sm' : 'text-surface-dark/50 hover:text-surface-dark'"
        @click="selectMailTemplate"
      >
        Mail d’envoi
      </button>
    </div>

    <div class="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
      <div ref="templateEditorRoot" class="flex min-w-0 flex-col gap-6">
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
          data-section-id="mail"
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
          :valid-until="null"
          client-id=""
          client-name=""
          client-address=""
          client-website=""
          client-country=""
          client-vat-label=""
          :custom-platform-label="form.customPlatformLabel"
          :language="form.language"
          :vat-rate="form.vatRate"
          :discount-type="form.discountType"
          :discount-value="form.discountValue"
          :project-summary="form.projectSummary"
          investment-summary=""
          :investment-amount="0"
          :parts="form.parts"
          :deliverables="form.deliverables"
          :deliverables-display-style="form.deliverablesDisplayStyle"
          :roadmap-display-style="form.roadmapDisplayStyle"
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
          @update:custom-platform-label="form.customPlatformLabel = $event"
          @update:language="form.language = $event"
          @update:vat-rate="form.vatRate = $event"
          @update:discount-type="form.discountType = $event as QuoteDiscountType"
          @update:discount-value="form.discountValue = $event"
          @update:project-summary="form.projectSummary = $event"
          @update:investment-summary="() => undefined"
          @update:investment-amount="() => undefined"
          @update:parts="form.parts = $event"
          @update:deliverables="form.deliverables = $event"
          @update:deliverables-display-style="form.deliverablesDisplayStyle = $event"
          @update:roadmap-display-style="form.roadmapDisplayStyle = $event"
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
          @update-condition-blocks="setConditionBlocks('conditions', $event.conditionId, $event.blocks)"
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
          @update-roadmap-blocks="setConditionBlocks('roadmap', $event.conditionId, $event.blocks)"
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
          @update-acceptance-blocks="setConditionBlocks('acceptance', $event.conditionId, $event.blocks)"
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
          @update-principle-blocks="setConditionBlocks('principles', $event.conditionId, $event.blocks)"
          @add-addon-preset="addAddonPreset"
          @duplicate-addon="duplicateAddon"
          @update-addon="updateAddon($event.id, $event.field, $event.value)"
          @remove-addon="
            form.addons = form.addons.filter((addon) => addon.id !== $event)
          "
          @move-addon="moveAddon($event.draggedId, $event.targetId)"
          @update-addon-blocks="setAddonBlocks($event.addonId, $event.blocks)"
        />
        <p
          v-if="!isMailSelected && selectedTemplateMetadata"
          class="rounded-2xl border border-surface-dark/6 bg-white px-4 py-3 text-xs text-surface-dark/45"
        >
          Créé : {{ selectedTemplateMetadata.createdAt }} · Dernière modification :
          {{ selectedTemplateMetadata.updatedAt }}
        </p>
      </div>
      <aside class="flex flex-col gap-4 xl:sticky xl:top-24 xl:self-start">
        <div class="rounded-2xl border border-surface-dark/6 bg-surface-card p-4 shadow-sm">
          <p class="mb-3 text-[11px] font-semibold uppercase tracking-wider text-surface-dark/35">
            Sections
          </p>
          <nav class="-mx-1.5 flex flex-col gap-px">
            <button
              v-for="section in templateDocumentSections"
              :key="section.id"
              type="button"
              class="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition"
              :class="
                activeTemplateSectionId === section.id
                  ? 'bg-primary/10 font-semibold text-primary'
                  : 'text-surface-dark/70 hover:bg-surface-dark/4 hover:text-surface-dark'
              "
              @click="scrollToTemplateSection(section.id)"
            >
              <span class="min-w-0 truncate">{{ section.label }}</span>
              <span
                v-if="section.count"
                class="shrink-0 text-[11.5px] tabular-nums"
                :class="activeTemplateSectionId === section.id ? 'opacity-75' : 'text-surface-dark/35'"
              >{{ section.count }}</span>
            </button>
          </nav>
        </div>
        <div class="rounded-2xl border border-surface-dark/6 bg-surface-card p-4 text-xs text-surface-dark/50 shadow-sm">
          <p class="font-semibold text-surface-dark/70">{{ languageLabel(form.language) }}</p>
          <p class="mt-1">{{ languageStatusLabel(languageStatus(form.language)) }}</p>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
:global(.template-editor-search-hit) {
  position: relative;
  z-index: 1;
  border-radius: 8px;
  outline: 3px solid color-mix(in srgb, var(--p-primary-color) 32%, transparent);
  outline-offset: 3px;
  background-color: color-mix(in srgb, var(--p-primary-color) 9%, transparent) !important;
  transition: outline-color 0.2s ease, background-color 0.2s ease;
}
</style>
