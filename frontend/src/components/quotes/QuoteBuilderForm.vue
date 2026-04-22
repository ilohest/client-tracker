<script setup lang="ts">
import type { Client, ClientPlatform, QuoteAddon, QuoteCondition, QuoteDiscountType, QuoteLanguage, QuoteSection, QuoteStatus, VatRate } from '@client-tracker/contracts';
import Button from 'primevue/button';
import DatePicker from 'primevue/datepicker';
import InputText from 'primevue/inputtext';
import InputNumber from 'primevue/inputnumber';
import Select from 'primevue/select';
import Textarea from 'primevue/textarea';
import QuoteAddonsEditor from '@/components/quotes/QuoteAddonsEditor.vue';
import QuoteConditionsEditor from '@/components/quotes/QuoteConditionsEditor.vue';
import { getCountryFlag, getCountryLabel } from '@/lib/countries';
import { discountTypeOptions, languageOptions, platformOptions, quoteStatusOptions, vatOptions } from '@/lib/clientPresets';

defineProps<{
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
  status: QuoteStatus;
  vatRate: VatRate;
  basePrice: number;
  discountType: QuoteDiscountType;
  discountValue: number;
  projectSummary: string;
  sections: QuoteSection[];
  conditions: QuoteCondition[];
  addons: QuoteAddon[];
  clients: Client[];
  addonsTotal: number;
  discountAmount: number;
  subtotal: number;
  vatAmount: number;
  totalWithVat: number;
  vatExplanation: string;
  aiLoading: boolean;
}>();

const emit = defineEmits<{
  'update:title': [value: string];
  'update:quoteDate': [value: Date | null];
  'update:clientId': [value: string];
  'update:platform': [value: ClientPlatform];
  'update:customPlatformLabel': [value: string];
  'update:language': [value: QuoteLanguage];
  'update:status': [value: QuoteStatus];
  'update:vatRate': [value: VatRate];
  'update:basePrice': [value: number];
  'update:discountType': [value: QuoteDiscountType];
  'update:discountValue': [value: number];
  'update:projectSummary': [value: string];
  createClient: [];
  addSection: [];
  updateSection: [payload: { id: string; field: 'title' | 'description'; value: string | number }];
  removeSection: [id: string];
  addSectionSubsection: [sectionId: string];
  updateSectionSubsection: [payload: { sectionId: string; subsectionId: string; field: 'title' | 'body'; value: string }];
  removeSectionSubsection: [payload: { sectionId: string; subsectionId: string }];
  addCondition: [];
  updateCondition: [payload: { id: string; field: 'title' | 'body'; value: string }];
  removeCondition: [id: string];
  addConditionItem: [conditionId: string];
  updateConditionItem: [payload: { conditionId: string; itemId: string; value: string }];
  removeConditionItem: [payload: { conditionId: string; itemId: string }];
  moveConditionItem: [payload: { conditionId: string; draggedId: string; targetId: string }];
  nestConditionItemUnderItem: [payload: { conditionId: string; draggedId: string; targetId: string }];
  addConditionSubItem: [payload: { conditionId: string; itemId: string }];
  updateConditionSubItem: [payload: { conditionId: string; itemId: string; subItemId: string; value: string }];
  removeConditionSubItem: [payload: { conditionId: string; itemId: string; subItemId: string }];
  moveConditionSubItem: [payload: { conditionId: string; itemId: string; draggedId: string; targetId: string }];
  moveConditionSubItemToItem: [payload: { conditionId: string; fromItemId: string; subItemId: string; targetItemId: string }];
  promoteConditionSubItemToItem: [payload: { conditionId: string; fromItemId: string; subItemId: string; targetId: string }];
  addAddonPreset: [];
  updateAddon: [payload: { id: string; field: 'title' | 'description' | 'price'; value: string | number }];
  removeAddon: [id: string];
  moveAddon: [payload: { draggedId: string; targetId: string }];
  addAddonItem: [addonId: string];
  updateAddonItem: [payload: { addonId: string; itemId: string; value: string }];
  removeAddonItem: [payload: { addonId: string; itemId: string }];
  moveAddonItem: [payload: { addonId: string; draggedId: string; targetId: string }];
  nestAddonItemUnderItem: [payload: { addonId: string; draggedId: string; targetId: string }];
  addAddonSubItem: [payload: { addonId: string; itemId: string }];
  updateAddonSubItem: [payload: { addonId: string; itemId: string; subItemId: string; value: string }];
  removeAddonSubItem: [payload: { addonId: string; itemId: string; subItemId: string }];
  moveAddonSubItem: [payload: { addonId: string; itemId: string; draggedId: string; targetId: string }];
  moveAddonSubItemToItem: [payload: { addonId: string; fromItemId: string; subItemId: string; targetItemId: string }];
  promoteAddonSubItemToItem: [payload: { addonId: string; fromItemId: string; subItemId: string; targetId: string }];
  generateSummary: [];
}>();

