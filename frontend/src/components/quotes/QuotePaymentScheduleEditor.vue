<script setup lang="ts">
import type {
  QuotePaymentScheduleDisplay,
  QuotePaymentScheduleStep,
} from "@client-tracker/contracts";
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import SelectButton from "primevue/selectbutton";
import Textarea from "primevue/textarea";
import { computed } from "vue";
import {
  calculatePaymentScheduleStepAmounts,
  formatCurrency,
  resizePaymentSchedule,
} from "@/utils/quote";

const props = withDefaults(
  defineProps<{
    modelValue: QuotePaymentScheduleStep[];
    displayMode?: QuotePaymentScheduleDisplay;
    text?: string;
    subtotal?: number;
    totalWithVat?: number;
    currencyLocale?: string;
  }>(),
  {
    subtotal: 0,
    totalWithVat: 0,
    currencyLocale: "fr-FR",
    displayMode: "table",
    text: "",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: QuotePaymentScheduleStep[]];
  "update:displayMode": [value: QuotePaymentScheduleDisplay];
  "update:text": [value: string];
}>();

const modeOptions: Array<{
  label: string;
  value: QuotePaymentScheduleStep["mode"];
}> = [
  { label: "%", value: "percent" },
  { label: "€", value: "fixed" },
];

const updateStep = <K extends keyof QuotePaymentScheduleStep>(
  id: string,
  field: K,
  value: QuotePaymentScheduleStep[K],
) => {
  emit(
    "update:modelValue",
    props.modelValue.map((step) =>
      step.id === id ? { ...step, [field]: value } : step,
    ),
  );
};

const totalPercent = computed(() =>
  props.modelValue.reduce((sum, step) => {
    const amounts = calculatePaymentScheduleStepAmounts(
      step,
      props.subtotal,
      props.totalWithVat,
    );
    return sum + amounts.percent;
  }, 0),
);

const isBalanced = computed(() => Math.abs(totalPercent.value - 100) < 0.01);

const addStep = () => {
  if (props.modelValue.length >= 12) return;
  emit(
    "update:modelValue",
    resizePaymentSchedule(props.modelValue, props.modelValue.length + 1),
  );
};

const removeStep = (id: string) =>
  emit(
    "update:modelValue",
    props.modelValue.filter((step) => step.id !== id),
  );

const distributeEvenly = () => {
  const count = props.modelValue.length || 1;
  const base = Math.floor((100 / count) * 100) / 100;
  const remainder = Number((100 - base * count).toFixed(2));
  emit(
    "update:modelValue",
    props.modelValue.map((step, index) => ({
      ...step,
      mode: "percent",
      value: Number(
        (base + (index === count - 1 ? remainder : 0)).toFixed(2),
      ),
    })),
  );
};
</script>

