<script setup lang="ts">
import type {
  Client,
  QuoteAddon,
  QuoteBlock,
  QuoteCondition,
  QuoteCustomSection,
  QuoteDiscountType,
  QuoteInvestmentLine,
  QuoteLanguage,
  QuotePart,
  QuotePartDisplayStyle,
  QuotePaymentScheduleDisplay,
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
import QuoteDisplayStyleToggle from "@/components/quotes/QuoteDisplayStyleToggle.vue";
import QuoteInvestmentLinesEditor from "@/components/quotes/QuoteInvestmentLinesEditor.vue";
import QuotePaymentScheduleEditor from "@/components/quotes/QuotePaymentScheduleEditor.vue";
import QuoteSectionsEditor from "@/components/quotes/QuoteSectionsEditor.vue";
import RichTextEditor from "@/components/quotes/RichTextEditor.vue";
import { getCountryFlag, getCountryLabel } from "@/lib/countries";
import {
  discountTypeOptions,
  getEstimatedTimelineTitle,
  languageOptions,
  quoteStatusMeta,
  quoteStatusOptions,
  vatOptions,
} from "@/lib/clientPresets";
import { computed, ref } from "vue";
import { createEmptyQuotePart, createEmptyQuoteSection, createEntityId } from "@/utils/quote";

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
  validUntil: Date | null;
  clientId: string;
  clientName: string;
  clientAddress: string;
  clientWebsite: string;
  clientCountry: string;
  clientVatLabel: string;
  customPlatformLabel: string;
  language: QuoteLanguage;
  vatRate: VatRate;
  discountType: QuoteDiscountType;
  discountValue: number;
  discountLabel: string;
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
  deliverables?: QuoteSection[];
  deliverablesDisplayStyle?: QuotePartDisplayStyle;
  roadmapDisplayStyle?: QuotePartDisplayStyle;
  documentOrder?: string[];
  hiddenSections?: string[];
  paymentSchedule: QuotePaymentScheduleStep[];
  paymentScheduleDisplay?: QuotePaymentScheduleDisplay;
  paymentScheduleText?: string;
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
  "update:validUntil": [value: Date | null];
  "update:clientId": [value: string];
  "update:customPlatformLabel": [value: string];
  "update:language": [value: QuoteLanguage];
  "update:vatRate": [value: VatRate];
  "update:discountType": [value: QuoteDiscountType];
  "update:discountValue": [value: number];
  "update:discountLabel": [value: string];
  "update:projectSummary": [value: string];
  "update:investmentSummary": [value: string];
  "update:investmentAmount": [value: number];
  "update:investmentLines": [value: QuoteInvestmentLine[]];
  reapplyTemplateSection: [
    section: "projectSummary" | "parts" | "deliverables" | "conditions" | "roadmap" | "addons",
  ];
  "update:parts": [value: QuotePart[]];
  "update:customSections": [value: QuoteCustomSection[]];
  "update:deliverables": [value: QuoteSection[]];
  "update:deliverablesDisplayStyle": [value: QuotePartDisplayStyle];
  "update:roadmapDisplayStyle": [value: QuotePartDisplayStyle];
  "update:documentOrder": [value: string[]];
  "update:hiddenSections": [value: string[]];
  "update:paymentSchedule": [value: QuotePaymentScheduleStep[]];
  "update:paymentScheduleDisplay": [value: QuotePaymentScheduleDisplay];
  "update:paymentScheduleText": [value: string];
  "update:status": [value: QuoteStatus];
  newVersion: [];
  createClient: [];
  openClient: [];
  addCondition: [];
  addReusableCondition: [conditionId: string];
  updateCondition: [
    payload: { id: string; field: "title"; value: string },
  ];
  removeCondition: [id: string];
  updateConditionBlocks: [payload: { conditionId: string; blocks: QuoteBlock[] }];
  addRoadmapPhase: [];
  moveRoadmapPhase: [payload: { draggedId: string; targetId: string }];
  updateRoadmapPhase: [
    payload: { id: string; field: "title"; value: string },
  ];
  removeRoadmapPhase: [id: string];
  updateRoadmapBlocks: [payload: { conditionId: string; blocks: QuoteBlock[] }];
  addAcceptance: [];
  moveAcceptance: [payload: { draggedId: string; targetId: string }];
  updateAcceptance: [
    payload: { id: string; field: "title"; value: string },
  ];
  removeAcceptance: [id: string];
  updateAcceptanceBlocks: [payload: { conditionId: string; blocks: QuoteBlock[] }];
  addPrinciple: [];
  movePrinciple: [payload: { draggedId: string; targetId: string }];
  updatePrinciple: [
    payload: { id: string; field: "title" | "tag"; value: string },
  ];
  removePrinciple: [id: string];
  updatePrincipleBlocks: [payload: { conditionId: string; blocks: QuoteBlock[] }];
  addAddonPreset: [];
  updateAddon: [
    payload: {
      id: string;
      field: "title" | "price" | "unitLabel";
      value: string | number;
    },
  ];
  removeAddon: [id: string];
  moveAddon: [payload: { draggedId: string; targetId: string }];
  updateAddonBlocks: [payload: { addonId: string; blocks: QuoteBlock[] }];
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
    { id: "deliverables", label: "Livrables", fixed: true },
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
    sections: [createEmptyQuoteSection()],
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
const sectionBentoStateClass = (id: string) =>
  isQuote.value && isSectionHidden(id)
    ? "transition-[opacity,background-color,border-color,filter] duration-200 !border-surface-dark/10 !bg-surface-ground/80 opacity-[0.55] grayscale-[.2]"
    : "transition-[opacity,background-color,border-color,filter] duration-200";
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
  ...(id === "deliverables" && props.canReapplyTemplate ? [{ label: "↻  Réappliquer les livrables", command: () => emit("reapplyTemplateSection", "deliverables") }] : []),
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
const statusLocked = computed(() =>
  props.status ? quoteStatusMeta[props.status].locked : false,
);
const conditionBadges = computed(() =>
  isTemplate.value
    ? Object.fromEntries(
        props.conditions.map((condition) => [
          condition.id,
          condition.commonConditionId ? "Commune" : "Personnalisée",
        ]),
      )
    : {},
);

const handleTitle = (value: string | undefined) =>
  emit("update:title", value || "");
const handleProjectName = (value: string | undefined) =>
  emit("update:projectName", value || "");
const handleQuoteDate = (
  value: Date | (Date | null)[] | Date[] | null | undefined,
) => emit("update:quoteDate", value instanceof Date ? value : null);
const handleValidUntil = (
  value: Date | (Date | null)[] | Date[] | null | undefined,
) => emit("update:validUntil", value instanceof Date ? value : null);
const handleClientId = (value: string | null | undefined) =>
  emit("update:clientId", value || "");
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
</script>

<template>
  <section class="flex flex-col gap-6">
    <div
      v-if="isQuote"
      class="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-surface-dark/5 bg-surface-card p-5 shadow-[0_8px_24px_rgba(33,35,54,0.06)]"
    >
      <div
        class="flex h-[48px] items-center gap-3 rounded-2xl bg-white border border-surface-dark/5 px-4"
      >
        <div>
          <p class="font-heading font-bold text-surface-dark">{{ quoteRef }}</p>
        </div>
        <span
          v-if="(version || 1) > 1"
          class="self-start rounded-full bg-surface-dark/8 px-2 py-0.5 text-xs font-bold text-surface-dark/70"
          >v{{ version }}</span
        >
      </div>

      <div class="flex items-center gap-2">
        <div>
          <Select
            :model-value="status"
            :options="quoteStatusOptions"
            option-label="label"
            option-value="value"
            class="min-w-[11rem] [&_.p-select-label]:!py-[11px]"
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
          class="!h-[48px] !rounded-xl"
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

    <div :style="{ order: documentSectionOrder('quoteInfo') }"  data-section-id="quoteInfo" class="grid grid-cols-1 gap-4 rounded-3xl border border-surface-dark/5 bg-white p-5 shadow-[0_8px_24px_rgba(33,35,54,0.06)] lg:grid-cols-2">
      <div class="flex items-center justify-between gap-3 lg:col-span-2">
        <h3 class="font-heading font-bold text-surface-dark">
          {{ isQuote ? "Informations du devis" : "Informations du template" }}
        </h3>
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
        <DatePicker
          :model-value="validUntil"
          date-format="dd/mm/yy"
          show-icon
          icon-display="input"
          class="w-full"
          @update:model-value="handleValidUntil"
        />
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
      <button
        v-if="isQuote"
        type="button"
        :disabled="!clientId"
        class="group rounded-2xl bg-white border border-surface-dark/5 p-4 text-left transition lg:col-span-2 enabled:hover:border-primary/25 enabled:hover:shadow-sm disabled:cursor-default"
        @click="emit('openClient')"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-1">
              Client sélectionné
            </p>
            <p class="font-heading font-bold text-surface-dark transition-colors group-enabled:group-hover:text-primary">
              {{ clientName || "Aucun client" }}
            </p>
          </div>
          <span v-if="clientId" class="material-symbols-outlined text-lg text-surface-dark/30 transition group-hover:translate-x-0.5 group-hover:text-primary">arrow_forward</span>
        </div>
        <p class="text-sm text-surface-dark/60 mt-1">
          {{ clientWebsite || "Site non renseigné" }}
        </p>
      </button>
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
      <label v-if="!isBase" class="flex flex-col gap-2 lg:col-span-2">
        <span class="text-sm font-semibold text-surface-dark">Technologies</span>
        <InputText
          :model-value="customPlatformLabel"
          placeholder="Ex: Vue.js, TypeScript, Shopify, Sanity CMS..."
          @update:model-value="handleCustomPlatformLabel"
        />
      </label>
      <label v-if="isQuote" class="flex flex-col gap-2">
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
      :style="{ order: documentSectionOrder('investment') }"  data-section-id="investment"
      class="rounded-3xl border border-surface-dark/5 bg-white p-5 shadow-[0_8px_24px_rgba(33,35,54,0.06)]"
      :class="sectionBentoStateClass('investment')"
    >
        <div class="mb-4 flex items-center justify-between gap-3">
          <h3 class="font-heading font-bold text-surface-dark">Investissement</h3>
          <div class="flex items-center gap-0.5">
            <Button type="button" text rounded severity="secondary" size="small" :aria-label="isSectionHidden('investment') ? 'Afficher l’investissement' : 'Masquer l’investissement'" :title="isSectionHidden('investment') ? 'Afficher l’investissement' : 'Masquer l’investissement'" @click="toggleSectionHidden('investment')"><template #icon><span class="material-symbols-outlined text-base">{{ isSectionHidden('investment') ? 'visibility_off' : 'visibility' }}</span></template></Button>
            <Button type="button" text rounded severity="secondary" size="small" aria-label="Monter l’investissement" title="Déplacer vers le haut" @click="moveDocumentItem('investment', -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
            <Button type="button" text rounded severity="secondary" size="small" aria-label="Descendre l’investissement" title="Déplacer vers le bas" @click="moveDocumentItem('investment', 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
            <Button type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="sectionMenus.investment?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
            <Menu :ref="(instance) => setSectionMenu('investment', instance)" :model="sectionMenuItems('investment')" popup />
          </div>
        </div>
        <div
          class="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px]"
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
              >Prix HT</span
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
        <div class="mt-4">
          <QuoteInvestmentLinesEditor
            :model-value="investmentLines || []"
            :investment-amount="investmentAmount"
            :currency-locale="currencyLocale"
            @update:model-value="handleInvestmentLines"
          />
        </div>
        <div class="mt-4 grid grid-cols-1 gap-3 border-t border-surface-dark/6 pt-4 md:grid-cols-2">
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
          <label class="flex flex-col gap-2 md:col-span-2">
            <span class="text-sm font-semibold text-surface-dark"
              >Titre de la réduction</span
            >
            <InputText
              :model-value="discountLabel"
              placeholder="Remise"
              class="w-full"
              @update:model-value="
                emit('update:discountLabel', String($event ?? ''))
              "
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
      </div>

    <div
      v-if="!isBase"
      :style="{ order: documentSectionOrder('proposal') }"  data-section-id="proposal"
      class="rounded-3xl border border-surface-dark/5 bg-white p-5 shadow-[0_8px_24px_rgba(33,35,54,0.06)]"
      :class="sectionBentoStateClass('proposal')"
    >
      <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="font-heading font-bold text-surface-dark">
            Proposition de projet
          </h3>
        </div>
        <div class="flex items-center gap-0.5">
          <Button type="button" text rounded severity="secondary" size="small" :aria-label="isSectionHidden('proposal') ? 'Afficher la proposition' : 'Masquer la proposition'" :title="isSectionHidden('proposal') ? 'Afficher la proposition' : 'Masquer la proposition'" @click="toggleSectionHidden('proposal')"><template #icon><span class="material-symbols-outlined text-base">{{ isSectionHidden('proposal') ? 'visibility_off' : 'visibility' }}</span></template></Button>
          <Button type="button" text rounded severity="secondary" size="small" aria-label="Monter la proposition" title="Déplacer vers le haut" @click="moveDocumentItem('proposal', -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
          <Button type="button" text rounded severity="secondary" size="small" aria-label="Descendre la proposition" title="Déplacer vers le bas" @click="moveDocumentItem('proposal', 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
          <Button v-if="!isBase" type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="sectionMenus.proposal?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
          <Menu v-if="!isBase" :ref="(instance) => setSectionMenu('proposal', instance)" :model="sectionMenuItems('proposal')" popup />
        </div>
      </div>

      <RichTextEditor
        :model-value="projectSummary"
        placeholder="Présente le contexte, les objectifs et le périmètre du projet…"
        @update:model-value="handleProjectSummary"
      />
    </div>

    <div
      v-if="!isBase"
      :style="{ order: documentSectionOrder('scope') }"  data-section-id="scope"
      class="rounded-3xl border border-surface-dark/5 bg-white p-5 shadow-[0_8px_24px_rgba(33,35,54,0.06)]"
      :class="sectionBentoStateClass('scope')"
    >
      <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="font-heading font-bold text-surface-dark">
            Portée du projet
          </h3>
        </div>
        <div class="ml-auto flex items-center gap-0.5">
          <QuoteDisplayStyleToggle v-model="scopeDisplayStyle" />
          <Button type="button" text rounded severity="secondary" size="small" :aria-label="isSectionHidden('scope') ? 'Afficher la portée' : 'Masquer la portée'" :title="isSectionHidden('scope') ? 'Afficher la portée' : 'Masquer la portée'" @click="toggleSectionHidden('scope')"><template #icon><span class="material-symbols-outlined text-base">{{ isSectionHidden('scope') ? 'visibility_off' : 'visibility' }}</span></template></Button><Button type="button" text rounded severity="secondary" size="small" aria-label="Monter la portée" title="Déplacer vers le haut" @click="moveDocumentItem('scope', -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
          <Button type="button" text rounded severity="secondary" size="small" aria-label="Descendre la portée" title="Déplacer vers le bas" @click="moveDocumentItem('scope', 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
        </div>
        <Button v-if="!isBase" type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="sectionMenus.scope?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
        <Menu v-if="!isBase" :ref="(instance) => setSectionMenu('scope', instance)" :model="sectionMenuItems('scope')" popup />
      </div>
      <QuoteSectionsEditor
        storage-key="devisio:quote-scope:collapsed"
        :model-value="scopeSections"
        @update:model-value="scopeSections = $event"
      />
    </div>

    <div
      v-if="!isBase"
      :style="{ order: documentSectionOrder('deliverables') }"  data-section-id="deliverables"
      class="rounded-3xl border border-surface-dark/5 bg-white p-5 shadow-[0_8px_24px_rgba(33,35,54,0.06)]"
      :class="sectionBentoStateClass('deliverables')"
    >
      <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="font-heading font-bold text-surface-dark">Livrables</h3>
        </div>
        <div class="ml-auto flex items-center gap-0.5">
          <QuoteDisplayStyleToggle
            :model-value="deliverablesDisplayStyle || 'flow'"
            @update:model-value="emit('update:deliverablesDisplayStyle', $event)"
          />
          <Button type="button" text rounded severity="secondary" size="small" :aria-label="isSectionHidden('deliverables') ? 'Afficher les livrables' : 'Masquer les livrables'" :title="isSectionHidden('deliverables') ? 'Afficher les livrables' : 'Masquer les livrables'" @click="toggleSectionHidden('deliverables')"><template #icon><span class="material-symbols-outlined text-base">{{ isSectionHidden('deliverables') ? 'visibility_off' : 'visibility' }}</span></template></Button>
          <Button type="button" text rounded severity="secondary" size="small" aria-label="Monter les livrables" title="Déplacer vers le haut" @click="moveDocumentItem('deliverables', -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
          <Button type="button" text rounded severity="secondary" size="small" aria-label="Descendre les livrables" title="Déplacer vers le bas" @click="moveDocumentItem('deliverables', 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
        </div>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="sectionMenus.deliverables?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
        <Menu :ref="(instance) => setSectionMenu('deliverables', instance)" :model="sectionMenuItems('deliverables')" popup />
      </div>
      <QuoteSectionsEditor
        storage-key="devisio:quote-deliverables:collapsed"
        :model-value="props.deliverables || []"
        @update:model-value="emit('update:deliverables', $event)"
      />
    </div>

    <div v-if="!isBase" :style="{ order: 999 }" class="flex justify-end">
      <Button type="button" outlined severity="secondary" class="rounded-xl" label="Ajouter une section" @click="addCustomSection">
        <template #icon><span class="material-symbols-outlined">add</span></template>
      </Button>
    </div>
    <article v-for="section in customSections" :key="section.id" :style="{ order: documentSectionOrder(section.id) }" :data-section-id="section.id" class="rounded-3xl border border-surface-dark/6 bg-surface-card p-5 shadow-[0_8px_24px_rgba(33,35,54,0.07)]" :class="sectionBentoStateClass(section.id)">
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
      :style="{ order: documentSectionOrder('addons') }"  data-section-id="addons"
      :class="sectionBentoStateClass('addons')"
      :addons="addons"
      @add-addon="emit('addAddonPreset')"
      @duplicate-addon="emit('duplicateAddon', $event)"
      @update-addon="emit('updateAddon', $event)"
      @remove-addon="emit('removeAddon', $event)"
      @move-addon="emit('moveAddon', $event)"
      @update-addon-blocks="emit('updateAddonBlocks', $event)"
    >
      <template #headerActions>
        <Button v-if="isQuote" type="button" text rounded severity="secondary" size="small" :aria-label="isSectionHidden('addons') ? 'Afficher les options complémentaires' : 'Masquer les options complémentaires'" :title="isSectionHidden('addons') ? 'Afficher les options complémentaires' : 'Masquer les options complémentaires'" @click="toggleSectionHidden('addons')"><template #icon><span class="material-symbols-outlined text-base">{{ isSectionHidden('addons') ? 'visibility_off' : 'visibility' }}</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Monter les options" title="Déplacer vers le haut" @click="moveDocumentItem('addons', -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Descendre les options" title="Déplacer vers le bas" @click="moveDocumentItem('addons', 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
        <Button v-if="!isBase" type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="sectionMenus.addons?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
        <Menu v-if="!isBase" :ref="(instance) => setSectionMenu('addons', instance)" :model="sectionMenuItems('addons')" popup />
      </template>
    </QuoteAddonsEditor>

    <QuotePaymentScheduleEditor
      v-if="!isTemplate"
      :style="{ order: documentSectionOrder('paymentSchedule') }"  data-section-id="paymentSchedule"
      :class="sectionBentoStateClass('paymentSchedule')"
      :model-value="paymentSchedule"
      :display-mode="paymentScheduleDisplay || 'table'"
      :text="paymentScheduleText || ''"
      :subtotal="subtotal"
      :total-with-vat="totalWithVat"
      :currency-locale="currencyLocale"
      @update:model-value="emit('update:paymentSchedule', $event)"
      @update:display-mode="emit('update:paymentScheduleDisplay', $event)"
      @update:text="emit('update:paymentScheduleText', $event)"
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
      :style="{ order: documentSectionOrder('roadmap') }"  data-section-id="roadmap"
      :class="sectionBentoStateClass('roadmap')"
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
      @update-condition-blocks="emit('updateRoadmapBlocks', $event)"
    >
      <template #headerActions>
        <QuoteDisplayStyleToggle
          :model-value="roadmapDisplayStyle || 'flow'"
          @update:model-value="emit('update:roadmapDisplayStyle', $event)"
        />
        <Button v-if="isQuote" type="button" text rounded severity="secondary" size="small" :aria-label="isSectionHidden('roadmap') ? 'Afficher la feuille de route' : 'Masquer la feuille de route'" :title="isSectionHidden('roadmap') ? 'Afficher la feuille de route' : 'Masquer la feuille de route'" @click="toggleSectionHidden('roadmap')"><template #icon><span class="material-symbols-outlined text-base">{{ isSectionHidden('roadmap') ? 'visibility_off' : 'visibility' }}</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Monter la feuille de route" title="Déplacer vers le haut" @click="moveDocumentItem('roadmap', -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Descendre la feuille de route" title="Déplacer vers le bas" @click="moveDocumentItem('roadmap', 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
        <Button v-if="!isBase" type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="sectionMenus.roadmap?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
        <Menu v-if="!isBase" :ref="(instance) => setSectionMenu('roadmap', instance)" :model="sectionMenuItems('roadmap')" popup />
      </template>
    </QuoteConditionsEditor>

    <QuoteConditionsEditor
      :style="{ order: documentSectionOrder('conditions') }"  data-section-id="conditions"
      :class="sectionBentoStateClass('conditions')"
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
      @update-condition-blocks="emit('updateConditionBlocks', $event)"
    >
      <template #headerActions>
        <Button v-if="isQuote" type="button" text rounded severity="secondary" size="small" :aria-label="isSectionHidden('conditions') ? 'Afficher les conditions' : 'Masquer les conditions'" :title="isSectionHidden('conditions') ? 'Afficher les conditions' : 'Masquer les conditions'" @click="toggleSectionHidden('conditions')"><template #icon><span class="material-symbols-outlined text-base">{{ isSectionHidden('conditions') ? 'visibility_off' : 'visibility' }}</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Monter les conditions" title="Déplacer vers le haut" @click="moveDocumentItem('conditions', -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Descendre les conditions" title="Déplacer vers le bas" @click="moveDocumentItem('conditions', 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
        <Button v-if="!isBase" type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="sectionMenus.conditions?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
        <Menu v-if="!isBase" :ref="(instance) => setSectionMenu('conditions', instance)" :model="sectionMenuItems('conditions')" popup />
      </template>
    </QuoteConditionsEditor>

    <QuoteConditionsEditor
      v-if="!isTemplate"
      :style="{ order: documentSectionOrder('acceptance') }"  data-section-id="acceptance"
      :class="sectionBentoStateClass('acceptance')"
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
      @update-condition-blocks="emit('updateAcceptanceBlocks', $event)"
    >
      <template #headerActions>
        <Button v-if="isQuote" type="button" text rounded severity="secondary" size="small" :aria-label="isSectionHidden('acceptance') ? 'Afficher l’acceptation' : 'Masquer l’acceptation'" :title="isSectionHidden('acceptance') ? 'Afficher l’acceptation' : 'Masquer l’acceptation'" @click="toggleSectionHidden('acceptance')"><template #icon><span class="material-symbols-outlined text-base">{{ isSectionHidden('acceptance') ? 'visibility_off' : 'visibility' }}</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Monter l’acceptation" title="Déplacer vers le haut" @click="moveDocumentItem('acceptance', -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Descendre l’acceptation" title="Déplacer vers le bas" @click="moveDocumentItem('acceptance', 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="sectionMenus.acceptance?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
        <Menu :ref="(instance) => setSectionMenu('acceptance', instance)" :model="sectionMenuItems('acceptance')" popup />
      </template>
    </QuoteConditionsEditor>

    <QuoteConditionsEditor
      v-if="!isTemplate"
      :style="{ order: documentSectionOrder('principles') }"  data-section-id="principles"
      :class="sectionBentoStateClass('principles')"
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
      @update-condition-blocks="emit('updatePrincipleBlocks', $event)"
    >
      <template #headerActions>
        <Button v-if="isQuote" type="button" text rounded severity="secondary" size="small" :aria-label="isSectionHidden('principles') ? 'Afficher les principes' : 'Masquer les principes'" :title="isSectionHidden('principles') ? 'Afficher les principes' : 'Masquer les principes'" @click="toggleSectionHidden('principles')"><template #icon><span class="material-symbols-outlined text-base">{{ isSectionHidden('principles') ? 'visibility_off' : 'visibility' }}</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Monter les principes" title="Déplacer vers le haut" @click="moveDocumentItem('principles', -1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_up</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Descendre les principes" title="Déplacer vers le bas" @click="moveDocumentItem('principles', 1)"><template #icon><span class="material-symbols-outlined text-base">keyboard_arrow_down</span></template></Button>
        <Button type="button" text rounded severity="secondary" size="small" aria-label="Autres options" title="Autres options" @click="sectionMenus.principles?.toggle($event)"><template #icon><span class="material-symbols-outlined text-base">more_vert</span></template></Button>
        <Menu :ref="(instance) => setSectionMenu('principles', instance)" :model="sectionMenuItems('principles')" popup />
      </template>
    </QuoteConditionsEditor>

  </section>
</template>