const handleTitle = (value: string | undefined) => emit('update:title', value || '');
const handleQuoteDate = (value: Date | (Date | null)[] | Date[] | null | undefined) =>
  emit('update:quoteDate', value instanceof Date ? value : null);
const handleClientId = (value: string | null | undefined) => emit('update:clientId', value || '');
const handlePlatform = (value: ClientPlatform | null | undefined) => emit('update:platform', value || '');
const handleCustomPlatformLabel = (value: string | undefined) => emit('update:customPlatformLabel', value || '');
const handleLanguage = (value: QuoteLanguage) => emit('update:language', value);
const handleStatus = (value: QuoteStatus) => emit('update:status', value);
const handleVatRate = (value: VatRate) => emit('update:vatRate', value);
const handleBasePrice = (value: number | null | undefined) => emit('update:basePrice', Number(value || 0));
const handleDiscountType = (value: QuoteDiscountType) => emit('update:discountType', value);
const handleDiscountValue = (value: number | null | undefined) => emit('update:discountValue', Number(value || 0));
const handleProjectSummary = (value: string) => emit('update:projectSummary', value);
const handleSectionUpdate = (
  id: string,
  field: 'title' | 'description',
  value: string | number | undefined,
) => emit('updateSection', { id, field, value: typeof value === 'undefined' ? '' : value });
const handleSectionSubsectionUpdate = (
  sectionId: string,
  subsectionId: string,
  field: 'title' | 'body',
  value: string | undefined,
) => emit('updateSectionSubsection', { sectionId, subsectionId, field, value: value || '' });
</script>

