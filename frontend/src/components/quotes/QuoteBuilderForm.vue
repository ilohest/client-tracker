<script setup lang="ts">
import type {
  Client,
  ClientPlatform,
  QuoteAddon,
  QuoteCondition,
  QuoteCustomSection,
  QuoteDiscountType,
  QuoteInvestmentLine,
  QuoteLanguage,
  QuotePart,
  QuotePartDisplayStyle,
  QuotePaymentScheduleStep,
  QuoteSection,
  QuoteStatus,
  VatRate,
} from "@client-tracker/contracts";
import Button from "primevue/button";
import DatePicker from "primevue/datepicker";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Menu from "primevue/menu";
import Select from "primevue/select";
import SelectButton from "primevue/selectbutton";
import QuoteAddonsEditor from "@/components/quotes/QuoteAddonsEditor.vue";
import QuoteConditionsEditor from "@/components/quotes/QuoteConditionsEditor.vue";
import QuoteInvestmentLinesEditor from "@/components/quotes/QuoteInvestmentLinesEditor.vue";
import QuotePaymentScheduleEditor from "@/components/quotes/QuotePaymentScheduleEditor.vue";
import QuoteSectionsEditor from "@/components/quotes/QuoteSectionsEditor.vue";
import RichTextEditor from "@/components/quotes/RichTextEditor.vue";
import { getCountryFlag, getCountryLabel } from "@/lib/countries";
import {
  discountTypeOptions,
  getEstimatedTimelineTitle,
  languageOptions,
  platformOptions,
  quoteStatusMeta,
  quoteStatusOptions,
  vatOptions,
} from "@/lib/clientPresets";
import { computed, ref } from "vue";
import { createEmptyQuotePart, createEntityId } from "@/utils/quote";
import { createBlock } from "@/utils/quoteBlocks";

const props = defineProps<{
  /**
   * quote = devis complet ; template = template de stack ; base = base commune
   * (mail, validation, principes et bibliothèque de conditions communes).
   */
  mode?: "quote" | "template" | "base";
  status?: QuoteStatus;
  version?: number;
  quoteRef: string;
  title: string;
  projectName: string;
  quoteDate: Date | null;
  validUntil: string;
  clientId: string;
  clientName: string;
  clientAddress: string;
  clientWebsite: string;
  clientCountry: string;
  clientVatLabel: string;
  platform: ClientPlatform;
  customPlatformLabel: string;
  language: QuoteLanguage;
  vatRate: VatRate;
  discountType: QuoteDiscountType;
  discountValue: number;
  projectSummary: string;
  investmentSummary: string;
  investmentAmount: number;
  investmentLines?: QuoteInvestmentLine[];
  /** Un template de départ est sélectionné → on propose la réapplication par section. */
  canReapplyTemplate?: boolean;
  parts: QuotePart[];
  currencyLocale?: string;
  conditions: QuoteCondition[];
  reusableConditions?: QuoteCondition[];
  roadmap: QuoteCondition[];
  acceptance: QuoteCondition[];
  principles: QuoteCondition[];
  addons: QuoteAddon[];
  customSections?: QuoteCustomSection[];
  documentOrder?: string[];
  hiddenSections?: string[];
  paymentSchedule: QuotePaymentScheduleStep[];
  clients: Client[];
  addonsTotal: number;
  discountAmount: number;
  subtotal: number;
  vatAmount: number;
  totalWithVat: number;
  vatExplanation: string;
}>();

