<script setup lang="ts">
import type {
  Client,
  ClientPlatform,
  QuoteAddon,
  QuoteCondition,
  QuoteDiscountType,
  QuoteLanguage,
  QuotePart,
  QuoteStatus,
  VatRate,
} from "@client-tracker/contracts";
import Button from "primevue/button";
import DatePicker from "primevue/datepicker";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import Select from "primevue/select";
import Textarea from "primevue/textarea";
import QuoteAddonsEditor from "@/components/quotes/QuoteAddonsEditor.vue";
import QuoteConditionsEditor from "@/components/quotes/QuoteConditionsEditor.vue";
import QuotePartsEditor from "@/components/quotes/QuotePartsEditor.vue";
import { getCountryFlag, getCountryLabel } from "@/lib/countries";
import {
  discountTypeOptions,
  languageOptions,
  platformOptions,
  quoteStatusMeta,
  quoteStatusOptions,
  vatOptions,
} from "@/lib/clientPresets";
import { computed } from "vue";

const props = defineProps<{
  mode?: "quote" | "template";
  status?: QuoteStatus;
  version?: number;
  quoteRef: string;
  title: string;
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
  parts: QuotePart[];
  currencyLocale?: string;
  conditions: QuoteCondition[];
  roadmap: QuoteCondition[];
  acceptance: QuoteCondition[];
  principles: QuoteCondition[];
  addons: QuoteAddon[];
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
  "update:quoteDate": [value: Date | null];
  "update:clientId": [value: string];
  "update:platform": [value: ClientPlatform];
  "update:customPlatformLabel": [value: string];
  "update:language": [value: QuoteLanguage];
  "update:vatRate": [value: VatRate];
  "update:discountType": [value: QuoteDiscountType];
  "update:discountValue": [value: number];
  "update:projectSummary": [value: string];
  "update:parts": [value: QuotePart[]];
  "update:status": [value: QuoteStatus];
  newVersion: [];
  createClient: [];
  addCondition: [];
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
    payload: { id: string; field: "title" | "body"; value: string },
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

const statusLocked = computed(() =>
  props.status ? quoteStatusMeta[props.status].locked : false,
);

const handleTitle = (value: string | undefined) =>
  emit("update:title", value || "");
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
  <section class="bg-surface-card border border-surface-dark/5 rounded-3xl p-6">
    <div
      v-if="mode !== 'template'"
      class="mb-6 flex flex-wrap items-center justify-between gap-4"
    >
      <div class="flex items-center gap-3 rounded-2xl bg-white border border-surface-dark/5 px-4 py-3">
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
          <span class="text-[11px] font-medium uppercase tracking-wide text-surface-dark/45"
            >Statut</span
          >
          <Select
            :model-value="status"
            :options="quoteStatusOptions"
            option-label="label"
            option-value="value"
            class="min-w-[11rem]"
            @update:model-value="emit('update:status', $event)"
          />
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
          <template #icon
            ><span class="material-symbols-outlined text-lg">difference</span></template
          >
          <span class="hidden sm:inline">Nouvelle version</span>
        </Button>
      </div>
    </div>

    <div
      v-if="mode !== 'template' && statusLocked"
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

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <label
        :class="
          mode === 'template'
            ? 'lg:col-span-2 flex flex-col gap-2'
            : 'lg:col-span-2 flex flex-col gap-2'
        "
      >
        <span class="text-sm font-semibold text-surface-dark">{{
          mode === "template" ? "Nom du template" : "Titre du devis"
        }}</span>
        <InputText
          :model-value="title"
          placeholder="Ex: Refonte du site vitrine"
          @update:model-value="handleTitle"
        />
      </label>
      <label v-if="mode !== 'template'" class="flex flex-col gap-2">
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
      <label v-if="mode !== 'template'" class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">Validité</span>
        <InputText :model-value="validUntil" disabled />
      </label>
      <div v-if="mode !== 'template'" class="lg:col-span-2">
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
          <Button severity="secondary" @click="emit('createClient')">
            <template #icon
              ><span class="material-symbols-outlined text-lg"
                >person_add</span
              ></template
            >
            Nouveau client
          </Button>
        </div>
      </div>
      <div
        v-if="mode !== 'template'"
        class="rounded-2xl bg-white border border-surface-dark/5 p-4"
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
        v-if="mode !== 'template'"
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
        v-if="mode !== 'template'"
        class="rounded-2xl bg-white border border-surface-dark/5 p-4"
      >
        <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-1">
          Adresse client
        </p>
        <p class="text-sm text-surface-dark/70 whitespace-pre-line">
          {{ clientAddress || "Adresse non renseignée" }}
        </p>
      </div>
      <div v-if="mode !== 'template'" aria-hidden="true"></div>
      <label class="flex flex-col gap-2">
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
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark"
          >Plateforme personnalisée</span
        >
        <InputText
          :model-value="customPlatformLabel"
          :disabled="platform !== 'other'"
          placeholder="Ex: Webflow, Framer, maintenance, audit..."
          @update:model-value="handleCustomPlatformLabel"
        />
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">
          {{ mode === "template" ? "Langue à modifier" : "Langue" }}
        </span>
        <Select
          :model-value="language"
          :options="languageOptions"
          option-label="label"
          option-value="value"
          @update:model-value="handleLanguage"
        />
      </label>
      <label v-if="mode !== 'template'" class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">TVA</span>
        <Select
          :model-value="vatRate"
          :options="vatOptions"
          option-label="label"
          option-value="value"
          @update:model-value="handleVatRate"
        />
      </label>
      <div
        v-if="mode !== 'template'"
        class="rounded-2xl bg-white border border-surface-dark/5 p-4"
      >
        <div class="grid grid-cols-1 gap-3">
          <div class="flex flex-col gap-1.5">
            <span class="text-sm font-semibold text-surface-dark"
              >Total des parties (HT)</span
            >
            <div
              class="flex items-center justify-between rounded-xl border border-surface-dark/8 bg-surface-light px-3 py-2.5"
            >
              <span class="font-heading text-lg font-bold text-surface-dark">
                {{ formatAmount(getAmountBeforeDiscount(subtotal, discountAmount)) }} €
              </span>
              <span class="text-xs text-surface-dark/45"
                >somme des parties non optionnelles</span
              >
            </div>
          </div>
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
    </div>

    <div class="mt-6 rounded-3xl bg-white border border-surface-dark/5 p-5">
      <div class="mb-3">
        <div>
          <h3 class="font-heading font-bold text-surface-dark">
            Description projet
          </h3>
        </div>
      </div>
      <Textarea
        :model-value="projectSummary"
        rows="6"
        class="w-full"
        @update:model-value="handleProjectSummary"
      />
    </div>

    <div class="mt-6 rounded-3xl bg-white border border-surface-dark/5 p-5">
      <div class="mb-4">
        <h3 class="font-heading font-bold text-surface-dark">
          Contenu du devis
        </h3>
        <p class="mt-1 text-sm text-surface-dark/55">
          Structure ton devis en parties. Chaque partie a son propre prix, peut
          être marquée optionnelle, et s'affiche en texte ou en tableau.
        </p>
      </div>
      <QuotePartsEditor
        :model-value="parts"
        :currency-locale="currencyLocale"
        @update:model-value="emit('update:parts', $event)"
      />
    </div>

    <QuoteAddonsEditor
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
    />

    <QuoteConditionsEditor
      :conditions="conditions"
      @add-condition="emit('addCondition')"
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
    />

    <QuoteConditionsEditor
      :conditions="roadmap"
      section-title="Roadmap & estimated timeline"
      add-button-label="Ajouter une phase"
      empty-label="Aucune phase pour l’instant."
      item-empty-label="Aucun point pour cette phase."
      item-placeholder="Texte du point de roadmap"
      title-placeholder="Nouvelle phase"
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
    />

    <QuoteConditionsEditor
      :conditions="acceptance"
      section-title="Acceptance of proposal"
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
    />

    <QuoteConditionsEditor
      :conditions="principles"
      section-title="Our principles"
      add-button-label="Ajouter un principe"
      empty-label="Aucun principe pour l’instant."
      item-empty-label="Aucun point pour ce principe."
      item-placeholder="Texte du principe"
      title-placeholder="Nouveau principe"
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
    />

    <div class="flex justify-end mt-6"></div>
  </section>
</template>