<template>
  <section class="bg-surface-card border border-surface-dark/5 rounded-3xl p-6">
    <div class="flex items-start justify-between gap-4 mb-6">
      <div class="rounded-2xl bg-white border border-surface-dark/5 px-4 py-3">
        <p class="text-xs uppercase tracking-wide text-surface-dark/45">Référence</p>
        <p class="font-heading font-bold text-surface-dark">{{ quoteRef }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <label class="lg:col-span-2 flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">Titre du devis</span>
        <InputText
          :model-value="title"
          placeholder="Ex: Refonte du site vitrine"
          @update:model-value="handleTitle"
        />
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">Date du devis</span>
        <DatePicker
          :model-value="quoteDate"
          date-format="dd/mm/yy"
          show-icon
          icon-display="input"
          class="w-full"
          @update:model-value="handleQuoteDate"
        />
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">Validité</span>
        <InputText :model-value="validUntil" disabled />
      </label>
      <div class="lg:col-span-2">
        <span class="text-sm font-semibold text-surface-dark block mb-2">Client</span>
        <div class="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_160px] gap-3">
          <Select
            :model-value="clientId"
            :options="clients.map((client) => ({ label: client.name, value: client.id }))"
            option-label="label"
            option-value="value"
            placeholder="Sélectionner un client existant"
            @update:model-value="handleClientId"
          />
          <Button severity="secondary" @click="emit('createClient')">
            <template #icon><span class="material-symbols-outlined text-lg">person_add</span></template>
            Nouveau client
          </Button>
        </div>
      </div>
      <div class="rounded-2xl bg-white border border-surface-dark/5 p-4">
        <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-1">Client sélectionné</p>
        <p class="font-heading font-bold text-surface-dark">{{ clientName || 'Aucun client' }}</p>
        <p class="text-sm text-surface-dark/60 mt-1">{{ clientWebsite || 'Site non renseigné' }}</p>
      </div>
      <div class="rounded-2xl bg-white border border-surface-dark/5 p-4">
        <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-1">Facturation client</p>
        <p class="text-sm font-semibold text-surface-dark">{{ getCountryFlag(clientCountry) }} {{ getCountryLabel(clientCountry) }}</p>
        <p class="text-sm text-surface-dark/60 mt-1">{{ clientVatLabel }}</p>
      </div>
      <div class="rounded-2xl bg-white border border-surface-dark/5 p-4 lg:col-span-2">
        <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-1">Adresse client</p>
        <p class="text-sm text-surface-dark/70 whitespace-pre-line">{{ clientAddress || 'Adresse non renseignée' }}</p>
      </div>
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
        <span class="text-sm font-semibold text-surface-dark">Plateforme personnalisée</span>
        <InputText
          :model-value="customPlatformLabel"
          :disabled="platform !== 'other'"
          placeholder="Ex: Webflow, Framer, maintenance, audit..."
          @update:model-value="handleCustomPlatformLabel"
        />
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">Langue</span>
        <Select :model-value="language" :options="languageOptions" option-label="label" option-value="value" @update:model-value="handleLanguage" />
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">Statut du devis</span>
        <Select :model-value="status" :options="quoteStatusOptions" option-label="label" option-value="value" @update:model-value="handleStatus" />
      </label>
      <label class="flex flex-col gap-2">
        <span class="text-sm font-semibold text-surface-dark">TVA</span>
        <Select :model-value="vatRate" :options="vatOptions" option-label="label" option-value="value" @update:model-value="handleVatRate" />
      </label>
      <div class="rounded-2xl bg-white border border-surface-dark/5 p-4">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
          <label class="flex flex-col gap-2">
            <span class="text-sm font-semibold text-surface-dark">Prix total HT</span>
            <InputNumber
              :model-value="basePrice"
              mode="currency"
              currency="EUR"
              locale="fr-FR"
              class="w-full"
              @update:model-value="handleBasePrice"
            />
          </label>
          <label class="flex flex-col gap-2">
            <span class="text-sm font-semibold text-surface-dark">Type de réduction</span>
            <Select
              :model-value="discountType"
              :options="discountTypeOptions"
              option-label="label"
              option-value="value"
              @update:model-value="handleDiscountType"
            />
          </label>
        </div>
        <div class="mt-3 grid grid-cols-1 gap-3 md:grid-cols-[160px_minmax(0,1fr)]">
          <label class="flex flex-col gap-2">
            <span class="text-sm font-semibold text-surface-dark">Réduction</span>
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
          <div class="rounded-2xl bg-surface-light p-4 text-right">
            <p class="text-xs uppercase tracking-wide text-surface-dark/45 mb-1">Montants</p>
            <p class="text-sm text-surface-dark/70">Add-ons {{ addonsTotal.toFixed(2) }} €</p>
            <p class="text-sm text-surface-dark/70">Réduction -{{ discountAmount.toFixed(2) }} €</p>
            <p class="text-sm text-surface-dark/70">HT {{ subtotal.toFixed(2) }} €</p>
            <p class="text-sm text-surface-dark/70">TVA {{ vatAmount.toFixed(2) }} €</p>
            <p class="text-lg font-heading font-bold text-surface-dark mt-1">TTC {{ totalWithVat.toFixed(2) }} €</p>
          </div>
        </div>
      </div>
    </div>

    <div class="mt-6 rounded-3xl bg-white border border-surface-dark/5 p-5">
      <div class="flex items-center justify-between gap-3 mb-3">
        <div>
          <h3 class="font-heading font-bold text-surface-dark">Description projet</h3>
          <p class="text-sm text-surface-dark/60">Tu peux la rédiger ou la générer avec l’IA.</p>
        </div>
        <Button :loading="aiLoading" @click="emit('generateSummary')">Générer avec l’IA</Button>
      </div>
      <Textarea
        :model-value="projectSummary"
        rows="6"
        class="w-full"
        @update:model-value="handleProjectSummary"
      />
    </div>

    <div class="mt-6 rounded-3xl bg-white border border-surface-dark/5 p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="font-heading font-bold text-surface-dark">Contenu du devis</h3>
        <Button text @click="emit('addSection')">
          <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
          Nouvelle ligne
        </Button>
      </div>
      <div class="flex flex-col gap-4">
        <div v-for="section in sections" :key="section.id" class="rounded-2xl border border-surface-dark/6 p-4">
          <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-3 items-center">
            <InputText class="w-full" :model-value="section.title" @update:model-value="handleSectionUpdate(section.id, 'title', $event)" />
            <Button text severity="danger" class="justify-self-start lg:justify-self-center" @click="emit('removeSection', section.id)">
              <template #icon><span class="material-symbols-outlined text-lg">delete</span></template>
            </Button>
          </div>
          <Textarea
            :model-value="section.description"
            rows="6"
            class="w-full mt-3"
            auto-resize
            @update:model-value="handleSectionUpdate(section.id, 'description', $event)"
          />
          <div class="mt-4 rounded-2xl bg-surface-light p-4">
            <div class="mb-3 flex items-center justify-between gap-3">
              <p class="text-sm font-semibold text-surface-dark">Sous-sections</p>
              <Button text severity="secondary" @click="emit('addSectionSubsection', section.id)">
                <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
                Ajouter une sous-section
              </Button>
            </div>
            <div v-if="section.subSections?.length" class="flex flex-col gap-3">
              <div v-for="subSection in section.subSections" :key="subSection.id" class="rounded-2xl border border-surface-dark/8 bg-white p-4">
                <div class="mb-3 flex items-center justify-between gap-3">
                  <InputText
                    class="w-full"
                    :model-value="subSection.title"
                    placeholder="Titre de la sous-section"
                    @update:model-value="handleSectionSubsectionUpdate(section.id, subSection.id, 'title', $event)"
                  />
                  <Button text severity="danger" @click="emit('removeSectionSubsection', { sectionId: section.id, subsectionId: subSection.id })">
                    <template #icon><span class="material-symbols-outlined text-lg">delete</span></template>
                  </Button>
                </div>
                <Textarea
                  class="w-full"
                  :model-value="subSection.body"
                  rows="6"
                  auto-resize
                  placeholder="Contenu détaillé de la sous-section..."
                  @update:model-value="handleSectionSubsectionUpdate(section.id, subSection.id, 'body', $event)"
                />
              </div>
            </div>
            <p v-else class="text-sm text-surface-dark/55">Aucune sous-section pour l’instant.</p>
          </div>
        </div>
      </div>
    </div>

    <QuoteAddonsEditor
      :addons="addons"
      @add-addon="emit('addAddonPreset')"
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
      @promote-addon-sub-item-to-item="emit('promoteAddonSubItemToItem', $event)"
    />

    <QuoteConditionsEditor
      :conditions="conditions"
      @add-condition="emit('addCondition')"
      @remove-condition="emit('removeCondition', $event)"
      @update-condition-title="emit('updateCondition', { id: $event.id, field: 'title', value: $event.value })"
      @add-condition-item="emit('addConditionItem', $event)"
      @update-condition-item="emit('updateConditionItem', $event)"
      @remove-condition-item="emit('removeConditionItem', $event)"
      @move-condition-item="emit('moveConditionItem', $event)"
      @nest-condition-item-under-item="emit('nestConditionItemUnderItem', $event)"
      @add-condition-sub-item="emit('addConditionSubItem', $event)"
      @update-condition-sub-item="emit('updateConditionSubItem', $event)"
      @remove-condition-sub-item="emit('removeConditionSubItem', $event)"
      @move-condition-sub-item="emit('moveConditionSubItem', $event)"
      @move-condition-sub-item-to-item="emit('moveConditionSubItemToItem', $event)"
      @promote-condition-sub-item-to-item="emit('promoteConditionSubItemToItem', $event)"
    />

    <div class="flex justify-end mt-6">
    </div>
  </section>
</template>