const emit = defineEmits<{
  "update:title": [value: string];
  "update:projectName": [value: string];
  "update:quoteDate": [value: Date | null];
  "update:clientId": [value: string];
  "update:platform": [value: ClientPlatform];
  "update:customPlatformLabel": [value: string];
  "update:language": [value: QuoteLanguage];
  "update:vatRate": [value: VatRate];
  "update:discountType": [value: QuoteDiscountType];
  "update:discountValue": [value: number];
  "update:projectSummary": [value: string];
  "update:investmentSummary": [value: string];
  "update:investmentAmount": [value: number];
  "update:investmentLines": [value: QuoteInvestmentLine[]];
  reapplyTemplateSection: [
    section: "projectSummary" | "parts" | "conditions" | "roadmap" | "addons",
  ];
  "update:parts": [value: QuotePart[]];
  "update:customSections": [value: QuoteCustomSection[]];
  "update:documentOrder": [value: string[]];
  "update:hiddenSections": [value: string[]];
  "update:paymentSchedule": [value: QuotePaymentScheduleStep[]];
  "update:status": [value: QuoteStatus];
  newVersion: [];
  createClient: [];
  addCondition: [];
  addReusableCondition: [conditionId: string];
  updateCondition: [
    payload: { id: string; field: "title" | "body"; value: string },
  ];
  removeCondition: [id: string];
  addConditionItem: [conditionId: string];
  updateConditionItem: [
    payload: { conditionId: string; itemId: string; value: string },
  ];
  removeConditionItem: [payload: { conditionId: string; itemId: string }];
  moveConditionItem: [
    payload: { conditionId: string; draggedId: string; targetId: string },
  ];
  nestConditionItemUnderItem: [
    payload: { conditionId: string; draggedId: string; targetId: string },
  ];
  addConditionSubItem: [payload: { conditionId: string; itemId: string }];
  updateConditionSubItem: [
    payload: {
      conditionId: string;
      itemId: string;
      subItemId: string;
      value: string;
    },
  ];
  removeConditionSubItem: [
    payload: { conditionId: string; itemId: string; subItemId: string },
  ];
  moveConditionSubItem: [
    payload: {
      conditionId: string;
      itemId: string;
      draggedId: string;
      targetId: string;
    },
  ];
  moveConditionSubItemToItem: [
    payload: {
      conditionId: string;
      fromItemId: string;
      subItemId: string;
      targetItemId: string;
    },
  ];
  promoteConditionSubItemToItem: [
    payload: {
      conditionId: string;
      fromItemId: string;
      subItemId: string;
      targetId: string;
    },
  ];
  addRoadmapPhase: [];
  moveRoadmapPhase: [payload: { draggedId: string; targetId: string }];
  updateRoadmapPhase: [
    payload: { id: string; field: "title" | "body"; value: string },
  ];
  removeRoadmapPhase: [id: string];
  addRoadmapItem: [phaseId: string];
  updateRoadmapItem: [
    payload: { conditionId: string; itemId: string; value: string },
  ];
  removeRoadmapItem: [payload: { conditionId: string; itemId: string }];
  moveRoadmapItem: [
    payload: { conditionId: string; draggedId: string; targetId: string },
  ];
  nestRoadmapItemUnderItem: [
    payload: { conditionId: string; draggedId: string; targetId: string },
  ];
  addRoadmapSubItem: [payload: { conditionId: string; itemId: string }];
  updateRoadmapSubItem: [
    payload: {
      conditionId: string;
      itemId: string;
      subItemId: string;
      value: string;
    },
  ];
  removeRoadmapSubItem: [
    payload: { conditionId: string; itemId: string; subItemId: string },
  ];
  moveRoadmapSubItem: [
    payload: {
      conditionId: string;
      itemId: string;
      draggedId: string;
      targetId: string;
    },
  ];
  moveRoadmapSubItemToItem: [
    payload: {
      conditionId: string;
      fromItemId: string;
      subItemId: string;
      targetItemId: string;
    },
  ];
  promoteRoadmapSubItemToItem: [
    payload: {
      conditionId: string;
      fromItemId: string;
      subItemId: string;
      targetId: string;
    },
  ];
  addAcceptance: [];
  moveAcceptance: [payload: { draggedId: string; targetId: string }];
  updateAcceptance: [
    payload: { id: string; field: "title" | "body"; value: string },
  ];
  removeAcceptance: [id: string];
  addAcceptanceItem: [acceptanceId: string];
  updateAcceptanceItem: [
    payload: { conditionId: string; itemId: string; value: string },
  ];
  removeAcceptanceItem: [payload: { conditionId: string; itemId: string }];
  moveAcceptanceItem: [
    payload: { conditionId: string; draggedId: string; targetId: string },
  ];
  nestAcceptanceItemUnderItem: [
    payload: { conditionId: string; draggedId: string; targetId: string },
  ];
  addAcceptanceSubItem: [payload: { conditionId: string; itemId: string }];
  updateAcceptanceSubItem: [
    payload: {
      conditionId: string;
      itemId: string;
      subItemId: string;
      value: string;
    },
  ];
  removeAcceptanceSubItem: [
    payload: { conditionId: string; itemId: string; subItemId: string },
  ];
  moveAcceptanceSubItem: [
    payload: {
      conditionId: string;
      itemId: string;
      draggedId: string;
      targetId: string;
    },
  ];
  moveAcceptanceSubItemToItem: [
    payload: {
      conditionId: string;
      fromItemId: string;
      subItemId: string;
      targetItemId: string;
    },
  ];
  promoteAcceptanceSubItemToItem: [
    payload: {
      conditionId: string;
      fromItemId: string;
      subItemId: string;
      targetId: string;
    },
  ];
  addPrinciple: [];
  movePrinciple: [payload: { draggedId: string; targetId: string }];
  updatePrinciple: [
    payload: { id: string; field: "title" | "body" | "tag"; value: string },
  ];
  removePrinciple: [id: string];
  addPrincipleItem: [principleId: string];
  updatePrincipleItem: [
    payload: { conditionId: string; itemId: string; value: string },
  ];
  removePrincipleItem: [payload: { conditionId: string; itemId: string }];
  movePrincipleItem: [
    payload: { conditionId: string; draggedId: string; targetId: string },
  ];
  nestPrincipleItemUnderItem: [
    payload: { conditionId: string; draggedId: string; targetId: string },
  ];
  addPrincipleSubItem: [payload: { conditionId: string; itemId: string }];
  updatePrincipleSubItem: [
    payload: {
      conditionId: string;
      itemId: string;
      subItemId: string;
      value: string;
    },
  ];
  removePrincipleSubItem: [
    payload: { conditionId: string; itemId: string; subItemId: string },
  ];
  movePrincipleSubItem: [
    payload: {
      conditionId: string;
      itemId: string;
      draggedId: string;
      targetId: string;
    },
  ];
  movePrincipleSubItemToItem: [
    payload: {
      conditionId: string;
      fromItemId: string;
      subItemId: string;
      targetItemId: string;
    },
  ];
  promotePrincipleSubItemToItem: [
    payload: {
      conditionId: string;
      fromItemId: string;
      subItemId: string;
      targetId: string;
    },
  ];
  addAddonPreset: [];
  updateAddon: [
    payload: {
      id: string;
      field: "title" | "description" | "price" | "unitLabel";
      value: string | number;
    },
  ];
  removeAddon: [id: string];
  moveAddon: [payload: { draggedId: string; targetId: string }];
  addAddonItem: [addonId: string];
  updateAddonItem: [
    payload: { addonId: string; itemId: string; value: string },
  ];
  removeAddonItem: [payload: { addonId: string; itemId: string }];
  moveAddonItem: [
    payload: { addonId: string; draggedId: string; targetId: string },
  ];
  nestAddonItemUnderItem: [
    payload: { addonId: string; draggedId: string; targetId: string },
  ];
  addAddonSubItem: [payload: { addonId: string; itemId: string }];
  updateAddonSubItem: [
    payload: {
      addonId: string;
      itemId: string;
      subItemId: string;
      value: string;
    },
  ];
  removeAddonSubItem: [
    payload: { addonId: string; itemId: string; subItemId: string },
  ];
  moveAddonSubItem: [
    payload: {
      addonId: string;
      itemId: string;
      draggedId: string;
      targetId: string;
    },
  ];
  moveAddonSubItemToItem: [
    payload: {
      addonId: string;
      fromItemId: string;
      subItemId: string;
      targetItemId: string;
    },
  ];
  promoteAddonSubItemToItem: [
    payload: {
      addonId: string;
      fromItemId: string;
      subItemId: string;
      targetId: string;
    },
  ];
  duplicateAddon: [id: string];
}>();