<template>
  <div
    class="rounded-3xl border border-surface-dark/5 bg-white p-5 shadow-[0_8px_24px_rgba(33,35,54,0.06)]"
  >
    <div class="mb-4 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="font-heading font-bold text-surface-dark">
          Échéancier de paiement
        </h3>
      </div>
      <div class="ml-auto flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          role="switch"
          :aria-checked="displayMode === 'text'"
          :aria-label="`Affichage ${displayMode === 'table' ? 'tableau' : 'texte'}`"
          title="Basculer entre tableau et texte libre"
          class="mr-1 inline-flex h-8 items-center gap-2 rounded-full px-2 text-[11px] font-medium text-surface-dark/55 transition-colors hover:bg-surface-dark/[0.04] hover:text-surface-dark/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          @click="emit('update:displayMode', displayMode === 'table' ? 'text' : 'table')"
        >
          <span>{{ displayMode === "table" ? "Tableau" : "Texte libre" }}</span>
          <span
            class="relative h-4 w-7 shrink-0 rounded-full transition-colors"
            :class="displayMode === 'text' ? 'bg-primary/70' : 'bg-surface-dark/15'"
            aria-hidden="true"
          >
            <span
              class="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform"
              :class="displayMode === 'text' ? 'translate-x-3' : 'translate-x-0'"
            />
          </span>
        </button>
        <slot name="headerActions" />
      </div>
    </div>

    <div
      v-if="displayMode === 'table'"
      class="mb-3 flex flex-wrap items-center justify-between gap-3 border-t border-surface-dark/6 pt-4"
    >
      <div class="flex items-center gap-2 text-sm">
        <span class="text-surface-dark/55">
          {{ modelValue.length }} {{ modelValue.length > 1 ? "étapes" : "étape" }}
        </span>
        <span aria-hidden="true" class="text-surface-dark/20">·</span>
        <span
          class="font-semibold tabular-nums"
          :class="isBalanced ? 'text-emerald-600' : 'text-amber-600'"
        >
          {{ totalPercent.toFixed(2) }} % répartis
        </span>
      </div>
      <div class="flex items-center gap-1">
        <Button
          v-if="modelValue.length > 1"
          type="button"
          severity="secondary"
          text
          size="small"
          class="!rounded-xl"
          label="Répartir équitablement"
          @click="distributeEvenly"
        />
        <Button
          type="button"
          severity="secondary"
          outlined
          size="small"
          class="!rounded-xl"
          label="Ajouter une étape"
          :disabled="modelValue.length >= 12"
          @click="addStep"
        >
          <template #icon><span class="material-symbols-outlined text-base">add</span></template>
        </Button>
      </div>
    </div>

    <div v-if="displayMode === 'table'" class="space-y-3">
      <div
        v-for="(step, index) in modelValue"
        :key="step.id"
        class="flex items-start gap-3 rounded-2xl border border-surface-dark/8 bg-surface-light/45 p-3"
      >
        <span
          class="mt-5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary"
        >
          {{ index + 1 }}
        </span>
        <div class="grid min-w-0 flex-1 grid-cols-1 items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto_9rem_auto]">
          <label class="flex min-w-0 flex-col gap-1.5">
            <span class="text-xs font-medium text-surface-dark/45">Échéance</span>
            <InputText
              :model-value="step.label"
              class="w-full"
              placeholder="Ex: Acompte à la validation"
              @update:model-value="updateStep(step.id, 'label', $event || '')"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-medium text-surface-dark/45">Type</span>
            <SelectButton
              :model-value="step.mode"
              :options="modeOptions"
              option-label="label"
              option-value="value"
              :allow-empty="false"
              size="small"
              @update:model-value="updateStep(step.id, 'mode', $event)"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span class="text-xs font-medium text-surface-dark/45">
              {{ step.mode === "percent" ? "Part" : "Montant HT" }}
            </span>
            <InputNumber
              :model-value="step.value"
              :mode="step.mode === 'fixed' ? 'currency' : 'decimal'"
              :currency="step.mode === 'fixed' ? 'EUR' : undefined"
              locale="fr-FR"
              :suffix="step.mode === 'percent' ? ' %' : undefined"
              :min="0"
              :max="step.mode === 'percent' ? 100 : undefined"
              input-class="w-full text-right font-semibold"
              class="w-full"
              @update:model-value="
                updateStep(step.id, 'value', Number($event || 0))
              "
            />
          </label>
          <div class="min-w-[8.5rem] pb-1 text-right text-xs tabular-nums text-surface-dark/50">
            <strong class="block font-heading text-sm text-surface-dark">
              {{
                formatCurrency(
                  calculatePaymentScheduleStepAmounts(step, subtotal, totalWithVat).amountIncl,
                  currencyLocale,
                )
              }} TTC
            </strong>
            <span>
              {{
                formatCurrency(
                  calculatePaymentScheduleStepAmounts(step, subtotal, totalWithVat).amountExcl,
                  currencyLocale,
                )
              }} HT
            </span>
          </div>
        </div>
        <Button
          type="button"
          text
          rounded
          severity="danger"
          class="mt-5 !h-8 !w-8 shrink-0 !p-0"
          aria-label="Supprimer l’étape"
          title="Supprimer l’étape"
          @click="removeStep(step.id)"
        >
          <template #icon><span class="material-symbols-outlined text-base">delete</span></template>
        </Button>
      </div>
    </div>

    <label v-else class="flex flex-col gap-2 border-t border-surface-dark/6 pt-4">
      <span class="text-sm font-semibold text-surface-dark">Modalités de paiement</span>
      <Textarea
        :model-value="text"
        rows="6"
        auto-resize
        class="w-full"
        placeholder="Ex. 50 % à la signature du devis, puis 50 % à la livraison."
        @update:model-value="emit('update:text', $event || '')"
      />
    </label>
  </div>
</template>
