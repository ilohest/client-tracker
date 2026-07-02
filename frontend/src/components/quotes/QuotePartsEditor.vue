<script setup lang="ts">
import { computed, ref } from "vue";
import type { QuotePart, QuotePartDisplayStyle, QuoteSection } from "@client-tracker/contracts";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import SelectButton from "primevue/selectbutton";
import Checkbox from "primevue/checkbox";
import QuoteSectionsEditor from "@/components/quotes/QuoteSectionsEditor.vue";
import { calculatePartsSubtotal, createEntityId, formatCurrency } from "@/utils/quote";

const props = withDefaults(
  defineProps<{
    modelValue: QuotePart[];
    currencyLocale?: string;
  }>(),
  { currencyLocale: "fr-FR" },
);

const emit = defineEmits<{
  "update:modelValue": [value: QuotePart[]];
}>();

const styleOptions: Array<{ label: string; value: QuotePartDisplayStyle }> = [
  { label: "Texte", value: "text" },
  { label: "Tableau", value: "table" },
];

const collapsed = ref<Set<string>>(new Set());
const toggleCollapse = (id: string) => {
  const next = new Set(collapsed.value);
  next.has(id) ? next.delete(id) : next.add(id);
  collapsed.value = next;
};
const isExpanded = (id: string) => !collapsed.value.has(id);

const commit = (parts: QuotePart[]) => emit("update:modelValue", parts);

const mapPart = (partId: string, updater: (part: QuotePart) => QuotePart) =>
  commit(props.modelValue.map((part) => (part.id === partId ? updater(part) : part)));

const subtotal = computed(() => calculatePartsSubtotal(props.modelValue));

const addPart = () => {
  const part: QuotePart = {
    id: createEntityId(),
    title: "",
    displayStyle: "text",
    price: 0,
    optional: false,
    priceNote: "",
    sections: [],
  };
  commit([...props.modelValue, part]);
};
const removePart = (id: string) =>
  commit(props.modelValue.filter((part) => part.id !== id));

const updateField = <K extends keyof QuotePart>(
  id: string,
  field: K,
  value: QuotePart[K],
) => mapPart(id, (part) => ({ ...part, [field]: value }));

const updateSections = (id: string, sections: QuoteSection[]) =>
  mapPart(id, (part) => ({ ...part, sections }));

// ---- Réordonnancement des parties ----
const draggedId = ref<string | null>(null);
const reorder = (targetId: string) => {
  const dragged = draggedId.value;
  if (!dragged || dragged === targetId) return;
  const list = [...props.modelValue];
  const from = list.findIndex((p) => p.id === dragged);
  const to = list.findIndex((p) => p.id === targetId);
  if (from === -1 || to === -1) return;
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  commit(list);
};
</script>

<template>
  <div class="flex flex-col gap-4">
    <div
      v-for="(part, index) in modelValue"
      :key="part.id"
      class="rounded-2xl border border-surface-dark/8 bg-surface-light"
      :class="[
        draggedId === part.id ? 'opacity-60 ring-2 ring-primary/30' : '',
        part.optional ? 'border-dashed' : '',
      ]"
      @dragover.prevent="reorder(part.id)"
    >
      <!-- En-tête de partie -->
      <div class="flex flex-wrap items-center gap-2 p-3">
        <button
          type="button"
          draggable="true"
          class="cursor-grab text-surface-dark/30 active:cursor-grabbing"
          aria-label="Réordonner la partie"
          @dragstart="draggedId = part.id"
          @dragend="draggedId = null"
        >
          <span class="material-symbols-outlined">drag_indicator</span>
        </button>
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white"
          >{{ index + 1 }}</span
        >
        <InputText
          class="min-w-[12rem] flex-1"
          :model-value="part.title"
          placeholder="Titre de la partie (ex. Phase 1 — Accès API)"
          @update:model-value="updateField(part.id, 'title', $event || '')"
        />
        <InputNumber
          :model-value="part.price"
          mode="currency"
          currency="EUR"
          :locale="currencyLocale"
          :min="0"
          class="w-36"
          input-class="text-right"
          @update:model-value="updateField(part.id, 'price', Number($event || 0))"
        />
        <Button text severity="secondary" @click="toggleCollapse(part.id)">
          <template #icon>
            <span class="material-symbols-outlined">{{
              isExpanded(part.id) ? "expand_less" : "expand_more"
            }}</span>
          </template>
        </Button>
        <Button text severity="danger" @click="removePart(part.id)">
          <template #icon><span class="material-symbols-outlined">delete</span></template>
        </Button>
      </div>

      <!-- Options de partie -->
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-surface-dark/6 px-3 py-2.5">
        <div class="flex items-center gap-2">
          <span class="text-xs font-medium uppercase tracking-wide text-surface-dark/50">Affichage</span>
          <SelectButton
            :model-value="part.displayStyle"
            :options="styleOptions"
            option-label="label"
            option-value="value"
            :allow-empty="false"
            @update:model-value="updateField(part.id, 'displayStyle', $event)"
          />
        </div>
        <label :for="`optional-${part.id}`" class="flex cursor-pointer items-center gap-2">
          <Checkbox
            :input-id="`optional-${part.id}`"
            :model-value="part.optional"
            binary
            @update:model-value="updateField(part.id, 'optional', $event)"
          />
          <span class="text-sm text-surface-dark/70">Partie optionnelle</span>
          <span
            class="text-xs text-surface-dark/40"
            title="Une partie optionnelle est affichée mais exclue du sous-total"
            >(hors total)</span
          >
        </label>
        <InputText
          v-if="part.optional"
          class="min-w-[16rem] flex-1"
          :model-value="part.priceNote"
          placeholder="Note de prix (ex. * plafond garanti — facturé au temps réel)"
          @update:model-value="updateField(part.id, 'priceNote', $event || '')"
        />
      </div>

      <!-- Contenu (lignes / sous-lignes) -->
      <div v-if="isExpanded(part.id)" class="border-t border-surface-dark/6 p-3">
        <QuoteSectionsEditor
          :model-value="part.sections"
          @update:model-value="updateSections(part.id, $event)"
        />
      </div>
    </div>

    <div class="flex items-center justify-between gap-3">
      <Button
        severity="secondary"
        outlined
        class="rounded-xl"
        @click="addPart"
      >
        <template #icon><span class="material-symbols-outlined">add</span></template>
        Ajouter une partie
      </Button>
      <div class="text-sm text-surface-dark/70">
        Sous-total des parties
        <span class="ml-2 font-heading text-base font-bold text-surface-dark">{{
          formatCurrency(subtotal, currencyLocale)
        }}</span>
      </div>
    </div>
  </div>
</template>