const isTemplate = computed(() => props.mode === "template");
const isBase = computed(() => props.mode === "base");
const isQuote = computed(() => !isTemplate.value && !isBase.value);
// La portée est désormais un seul niveau : les anciennes « parties » sont
// aplaties dans une unique collection de lignes, sans perdre leur contenu.
const scopeSections = computed<QuoteSection[]>({
  get: () => props.parts.flatMap((part) => part.sections || []),
  set: (sections) => {
    const first = props.parts[0] || createEmptyQuotePart();
    const legacyTotal = props.parts.reduce(
      (sum, part) => sum + Number(part.price || 0),
      0,
    );
    emit("update:parts", [
      {
        ...first,
        title: "",
        displayStyle: first.displayStyle || "flow",
        price: legacyTotal,
        optional: false,
        includeInInvestment: true,
        sections,
      },
    ]);
  },
});
const scopeDisplayOptions: Array<{
  label: string;
  value: QuotePartDisplayStyle;
}> = [
  { label: "Fluide", value: "flow" },
  { label: "Encadré", value: "framed" },
];
const scopeDisplayStyle = computed<QuotePartDisplayStyle>({
  get: () => props.parts[0]?.displayStyle || "flow",
  set: (displayStyle) => {
    const first = props.parts[0] || createEmptyQuotePart();
    const legacyTotal = props.parts.reduce(
      (sum, part) => sum + Number(part.price || 0),
      0,
    );
    emit("update:parts", [
      {
        ...first,
        title: "",
        displayStyle,
        price: legacyTotal,
        optional: false,
        includeInInvestment: true,
        sections: scopeSections.value,
      },
    ]);
  },
});
const documentItems = computed(() => {
  const fixed = [
    { id: "quoteInfo", label: "Informations du devis", fixed: true },
    { id: "proposal", label: "Proposition de projet", fixed: true },
    { id: "scope", label: "Portée du projet", fixed: true },
    { id: "customSections", label: "Sections personnalisées", fixed: true },
    { id: "addons", label: "Options complémentaires", fixed: true },
    { id: "investment", label: "Investissement", fixed: true },
    { id: "paymentSchedule", label: "Échéancier de paiement", fixed: true },
    { id: "roadmap", label: "Feuille de route", fixed: true },
    { id: "conditions", label: "Conditions", fixed: true },
    { id: "acceptance", label: "Acceptation", fixed: true },
    { id: "principles", label: "Principes", fixed: true },
  ];
  const custom = (props.customSections || []).map((section) => ({
    id: section.id,
    label: section.title || "Nouvelle section",
    fixed: false,
  }));
  const known = new Map([...fixed, ...custom].map((item) => [item.id, item]));
  const configuredOrder = props.documentOrder || [];
  const canonicalOrder = fixed.map((item) => item.id);
  const effectiveOrder = configuredOrder.length <= 3
    ? [...canonicalOrder, ...custom.map((item) => item.id)]
    : configuredOrder;
  const order = [
    ...effectiveOrder.filter((id) => known.has(id)),
    ...[...known.keys()].filter((id) => !effectiveOrder.includes(id)),
  ];
  return order.map((id) => known.get(id)!).filter(Boolean);
});
const documentSectionOrder = (id: string) => documentItems.value.findIndex((item) => item.id === id);
const updateCustomSection = (
  id: string,
  field: "title" | "content" | "sections" | "displayStyle",
  value: string | QuoteSection[] | QuotePartDisplayStyle,
) =>
  emit(
    "update:customSections",
    (props.customSections || []).map((section) =>
      section.id === id ? { ...section, [field]: value } : section,
    ),
  );
const addCustomSection = () => {
  const section = {
    id: createEntityId(),
    title: "Nouvelle section",
    content: "",
    displayStyle: "flow" as QuotePartDisplayStyle,
    sections: [{ id: createEntityId(), title: "", blocks: [createBlock()] }],
  };
  emit("update:customSections", [...(props.customSections || []), section]);
  emit("update:documentOrder", [
    ...documentItems.value.map((item) => item.id),
    section.id,
  ]);
};
const removeCustomSection = (id: string) => {
  emit(
    "update:customSections",
    (props.customSections || []).filter((section) => section.id !== id),
  );
  emit(
    "update:documentOrder",
    documentItems.value
      .map((item) => item.id)
      .filter((itemId) => itemId !== id),
  );
};
const moveDocumentItem = (id: string, direction: -1 | 1) => {
  const order = documentItems.value.map((item) => item.id);
  const index = order.indexOf(id);
  const target = index + direction;
  if (target < 0 || target >= order.length) return;
  [order[index], order[target]] = [order[target], order[index]];
  emit("update:documentOrder", order);
};
const isSectionHidden = (id: string) => (props.hiddenSections || []).includes(id);
const toggleSectionHidden = (id: string) => {
  const hidden = new Set(props.hiddenSections || []);
  if (hidden.has(id)) hidden.delete(id);
  else hidden.add(id);
  emit("update:hiddenSections", [...hidden]);
};
const customSectionMenus = ref<Record<string, { toggle: (event: Event) => void }>>({});
const sectionMenus = ref<Record<string, { toggle: (event: Event) => void }>>({});
const setCustomSectionMenu = (id: string, instance: unknown) => {
  if (instance && typeof instance === "object" && "toggle" in instance) {
    customSectionMenus.value[id] = instance as { toggle: (event: Event) => void };
  }
};
const setSectionMenu = (id: string, instance: unknown) => {
  if (instance && typeof instance === "object" && "toggle" in instance) {
    sectionMenus.value[id] = instance as { toggle: (event: Event) => void };
  }
};
const sectionMenuItems = (id: string) => [
  ...(id === "proposal" && props.canReapplyTemplate ? [{ label: "↻  Réappliquer le contenu du template", command: () => emit("reapplyTemplateSection", "projectSummary") }] : []),
  ...(id === "scope" && props.canReapplyTemplate ? [{ label: "↻  Réappliquer la portée du template", command: () => emit("reapplyTemplateSection", "parts") }] : []),
  ...(id === "addons" && props.canReapplyTemplate ? [{ label: "↻  Réappliquer les options du template", command: () => emit("reapplyTemplateSection", "addons") }] : []),
  ...(id === "roadmap" && props.canReapplyTemplate ? [{ label: "↻  Réappliquer la feuille de route", command: () => emit("reapplyTemplateSection", "roadmap") }] : []),
  ...(id === "conditions" && props.canReapplyTemplate ? [{ label: "↻  Réappliquer les conditions", command: () => emit("reapplyTemplateSection", "conditions") }] : []),
  { separator: true },
  { label: isSectionHidden(id) ? "◉  Afficher la section" : "◌  Masquer la section", command: () => toggleSectionHidden(id) },
];
const customSectionMenuItems = (id: string) => [
  { label: isSectionHidden(id) ? "◉  Afficher la section" : "◌  Masquer la section", command: () => toggleSectionHidden(id) },
  { separator: true },
  {
    label: "▣  Supprimer la section",
    command: () => removeCustomSection(id),
  },
];
const canEditCustomPlatformLabel = computed(
  () => props.platform === "custom" || props.platform === "other",
);

const statusLocked = computed(() =>
  props.status ? quoteStatusMeta[props.status].locked : false,
);
const lockedCommonConditionIds = computed(() =>
  isTemplate.value
    ? props.conditions
        .filter((condition) => condition.commonConditionId)
        .map((condition) => condition.id)
    : [],
);
const conditionBadges = computed(() =>
  Object.fromEntries(
    props.conditions
      .filter((condition) => condition.commonConditionId)
      .map((condition) => [condition.id, "Commune"]),
  ),
);

const handleTitle = (value: string | undefined) =>
  emit("update:title", value || "");
const handleProjectName = (value: string | undefined) =>
  emit("update:projectName", value || "");
