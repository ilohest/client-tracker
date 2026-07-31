<script setup lang="ts">
import type { QuotePaymentScheduleStep } from "@client-tracker/contracts";
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import SelectButton from "primevue/selectbutton";
import Slider from "primevue/slider";
import {
  calculatePaymentScheduleStepAmounts,
  formatCurrency,
  resizePaymentSchedule,
} from "@/utils/quote";

const props = withDefaults(
  defineProps<{
    modelValue: QuotePaymentScheduleStep[];
    subtotal?: number;
    totalWithVat?: number;
    currencyLocale?: string;
  }>(),
  {
    subtotal: 0,
    totalWithVat: 0,
    currencyLocale: "fr-FR",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: QuotePaymentScheduleStep[]];
}>();

const modeOptions: Array<{ label: string; value: QuotePaymentScheduleStep["mode"] }> = [
  { label: "%", value: "percent" },
  { label: "€", value: "fixed" },
];

const updateCount = (count: number | null | undefined) => {
  emit("update:modelValue", resizePaymentSchedule(props.modelValue, Number(count || 1)));
};

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

const totalPercent = () =>
  props.modelValue.reduce((sum, step) => {
    const amounts = calculatePaymentScheduleStepAmounts(
      step,
      props.subtotal,
      props.totalWithVat,
    );
    return sum + amounts.percent;
  }, 0);
</script>

<template>
  <div class="rounded-3xl border border-surface-dark/5 bg-white p-5">
    <div class="mb-4 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h3 class="font-heading font-bold text-surface-dark">
          Échéancier de paiement
        </h3>
        <p class="mt-1 text-sm text-surface-dark/55">
          Définis les étapes de paiement. Chaque ligne calcule automatiquement
          son équivalent HT et TTC.
        </p>
      </div>
      <div class="ml-auto flex items-end gap-2">
        <slot name="headerActions" />
        <label class="flex min-w-36 flex-col gap-2">
        <span class="text-xs font-medium uppercase tracking-wide text-surface-dark/45">
          Étapes
        </span>
        <InputNumber
          :model-value="modelValue.length || 1"
          :min="1"
          :max="12"
          show-buttons
          button-layout="horizontal"
          @update:model-value="updateCount"
        />
        </label>
      </div>
    </div>

    <div class="space-y-3">
      <div
        v-for="(step, index) in modelValue"
        :key="step.id"
        class="rounded-2xl border border-surface-dark/8 bg-surface-light p-3"
      >
        <div class="grid grid-cols-1 gap-3 lg:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,170px)] lg:items-start">
          <span class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
            {{ index + 1 }}
          </span>
          <label class="flex flex-col gap-2">
            <span class="text-xs font-medium uppercase tracking-wide text-surface-dark/45">
              Libellé
            </span>
            <InputText
              :model-value="step.label"
              placeholder="Ex: Acompte à la validation"
              @update:model-value="updateStep(step.id, 'label', $event || '')"
            />
          </label>
          <label class="flex flex-col gap-2">
            <span class="text-xs font-medium uppercase tracking-wide text-surface-dark/45">
              Type
            </span>
            <SelectButton
              :model-value="step.mode"
              :options="modeOptions"
              option-label="label"
              option-value="value"
              :allow-empty="false"
              @update:model-value="updateStep(step.id, 'mode', $event)"
            />
          </label>
          <label class="flex flex-col gap-2">
            <span class="text-xs font-medium uppercase tracking-wide text-surface-dark/45">
              {{ step.mode === "percent" ? "Pourcentage" : "Montant HT" }}
            </span>
            <InputNumber
              :model-value="step.value"
              :mode="step.mode === 'fixed' ? 'currency' : 'decimal'"
              :currency="step.mode === 'fixed' ? 'EUR' : undefined"
              locale="fr-FR"
              :suffix="step.mode === 'percent' ? ' %' : undefined"
              :min="0"
              :max="step.mode === 'percent' ? 100 : undefined"
              @update:model-value="updateStep(step.id, 'value', Number($event || 0))"
            />
          </label>
        </div>

        <Slider
          v-if="step.mode === 'percent'"
          :model-value="step.value"
          class="mt-3"
          :min="0"
          :max="100"
          :step="1"
          @update:model-value="updateStep(step.id, 'value', Number($event || 0))"
        />

        <div class="mt-3 grid grid-cols-1 gap-2 text-sm text-surface-dark/65 md:grid-cols-3">
          <div class="rounded-xl bg-white px-3 py-2">
            <span class="block text-xs uppercase tracking-wide text-surface-dark/40">Part</span>
            <strong class="font-heading text-surface-dark">
              {{ calculatePaymentScheduleStepAmounts(step, subtotal, totalWithVat).percent.toFixed(2) }} %
            </strong>
          </div>
          <div class="rounded-xl bg-white px-3 py-2">
            <span class="block text-xs uppercase tracking-wide text-surface-dark/40">Montant HT</span>
            <strong class="font-heading text-surface-dark">
              {{ formatCurrency(calculatePaymentScheduleStepAmounts(step, subtotal, totalWithVat).amountExcl, currencyLocale) }}
            </strong>
          </div>
          <div class="rounded-xl bg-white px-3 py-2">
            <span class="block text-xs uppercase tracking-wide text-surface-dark/40">Montant TTC</span>
            <strong class="font-heading text-surface-dark">
              {{ formatCurrency(calculatePaymentScheduleStepAmounts(step, subtotal, totalWithVat).amountIncl, currencyLocale) }}
            </strong>
          </div>
        </div>
      </div>
    </div>

    <div
      class="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-surface-dark/8 bg-surface-light px-4 py-3 text-sm"
    >
      <div>
        <span class="text-surface-dark/55">Couverture de l’échéancier</span>
        <strong class="ml-2 font-heading text-surface-dark">
          {{ totalPercent().toFixed(2) }} %
        </strong>
      </div>
      <Button
        type="button"
        severity="secondary"
        text
        class="!rounded-xl"
        label="Répartir équitablement"
        @click="emit('update:modelValue', resizePaymentSchedule([], modelValue.length || 1))"
      >
        <template #icon>
          <span class="material-symbols-outlined text-base">auto_fix</span>
        </template>
      </Button>
    </div>
  </div>
</template>
