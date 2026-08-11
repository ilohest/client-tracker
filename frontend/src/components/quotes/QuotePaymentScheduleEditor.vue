<script setup lang="ts">
import type {
  QuotePaymentScheduleDisplay,
  QuotePaymentScheduleStep,
} from "@client-tracker/contracts";
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import SelectButton from "primevue/selectbutton";
import Slider from "primevue/slider";
import Textarea from "primevue/textarea";
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

const displayOptions: Array<{
  label: string;
  value: QuotePaymentScheduleDisplay;
}> = [
  { label: "Tableau", value: "table" },
  { label: "Texte", value: "text" },
];

const modeOptions: Array<{
  label: string;
  value: QuotePaymentScheduleStep["mode"];
}> = [
  { label: "%", value: "percent" },
  { label: "€", value: "fixed" },
];

const updateCount = (count: number | null | undefined) => {
  emit(
    "update:modelValue",
    resizePaymentSchedule(props.modelValue, Number(count || 1)),
  );
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
  <div
    class="rounded-3xl border border-surface-dark/5 bg-white p-5 shadow-[0_8px_24px_rgba(33,35,54,0.06)]"
  >
    <div class="mb-4 flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="font-heading font-bold text-surface-dark">
          Échéancier de paiement
        </h3>
        <p class="mt-1 text-sm text-surface-dark/55">
          Choisis un tableau calculé ou un texte libre pour le PDF.
        </p>
      </div>
      <div class="ml-auto flex shrink-0 items-center gap-0.5">
        <slot name="headerActions" />
      </div>
    </div>

    <div class="mb-4 flex flex-wrap items-center justify-between gap-3 border-t border-surface-dark/6 pt-4">
      <div class="flex min-w-0 items-center gap-3">
        <span class="text-xs font-medium uppercase tracking-wide text-surface-dark/45">
          Affichage
        </span>
        <SelectButton
          :model-value="displayMode"
          :options="displayOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          @update:model-value="emit('update:displayMode', $event)"
        />
      </div>
      <label v-if="displayMode === 'table'" class="flex items-center gap-3">
        <span class="text-sm font-medium text-surface-dark/60">Nombre d’étapes</span>
        <InputNumber
          :model-value="modelValue.length || 1"
          :min="1"
          :max="12"
          show-buttons
          button-layout="horizontal"
          class="w-32"
          input-class="w-12 text-center font-semibold"
          @update:model-value="updateCount"
        />
      </label>
    </div>

    <div v-if="displayMode === 'table'" class="space-y-3">
      <div
        v-for="(step, index) in modelValue"
        :key="step.id"
        class="rounded-2xl border border-surface-dark/8 bg-white p-4 shadow-[0_3px_12px_rgba(33,35,54,0.04)]"
      >
        <div
          class="grid grid-cols-1 gap-3 md:grid-cols-[auto_minmax(0,1fr)] md:items-end lg:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,170px)]"
        >
          <span
            class="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 font-heading text-sm font-bold text-primary"
          >
            {{ String(index + 1).padStart(2, "0") }}
          </span>
          <label class="flex min-w-0 flex-col gap-1.5">
            <span
              class="text-xs font-semibold uppercase tracking-[0.08em] text-surface-dark/40"
            >
              Étape de paiement
            </span>
            <InputText
              :model-value="step.label"
              class="w-full"
              placeholder="Ex: Acompte à la validation"
              @update:model-value="updateStep(step.id, 'label', $event || '')"
            />
          </label>
          <label class="flex flex-col gap-1.5">
            <span
              class="text-xs font-semibold uppercase tracking-[0.08em] text-surface-dark/40"
            >
              Calcul
            </span>
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
            <span
              class="text-xs font-semibold uppercase tracking-[0.08em] text-surface-dark/40"
            >
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
              input-class="w-full text-right font-semibold"
              class="w-full"
              @update:model-value="
                updateStep(step.id, 'value', Number($event || 0))
              "
            />
          </label>
        </div>

        <Slider
          v-if="step.mode === 'percent'"
          :model-value="step.value"
          class="mx-1 mt-4"
          :min="0"
          :max="100"
          :step="1"
          @update:model-value="
            updateStep(step.id, 'value', Number($event || 0))
          "
        />

        <div class="mt-4 grid grid-cols-1 border-t border-surface-dark/8 pt-3 text-sm sm:grid-cols-3 sm:divide-x sm:divide-surface-dark/8">
          <div class="px-3 py-1 first:pl-1">
            <span
              class="block text-[11px] font-medium uppercase tracking-[0.08em] text-surface-dark/40"
              >Part effective</span
            >
            <strong class="mt-0.5 block font-heading text-surface-dark">
              {{
                calculatePaymentScheduleStepAmounts(
                  step,
                  subtotal,
                  totalWithVat,
                ).percent.toFixed(2)
              }}
              %
            </strong>
          </div>
          <div class="px-3 py-1">
            <span
              class="block text-[11px] font-medium uppercase tracking-[0.08em] text-surface-dark/40"
              >Montant HT</span
            >
            <strong class="mt-0.5 block font-heading text-surface-dark">
              {{
                formatCurrency(
                  calculatePaymentScheduleStepAmounts(
                    step,
                    subtotal,
                    totalWithVat,
                  ).amountExcl,
                  currencyLocale,
                )
              }}
            </strong>
          </div>
          <div class="px-3 py-1">
            <span
              class="block text-[11px] font-medium uppercase tracking-[0.08em] text-surface-dark/40"
              >Montant TTC</span
            >
            <strong class="mt-0.5 block font-heading text-surface-dark">
              {{
                formatCurrency(
                  calculatePaymentScheduleStepAmounts(
                    step,
                    subtotal,
                    totalWithVat,
                  ).amountIncl,
                  currencyLocale,
                )
              }}
            </strong>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="displayMode === 'table'"
      class="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/15 bg-primary/[0.04] px-4 py-3"
    >
      <div>
        <span class="block text-xs font-medium uppercase tracking-[0.08em] text-surface-dark/40">Total réparti</span>
        <strong class="font-heading text-lg text-surface-dark">{{ totalPercent().toFixed(2) }} %</strong>
      </div>
      <Button
        type="button"
        severity="secondary"
        outlined
        size="small"
        class="!rounded-xl"
        label="Répartir équitablement"
        @click="
          emit(
            'update:modelValue',
            resizePaymentSchedule([], modelValue.length || 1),
          )
        "
      >
        <template #icon>
          <span class="material-symbols-outlined text-base">auto_fix</span>
        </template>
      </Button>
    </div>

    <label v-else class="flex flex-col gap-2 rounded-2xl border border-surface-dark/8 bg-surface-light/60 p-4">
      <span class="font-heading font-semibold text-surface-dark">Texte affiché dans le PDF</span>
      <span class="text-xs text-surface-dark/50">Présente librement les modalités, acomptes et échéances.</span>
      <Textarea
        :model-value="text"
        rows="6"
        auto-resize
        class="w-full bg-white"
        placeholder="Ex. 50 % à la signature du devis, puis 50 % à la livraison."
        @update:model-value="emit('update:text', $event || '')"
      />
    </label>
  </div>
</template>