const handleQuoteDate = (
  value: Date | (Date | null)[] | Date[] | null | undefined,
) => emit("update:quoteDate", value instanceof Date ? value : null);
const handleClientId = (value: string | null | undefined) =>
  emit("update:clientId", value || "");
const handlePlatform = (value: ClientPlatform | null | undefined) =>
  emit("update:platform", value || "");
const handleCustomPlatformLabel = (value: string | undefined) =>
  emit("update:customPlatformLabel", value || "");
const handleLanguage = (value: QuoteLanguage) => emit("update:language", value);
const handleVatRate = (value: VatRate) => emit("update:vatRate", value);
const handleDiscountType = (value: QuoteDiscountType) =>
  emit("update:discountType", value);
const handleDiscountValue = (value: number | null | undefined) =>
  emit("update:discountValue", Number(value || 0));
const handleProjectSummary = (value: string) =>
  emit("update:projectSummary", value);
const handleInvestmentSummary = (value: string | undefined) =>
  emit("update:investmentSummary", value || "");
const handleInvestmentAmount = (value: number | null | undefined) =>
  emit("update:investmentAmount", Number(value || 0));
const handleInvestmentLines = (value: QuoteInvestmentLine[]) =>
  emit("update:investmentLines", value);
const amountFormatter = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatAmount = (value: number | null | undefined) =>
  amountFormatter.format(Number.isFinite(value) ? Number(value) : 0);
const getAmountBeforeDiscount = (subtotal: number, discountAmount: number) =>
  Number(subtotal || 0) + Number(discountAmount || 0);
</script>

