<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { QuotePart, QuotePartDisplayStyle, QuoteSection } from "@client-tracker/contracts";
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import InputNumber from "primevue/inputnumber";
import SelectButton from "primevue/selectbutton";
import Checkbox from "primevue/checkbox";
import Accordion from "primevue/accordion";
import AccordionPanel from "primevue/accordionpanel";
import AccordionHeader from "primevue/accordionheader";
import AccordionContent from "primevue/accordioncontent";
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

const STORAGE_KEY = "devisio:quote-parts:collapsed";

const readCollapsedState = (): Set<number> => {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(
      Array.isArray(parsed)
        ? parsed.filter((index) => Number.isInteger(index) && index >= 0)
        : [],
    );
  } catch {
    return new Set();
  }
};

const writeCollapsedState = (value: Set<number>) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...value]));
};

const collapsed = ref<Set<number>>(readCollapsedState());
const activePartIds = computed<string[]>({
  get: () =>
    props.modelValue
      .filter((_, index) => !collapsed.value.has(index))
      .map((part) => part.id),
  set: (value) => {
    const active = new Set(value || []);
    collapsed.value = new Set(
      props.modelValue
        .map((part, index) => ({ part, index }))
        .filter(({ part }) => !active.has(part.id))
        .map(({ index }) => index),
    );
    writeCollapsedState(collapsed.value);
  },
});

watch(
  () => props.modelValue.length,
  (length) => {
    if (!length) return;
    const next = new Set([...collapsed.value].filter((index) => index < length));
    if (next.size !== collapsed.value.size) {
      collapsed.value = next;
      writeCollapsedState(next);
    }
  },
  { immediate: true },
);

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
    includeInInvestment: true,
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
  <div class="flex flex-col gap-3">
    <Accordion v-model:value="activePartIds" multiple class="quote-editor-accordion">
      <AccordionPanel
        v-for="(part, index) in modelValue"
        :key="part.id"
        :value="part.id"
        class="rounded-2xl border-2 border-primary bg-surface-light"
        :class="[
          draggedId === part.id ? 'opacity-60 ring-2 ring-primary/30' : '',
          part.optional ? 'border-dashed bg-primary/[0.035]' : '',
        ]"
        @dragover.prevent="reorder(part.id)"
      >
        <AccordionHeader as="div">
          <template #default="{ active }">
            <div
              class="grid w-full grid-cols-[auto_auto_minmax(0,1fr)_minmax(8rem,12rem)_auto] items-center gap-2 px-5 py-2.5 outline-none"
            >
              <button
                type="button"
                draggable="true"
                class="cursor-grab text-surface-dark/30 active:cursor-grabbing"
                aria-label="Réordonner la partie"
                @click.stop
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
                class="min-w-0"
                :model-value="part.title"
                placeholder="Titre de la partie (ex. Phase 1 — Accès API)"
                @click.stop
                @keydown.stop
                @update:model-value="updateField(part.id, 'title', $event || '')"
              />
              <InputNumber
                :model-value="part.price"
                mode="currency"
                currency="EUR"
                :locale="currencyLocale"
                :min="0"
                class="w-full"
                input-class="text-right"
                :disabled="part.includeInInvestment === false"
                @click.stop
                @keydown.stop
                @update:model-value="updateField(part.id, 'price', Number($event || 0))"
              />
              <div class="ml-auto flex items-center justify-end gap-1">
                <Button type="button" text severity="danger" class="!h-9 !w-9 shrink-0 !p-0" @click.stop="removePart(part.id)">
                  <template #icon><span class="material-symbols-outlined">delete</span></template>
                </Button>
                <Button type="button" text severity="secondary" class="!h-9 !w-9 shrink-0 !p-0">
                  <template #icon>
                    <span class="material-symbols-outlined">{{
                      active ? "expand_less" : "expand_more"
                    }}</span>
                  </template>
                </Button>
              </div>
            </div>
          </template>
          <template #toggleicon><span aria-hidden="true" class="hidden"></span></template>
        </AccordionHeader>

        <AccordionContent>
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
            <label :for="`investment-${part.id}`" class="flex cursor-pointer items-center gap-2">
              <Checkbox
                :input-id="`investment-${part.id}`"
                :model-value="part.includeInInvestment !== false"
                binary
                @update:model-value="updateField(part.id, 'includeInInvestment', $event)"
              />
              <span class="text-sm text-surface-dark/70">Afficher dans investissement</span>
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
          <div class="border-t border-surface-dark/6 p-3">
            <QuoteSectionsEditor
              :storage-key="`devisio:quote-sections:${index}`"
              :model-value="part.sections"
              @update:model-value="updateSections(part.id, $event)"
            />
          </div>
        </AccordionContent>
      </AccordionPanel>
    </Accordion>

    <div class="flex items-center justify-between gap-3">
      <Button
        type="button"
        severity="secondary"
        outlined
        class="rounded-xl"
        @click.stop="addPart" label="Ajouter une partie">
        <template #icon><span class="material-symbols-outlined">add</span></template></Button>
      <div class="text-sm text-surface-dark/70">
        Sous-total des parties
        <span class="ml-2 font-heading text-base font-bold text-surface-dark">{{
          formatCurrency(subtotal, currencyLocale)
        }}</span>
      </div>
    </div>
  </div>
</template>