<template>
  <section class="flex flex-col gap-6">
    <div
      v-if="isQuote"
      class="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-surface-dark/5 bg-surface-card p-5 shadow-[0_8px_24px_rgba(33,35,54,0.06)]"
    >
      <div
        class="flex items-center gap-3 rounded-2xl bg-white border border-surface-dark/5 px-4 py-3"
      >
        <div>
          <p class="text-xs uppercase tracking-wide text-surface-dark/45">
            Référence
          </p>
          <p class="font-heading font-bold text-surface-dark">{{ quoteRef }}</p>
        </div>
        <span
          v-if="(version || 1) > 1"
          class="self-start rounded-full bg-surface-dark/8 px-2 py-0.5 text-xs font-bold text-surface-dark/70"
          >v{{ version }}</span
        >
      </div>

      <div class="flex items-center gap-2">
        <div class="flex flex-col gap-1">
          <span
            class="text-[11px] font-medium uppercase tracking-wide text-surface-dark/45"
            >Statut</span
          >
          <Select
            :model-value="status"
            :options="quoteStatusOptions"
            option-label="label"
            option-value="value"
            class="min-w-[11rem]"
            @update:model-value="emit('update:status', $event)"
          >
            <template #value="{ value }">
              <span
                v-if="value"
                class="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                :class="quoteStatusMeta[value as QuoteStatus].tagClass"
                >{{ quoteStatusMeta[value as QuoteStatus].label }}</span
              >
            </template>
            <template #option="{ option }">
              <span
                class="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                :class="quoteStatusMeta[option.value as QuoteStatus].tagClass"
                >{{ option.label }}</span
              >
            </template>
          </Select>
        </div>
        <Button
          severity="secondary"
          outlined
          class="mt-4 !rounded-xl"
          :title="
            statusLocked
              ? 'Ce devis est figé — crée une nouvelle version pour le modifier'
              : 'Créer une nouvelle version de ce devis'
          "
          @click="emit('newVersion')"
        >
          <span class="material-symbols-outlined text-lg">add</span>
          <span class="hidden sm:inline">Nouvelle version</span>
        </Button>
      </div>
    </div>

    <div
      v-if="isQuote && statusLocked"
      class="mb-6 flex items-start gap-2 rounded-2xl border border-amber-400/40 bg-amber-50 p-3 text-sm text-amber-800"
    >
      <span class="material-symbols-outlined text-lg">lock</span>
      <p>
        Ce devis est
        <strong>{{ status ? quoteStatusMeta[status].label : "" }}</strong> et ne
        devrait plus être modifié. Crée une nouvelle version pour apporter des
        changements.
      </p>
    </div>

    <div :style="{ order: documentSectionOrder('quoteInfo') }" class="grid grid-cols-1 gap-4 rounded-3xl border border-surface-dark/5 bg-white p-5 shadow-[0_8px_24px_rgba(33,35,54,0.06)] lg:grid-cols-2">
      <div class="flex items-center justify-between gap-3 lg:col-span-2">
        <h3 class="font-heading font-bold text-surface-dark">Informations du devis</h3>
      </div>
      <label
        class="flex flex-col gap-2"
        :class="isQuote ? '' : 'lg:col-span-2'"
      >
        <span class="text-sm font-semibold text-surface-dark">{{
          isQuote ? "Titre du devis" : "Nom du template"
        }}</span>
        <InputText
          :model-value="title"
          placeholder="Ex: Refonte du site vitrine"
          @update:model-value="handleTitle"
        />
      </label>
      <label v-if="isQuote" class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark"
          >Nom du projet</span
        >
        <InputText
          :model-value="projectName"
          placeholder="Ex: AutoVOPro"
          @update:model-value="handleProjectName"
        />
      </label>
      <label v-if="isQuote" class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark"
          >Date du devis</span
        >
        <DatePicker
          :model-value="quoteDate"
          date-format="dd/mm/yy"
          show-icon
          icon-display="input"
          class="w-full"
          @update:model-value="handleQuoteDate"
        />
      </label>
      <label v-if="isQuote" class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">Validité</span>
        <InputText :model-value="validUntil" disabled />
      </label>
      <div v-if="isQuote" class="lg:col-span-2">
        <span class="text-sm font-semibold text-surface-dark block mb-2"
          >Client</span
        >
        <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_160px] gap-3">
          <Select
            :model-value="clientId"
            :options="
              clients.map((client) => ({
                label: client.name,
                value: client.id,
              }))
            "
            option-label="label"
            option-value="value"
            filter
            filter-by="label"
            filter-placeholder="Rechercher un client"
            placeholder="Sélectionner un client existant"
            @update:model-value="handleClientId"
          />
          <Button
            severity="secondary"
            @click="emit('createClient')"
            label="Nouveau client"
          >
            <template #icon
              ><span class="material-symbols-outlined text-lg"
                >add</span
              ></template
            ></Button
          >
        </div>
      </div>
      <div
        v-if="isQuote"
        class="rounded-2xl bg-white border border-surface-dark/5 p-4 lg:col-span-2"
      >
        <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-1">
          Client sélectionné
        </p>
        <p class="font-heading font-bold text-surface-dark">
          {{ clientName || "Aucun client" }}
        </p>
        <p class="text-sm text-surface-dark/60 mt-1">
          {{ clientWebsite || "Site non renseigné" }}
        </p>
      </div>
      <div
        v-if="isQuote"
        class="rounded-2xl bg-white border border-surface-dark/5 p-4"
      >
        <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-1">
          Facturation client
        </p>
        <p class="text-sm font-semibold text-surface-dark">
          {{ getCountryFlag(clientCountry) }}
          {{ getCountryLabel(clientCountry) }}
        </p>
        <p class="text-sm text-surface-dark/60 mt-1">{{ clientVatLabel }}</p>
      </div>
      <div
        v-if="isQuote"
        class="rounded-2xl bg-white border border-surface-dark/5 p-4"
      >
        <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-1">
          Adresse client
        </p>
        <p class="text-sm text-surface-dark/70 whitespace-pre-line">
          {{ clientAddress || "Adresse non renseignée" }}
        </p>
      </div>
      <label v-if="!isBase" class="flex flex-col gap-2 lg:col-start-1">
        <span class="text-sm font-semibold text-surface-dark">Plateforme</span>
        <Select
          :model-value="platform"
          :options="platformOptions"
          option-label="label"
          option-value="value"
          placeholder="Sélectionner une plateforme"
          show-clear
          @update:model-value="handlePlatform"
        />
      </label>
      <label v-if="!isBase" class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark"
          >Plateforme personnalisée</span
        >
        <InputText
          :model-value="customPlatformLabel"
          :disabled="!canEditCustomPlatformLabel"
          placeholder="Ex: Webflow, Framer, maintenance, audit..."
          @update:model-value="handleCustomPlatformLabel"
        />
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">
          {{ isQuote ? "Langue" : "Langue à modifier" }}
        </span>
        <Select
          :model-value="language"
          :options="languageOptions"
          option-label="label"
          option-value="value"
          @update:model-value="handleLanguage"
        />
      </label>
      <label v-if="isQuote" class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">TVA</span>
        <Select
          :model-value="vatRate"
          :options="vatOptions"
          option-label="label"
          option-value="value"
          @update:model-value="handleVatRate"
        />
      </label>
    </div>
    <div
      v-if="isQuote"
      :style="{ order: documentSectionOrder('investment') }"
      class="rounded-3xl border border-surface-dark/5 bg-white p-5 shadow-[0_8px_24px_rgba(33,35,54,0.06)]"
    >
        <div class="mb-3 flex items-center justify-between gap-3">
          <h3 class="font-heading font-bold text-surface-dark">Investissement</h3>
          <div class="flex items-center gap-0.5">
            <Button type="button" text rounded severity="secondary" size="small" :aria-label="isSectionHidden('investment') ? 'Afficher l’investissement' : 'Masquer l’investissement'" :title="isSectionHidden('investment') ? 'Afficher l’investissement' : 'Masquer l’investissement'" @click="toggleSectionHidden('investment')"><template #icon><span class="material-symbols-outlined text-base">{{ isSectionHidden('investment') ? 'visibility_off' : 'visibility' }}</span></template></Button>
            <Button type="button" text rounded severity="secondary" size="small" aria-label="Monter l’investissement" title="Déplacer vers le haut" @click="moveDocumentItem('investment', -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
            <Button type="button" text rounded severity="secondary" size="small" aria-label="Descendre l’investissement" title="Déplacer vers le bas" @click="moveDocumentItem('investment', 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
            <Button type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="sectionMenus.investment?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
            <Menu :ref="(instance) => setSectionMenu('investment', instance)" :model="sectionMenuItems('investment')" popup />
          </div>
        </div>
        <div class="grid grid-cols-1 gap-3">
          <div class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold text-surface-dark"
              >Synthèse</span
            >
            <div
              class="flex items-center justify-between rounded-xl border border-surface-dark/8 bg-surface-light px-3 py-2.5"
            >
              <span class="font-heading text-lg font-bold text-surface-dark">
                {{
                  formatAmount(
                    getAmountBeforeDiscount(subtotal, discountAmount),
                  )
                }}
                €
              </span>
              <span class="text-xs text-surface-dark/45">{{
                investmentAmount > 0
                  ? "prix global de la prestation"
                  : "somme des parties non optionnelles"
              }}</span>
            </div>
          </div>
        </div>
        <div
          class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]"
        >
          <label class="flex flex-col gap-2">
            <span class="text-sm font-semibold text-surface-dark"
              >Résumé du service</span
            >
            <InputText
              :model-value="investmentSummary"
              placeholder="Ex: Conception et développement de la plateforme"
              @update:model-value="handleInvestmentSummary"
            />
          </label>
          <label class="flex flex-col gap-2">
            <span class="text-sm font-semibold text-surface-dark"
              >Prix global HT</span
            >
            <InputNumber
              :model-value="investmentAmount"
              mode="currency"
              currency="EUR"
              locale="fr-FR"
              :min="0"
              input-class="text-right"
              class="w-full"
              @update:model-value="handleInvestmentAmount"
            />
          </label>
        </div>
        <div class="mt-3">
          <QuoteInvestmentLinesEditor
            :model-value="investmentLines || []"
            :investment-amount="investmentAmount"
            :parts="parts"
            :currency-locale="currencyLocale"
            @update:model-value="handleInvestmentLines"
          />
        </div>
        <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          <label class="flex flex-col gap-2">
            <span class="text-sm font-semibold text-surface-dark"
              >Type de réduction</span
            >
            <Select
              :model-value="discountType"
              :options="discountTypeOptions"
              option-label="label"
              option-value="value"
              @update:model-value="handleDiscountType"
            />
          </label>
          <label class="flex flex-col gap-2">
            <span class="text-sm font-semibold text-surface-dark"
              >Réduction</span
            >
            <InputNumber
              :model-value="discountValue"
              :mode="discountType === 'percent' ? 'decimal' : 'currency'"
              :currency="discountType === 'fixed' ? 'EUR' : undefined"
              locale="fr-FR"
              :min-fraction-digits="discountType === 'percent' ? 0 : 2"
              :max-fraction-digits="discountType === 'percent' ? 2 : 2"
              suffix=""
              class="w-full"
              @update:model-value="handleDiscountValue"
            />
          </label>
        </div>
        <div class="mt-3">
          <div class="rounded-2xl bg-surface-light p-4 text-right">
            <p
              class="mb-1 text-left text-xs uppercase tracking-wide text-surface-dark/45"
            >
              Montants
            </p>
            <div class="mt-3 space-y-2">
              <div
                class="flex items-baseline justify-between gap-4 text-sm text-surface-dark/70"
              >
                <span class="text-left">Prix avant réduction</span>
                <span class="text-right">
                  {{
                    formatAmount(
                      getAmountBeforeDiscount(subtotal, discountAmount),
                    )
                  }}
                  €
                </span>
              </div>
              <div
                class="flex items-baseline justify-between gap-4 text-sm text-surface-dark/70"
              >
                <span class="text-left">Réduction</span>
                <span class="text-right">
                  {{
                    discountAmount > 0
                      ? `-${formatAmount(discountAmount)}`
                      : formatAmount(0)
                  }}
                  €
                </span>
              </div>
              <div
                class="flex items-baseline justify-between gap-4 text-sm text-surface-dark/70"
              >
                <span class="text-left">Prix après réduction</span>
                <span class="text-right">{{ formatAmount(subtotal) }} €</span>
              </div>
              <div
                class="flex items-baseline justify-between gap-4 text-sm text-surface-dark/70"
              >
                <span class="text-left">TVA</span>
                <span class="text-right">{{ formatAmount(vatAmount) }} €</span>
              </div>
              <div
                class="mt-1 flex items-baseline justify-between gap-4 text-lg font-heading font-bold text-surface-dark"
              >
                <span class="text-left">TTC</span>
                <span class="text-right"
                  >{{ formatAmount(totalWithVat) }} €</span
                >
              </div>
            </div>
          </div>
        </div>
      </div>

    <div
      v-if="!isBase"
      :style="{ order: documentSectionOrder('proposal') }"
      class="mt-6 rounded-3xl border border-surface-dark/5 bg-white p-5 shadow-[0_8px_24px_rgba(33,35,54,0.06)]"
    >
      <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="font-heading font-bold text-surface-dark">
            Proposition de projet
          </h3>
        </div>
        <div class="flex items-center gap-0.5">
          <Button type="button" text rounded severity="secondary" size="small" :aria-label="isSectionHidden('proposal') ? 'Afficher la proposition' : 'Masquer la proposition'" :title="isSectionHidden('proposal') ? 'Afficher la proposition' : 'Masquer la proposition'" @click="toggleSectionHidden('proposal')"><template #icon><span class="material-symbols-outlined text-base">{{ isSectionHidden('proposal') ? 'visibility_off' : 'visibility' }}</span></template></Button><Button type="button" text rounded severity="secondary" size="small" aria-label="Monter la proposition" title="Déplacer vers le haut" @click="moveDocumentItem('proposal', -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
          <Button type="button" text rounded severity="secondary" size="small" aria-label="Descendre la proposition" title="Déplacer vers le bas" @click="moveDocumentItem('proposal', 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
        </div>
        <Button v-if="!isBase" type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="sectionMenus.proposal?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
        <Menu v-if="!isBase" :ref="(instance) => setSectionMenu('proposal', instance)" :model="sectionMenuItems('proposal')" popup />
      </div>

      <RichTextEditor
        :model-value="projectSummary"
        placeholder="Présente le contexte, les objectifs et le périmètre du projet…"
        @update:model-value="handleProjectSummary"
      />
    </div>

    <div
      v-if="!isBase"
      :style="{ order: documentSectionOrder('scope') }"
      class="mt-6 rounded-3xl border border-surface-dark/5 bg-white p-5 shadow-[0_8px_24px_rgba(33,35,54,0.06)]"
    >
      <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="font-heading font-bold text-surface-dark">
            Portée du projet
          </h3>
        </div>
        <div class="ml-auto flex items-center gap-0.5">
          <Button type="button" text rounded severity="secondary" size="small" :aria-label="isSectionHidden('scope') ? 'Afficher la portée' : 'Masquer la portée'" :title="isSectionHidden('scope') ? 'Afficher la portée' : 'Masquer la portée'" @click="toggleSectionHidden('scope')"><template #icon><span class="material-symbols-outlined text-base">{{ isSectionHidden('scope') ? 'visibility_off' : 'visibility' }}</span></template></Button><Button type="button" text rounded severity="secondary" size="small" aria-label="Monter la portée" title="Déplacer vers le haut" @click="moveDocumentItem('scope', -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
          <Button type="button" text rounded severity="secondary" size="small" aria-label="Descendre la portée" title="Déplacer vers le bas" @click="moveDocumentItem('scope', 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
        </div>
        <Button v-if="!isBase" type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="sectionMenus.scope?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
        <Menu v-if="!isBase" :ref="(instance) => setSectionMenu('scope', instance)" :model="sectionMenuItems('scope')" popup />
      </div>
      <div class="mb-4 flex flex-wrap items-center gap-2 border-t border-surface-dark/6 pt-4">
        <span
          class="text-xs font-medium uppercase tracking-wide text-surface-dark/50"
          title="Fluide : les contenus s’enchaînent. Encadré : chaque élément apparaît sur un fond bleu clair dans le PDF."
        >
          Affichage
        </span>
        <SelectButton
          v-model="scopeDisplayStyle"
          :options="scopeDisplayOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
        />
      </div>
      <QuoteSectionsEditor
        storage-key="devisio:quote-scope:collapsed"
        :model-value="scopeSections"
        @update:model-value="scopeSections = $event"
      />
    </div>

    <div v-if="!isBase" :style="{ order: 999 }" class="flex justify-end">
      <Button type="button" outlined severity="secondary" class="rounded-xl" label="Ajouter une section" @click="addCustomSection">
        <template #icon><span class="material-symbols-outlined">add</span></template>
      </Button>
    </div>
    <article v-for="section in customSections" :key="section.id" :style="{ order: documentSectionOrder(section.id) }" class="mt-6 rounded-3xl border border-surface-dark/6 bg-surface-card p-5 shadow-[0_8px_24px_rgba(33,35,54,0.07)]">
          <div class="flex items-center gap-2">
            <InputText :model-value="section.title" class="min-w-0 flex-1 font-heading font-semibold" placeholder="Titre de la section" @update:model-value="updateCustomSection(section.id, 'title', $event || '')" />
            <Button type="button" text rounded severity="secondary" size="small" :aria-label="isSectionHidden(section.id) ? 'Afficher la section' : 'Masquer la section'" :title="isSectionHidden(section.id) ? 'Afficher la section' : 'Masquer la section'" @click="toggleSectionHidden(section.id)"><template #icon><span class="material-symbols-outlined text-base">{{ isSectionHidden(section.id) ? 'visibility_off' : 'visibility' }}</span></template></Button>
            <Button type="button" class="ml-auto" text rounded severity="secondary" size="small" :disabled="documentSectionOrder(section.id) === 0" aria-label="Monter" title="Déplacer vers le haut" @click="moveDocumentItem(section.id, -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
            <Button type="button" text rounded severity="secondary" size="small" :disabled="documentSectionOrder(section.id) === documentItems.length - 1" aria-label="Descendre" title="Déplacer vers le bas" @click="moveDocumentItem(section.id, 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
            <Button type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="customSectionMenus[section.id]?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
            <Menu :ref="(instance) => setCustomSectionMenu(section.id, instance)" :model="customSectionMenuItems(section.id)" popup />
          </div>
          <div class="mt-4 border-t border-surface-dark/6 pt-4">
            <div class="mb-4 flex flex-wrap items-center gap-2">
              <span class="text-xs font-medium uppercase tracking-wide text-surface-dark/50">Affichage</span>
              <SelectButton
                :model-value="section.displayStyle || 'flow'"
                :options="scopeDisplayOptions"
                option-label="label"
                option-value="value"
                :allow-empty="false"
                @update:model-value="updateCustomSection(section.id, 'displayStyle', $event)"
              />
            </div>
            <QuoteSectionsEditor
              :storage-key="`devisio:quote-custom-section:${section.id}:collapsed`"
              :model-value="section.sections || []"
              @update:model-value="updateCustomSection(section.id, 'sections', $event)"
            />
          </div>
    </article>

    <QuoteAddonsEditor
      v-if="!isBase"
      :style="{ order: documentSectionOrder('addons') }"
      :addons="addons"
      @add-addon="emit('addAddonPreset')"
      @duplicate-addon="emit('duplicateAddon', $event)"
      @update-addon="emit('updateAddon', $event)"
      @remove-addon="emit('removeAddon', $event)"
      @move-addon="emit('moveAddon', $event)"
      @add-addon-item="emit('addAddonItem', $event)"
      @update-addon-item="emit('updateAddonItem', $event)"
      @remove-addon-item="emit('removeAddonItem', $event)"
      @move-addon-item="emit('moveAddonItem', $event)"
      @nest-addon-item-under-item="emit('nestAddonItemUnderItem', $event)"
      @add-addon-sub-item="emit('addAddonSubItem', $event)"
      @update-addon-sub-item="emit('updateAddonSubItem', $event)"
      @remove-addon-sub-item="emit('removeAddonSubItem', $event)"
      @move-addon-sub-item="emit('moveAddonSubItem', $event)"
      @move-addon-sub-item-to-item="emit('moveAddonSubItemToItem', $event)"
      @promote-addon-sub-item-to-item="
        emit('promoteAddonSubItemToItem', $event)
      "
    >
      <template #headerActions>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Monter les options" title="Déplacer vers le haut" @click="moveDocumentItem('addons', -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Descendre les options" title="Déplacer vers le bas" @click="moveDocumentItem('addons', 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
        <Button v-if="!isBase" type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="sectionMenus.addons?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
        <Menu v-if="!isBase" :ref="(instance) => setSectionMenu('addons', instance)" :model="sectionMenuItems('addons')" popup />
      </template>
    </QuoteAddonsEditor>

    <QuotePaymentScheduleEditor
      v-if="!isTemplate"
      :style="{ order: documentSectionOrder('paymentSchedule') }"
      class="mt-6"
      :model-value="paymentSchedule"
      :subtotal="subtotal"
      :total-with-vat="totalWithVat"
      :currency-locale="currencyLocale"
      @update:model-value="emit('update:paymentSchedule', $event)"
    >
      <template #headerActions>
        <Button type="button" text rounded severity="secondary" size="small" :aria-label="isSectionHidden('paymentSchedule') ? 'Afficher l’échéancier' : 'Masquer l’échéancier'" :title="isSectionHidden('paymentSchedule') ? 'Afficher l’échéancier' : 'Masquer l’échéancier'" @click="toggleSectionHidden('paymentSchedule')"><template #icon><span class="material-symbols-outlined text-base">{{ isSectionHidden('paymentSchedule') ? 'visibility_off' : 'visibility' }}</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Monter l’échéancier" title="Déplacer vers le haut" @click="moveDocumentItem('paymentSchedule', -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Descendre l’échéancier" title="Déplacer vers le bas" @click="moveDocumentItem('paymentSchedule', 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="sectionMenus.paymentSchedule?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
        <Menu :ref="(instance) => setSectionMenu('paymentSchedule', instance)" :model="sectionMenuItems('paymentSchedule')" popup />
      </template>
    </QuotePaymentScheduleEditor>

    <QuoteConditionsEditor
      v-if="!isBase"
      :style="{ order: documentSectionOrder('roadmap') }"
      :conditions="roadmap"
      section-title="Feuille de route & calendrier estimé"
      add-button-label="Ajouter une phase"
      empty-label="Aucune phase pour l’instant."
      item-empty-label="Aucun point pour cette phase."
      item-placeholder="Texte du point de la feuille de route"
      title-placeholder="Nouvelle phase"
      lock-last-condition-title
      :locked-last-condition-title="getEstimatedTimelineTitle(language)"
      @add-condition="emit('addRoadmapPhase')"
      @move-condition="emit('moveRoadmapPhase', $event)"
      @remove-condition="emit('removeRoadmapPhase', $event)"
      @update-condition-title="
        emit('updateRoadmapPhase', {
          id: $event.id,
          field: 'title',
          value: $event.value,
        })
      "
      @add-condition-item="emit('addRoadmapItem', $event)"
      @update-condition-item="emit('updateRoadmapItem', $event)"
      @remove-condition-item="emit('removeRoadmapItem', $event)"
      @move-condition-item="emit('moveRoadmapItem', $event)"
      @nest-condition-item-under-item="emit('nestRoadmapItemUnderItem', $event)"
      @add-condition-sub-item="emit('addRoadmapSubItem', $event)"
      @update-condition-sub-item="emit('updateRoadmapSubItem', $event)"
      @remove-condition-sub-item="emit('removeRoadmapSubItem', $event)"
      @move-condition-sub-item="emit('moveRoadmapSubItem', $event)"
      @move-condition-sub-item-to-item="
        emit('moveRoadmapSubItemToItem', $event)
      "
      @promote-condition-sub-item-to-item="
        emit('promoteRoadmapSubItemToItem', $event)
      "
    >
      <template #headerActions>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Monter la feuille de route" title="Déplacer vers le haut" @click="moveDocumentItem('roadmap', -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Descendre la feuille de route" title="Déplacer vers le bas" @click="moveDocumentItem('roadmap', 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
        <Button v-if="!isBase" type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="sectionMenus.roadmap?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
        <Menu v-if="!isBase" :ref="(instance) => setSectionMenu('roadmap', instance)" :model="sectionMenuItems('roadmap')" popup />
      </template>
    </QuoteConditionsEditor>

    <QuoteConditionsEditor
      :style="{ order: documentSectionOrder('conditions') }"
      :conditions="conditions"
      :section-title="
        isBase
          ? 'Conditions communes'
          : isTemplate
            ? 'Conditions du template'
            : 'Conditions'
      "
      :add-button-label="
        isBase ? 'Ajouter une condition commune' : 'Ajouter une condition'
      "
      :empty-label="
        isBase
          ? 'Aucune condition commune pour l’instant.'
          : 'Aucune condition pour l’instant.'
      "
      :reusable-conditions="isTemplate ? reusableConditions || [] : []"
      reusable-conditions-label="Ajouter une condition commune"
      :condition-badges="conditionBadges"
      :locked-condition-ids="lockedCommonConditionIds"
      @add-condition="emit('addCondition')"
      @add-reusable-condition="emit('addReusableCondition', $event)"
      @remove-condition="emit('removeCondition', $event)"
      @update-condition-title="
        emit('updateCondition', {
          id: $event.id,
          field: 'title',
          value: $event.value,
        })
      "
      @add-condition-item="emit('addConditionItem', $event)"
      @update-condition-item="emit('updateConditionItem', $event)"
      @remove-condition-item="emit('removeConditionItem', $event)"
      @move-condition-item="emit('moveConditionItem', $event)"
      @nest-condition-item-under-item="
        emit('nestConditionItemUnderItem', $event)
      "
      @add-condition-sub-item="emit('addConditionSubItem', $event)"
      @update-condition-sub-item="emit('updateConditionSubItem', $event)"
      @remove-condition-sub-item="emit('removeConditionSubItem', $event)"
      @move-condition-sub-item="emit('moveConditionSubItem', $event)"
      @move-condition-sub-item-to-item="
        emit('moveConditionSubItemToItem', $event)
      "
      @promote-condition-sub-item-to-item="
        emit('promoteConditionSubItemToItem', $event)
      "
    >
      <template #headerActions>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Monter les conditions" title="Déplacer vers le haut" @click="moveDocumentItem('conditions', -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Descendre les conditions" title="Déplacer vers le bas" @click="moveDocumentItem('conditions', 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
        <Button v-if="!isBase" type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="sectionMenus.conditions?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
        <Menu v-if="!isBase" :ref="(instance) => setSectionMenu('conditions', instance)" :model="sectionMenuItems('conditions')" popup />
      </template>
    </QuoteConditionsEditor>

    <QuoteConditionsEditor
      v-if="!isTemplate"
      :style="{ order: documentSectionOrder('acceptance') }"
      :conditions="acceptance"
      section-title="Acceptation de la proposition"
      add-button-label="Ajouter un élément"
      empty-label="Aucun élément d’acceptation pour l’instant."
      item-empty-label="Aucun point pour cet élément."
      item-placeholder="Texte du point d’acceptation"
      title-placeholder="Nouvel élément"
      @add-condition="emit('addAcceptance')"
      @move-condition="emit('moveAcceptance', $event)"
      @remove-condition="emit('removeAcceptance', $event)"
      @update-condition-title="
        emit('updateAcceptance', {
          id: $event.id,
          field: 'title',
          value: $event.value,
        })
      "
      @add-condition-item="emit('addAcceptanceItem', $event)"
      @update-condition-item="emit('updateAcceptanceItem', $event)"
      @remove-condition-item="emit('removeAcceptanceItem', $event)"
      @move-condition-item="emit('moveAcceptanceItem', $event)"
      @nest-condition-item-under-item="
        emit('nestAcceptanceItemUnderItem', $event)
      "
      @add-condition-sub-item="emit('addAcceptanceSubItem', $event)"
      @update-condition-sub-item="emit('updateAcceptanceSubItem', $event)"
      @remove-condition-sub-item="emit('removeAcceptanceSubItem', $event)"
      @move-condition-sub-item="emit('moveAcceptanceSubItem', $event)"
      @move-condition-sub-item-to-item="
        emit('moveAcceptanceSubItemToItem', $event)
      "
      @promote-condition-sub-item-to-item="
        emit('promoteAcceptanceSubItemToItem', $event)
      "
    >
      <template #headerActions>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Monter l’acceptation" title="Déplacer vers le haut" @click="moveDocumentItem('acceptance', -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Descendre l’acceptation" title="Déplacer vers le bas" @click="moveDocumentItem('acceptance', 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="sectionMenus.acceptance?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
        <Menu :ref="(instance) => setSectionMenu('acceptance', instance)" :model="sectionMenuItems('acceptance')" popup />
      </template>
    </QuoteConditionsEditor>

    <QuoteConditionsEditor
      v-if="!isTemplate"
      :style="{ order: documentSectionOrder('principles') }"
      :conditions="principles"
      section-title="Nos principes"
      add-button-label="Ajouter un principe"
      empty-label="Aucun principe pour l’instant."
      item-empty-label="Aucun point pour ce principe."
      item-placeholder="Texte du principe"
      title-placeholder="Nouveau principe"
      :show-tag-input="mode === 'base'"
      tag-placeholder="Tag / hashtag optionnel"
      @add-condition="emit('addPrinciple')"
      @move-condition="emit('movePrinciple', $event)"
      @remove-condition="emit('removePrinciple', $event)"
      @update-condition-title="
        emit('updatePrinciple', {
          id: $event.id,
          field: 'title',
          value: $event.value,
        })
      "
      @update-condition-tag="
        emit('updatePrinciple', {
          id: $event.id,
          field: 'tag',
          value: $event.value,
        })
      "
      @add-condition-item="emit('addPrincipleItem', $event)"
      @update-condition-item="emit('updatePrincipleItem', $event)"
      @remove-condition-item="emit('removePrincipleItem', $event)"
      @move-condition-item="emit('movePrincipleItem', $event)"
      @nest-condition-item-under-item="
        emit('nestPrincipleItemUnderItem', $event)
      "
      @add-condition-sub-item="emit('addPrincipleSubItem', $event)"
      @update-condition-sub-item="emit('updatePrincipleSubItem', $event)"
      @remove-condition-sub-item="emit('removePrincipleSubItem', $event)"
      @move-condition-sub-item="emit('movePrincipleSubItem', $event)"
      @move-condition-sub-item-to-item="
        emit('movePrincipleSubItemToItem', $event)
      "
      @promote-condition-sub-item-to-item="
        emit('promotePrincipleSubItemToItem', $event)
      "
    >
      <template #headerActions>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Monter les principes" title="Déplacer vers le haut" @click="moveDocumentItem('principles', -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Descendre les principes" title="Déplacer vers le bas" @click="moveDocumentItem('principles', 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="sectionMenus.principles?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
        <Menu :ref="(instance) => setSectionMenu('principles', instance)" :model="sectionMenuItems('principles')" popup />
      </template>
    </QuoteConditionsEditor>

    <div class="flex justify-end mt-6"></div>
  </section>
</template>
