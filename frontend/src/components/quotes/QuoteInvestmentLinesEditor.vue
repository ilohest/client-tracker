<script setup lang="ts">
import type {
  QuoteInvestmentLine,
  QuotePart,
} from "@client-tracker/contracts";
import Button from "primevue/button";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import SelectButton from "primevue/selectbutton";
import { computed } from "vue";
import {
  calculateInvestmentLineAmount,
  calculateInvestmentLinesTotal,
  createInvestmentLine,
  formatCurrency,
  investmentLinesFromParts,
} from "@/utils/quote";

const props = withDefaults(
  defineProps<{
    modelValue: QuoteInvestmentLine[];
    investmentAmount?: number;
    parts?: QuotePart[];
    currencyLocale?: string;
  }>(),
  {
    investmentAmount: 0,
    parts: () => [],
    currencyLocale: "fr-FR",
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: QuoteInvestmentLine[]];
}>();

const modeOptions: Array<{ label: string; value: QuoteInvestmentLine["mode"] }> = [
  { label: "€", value: "fixed" },
  { label: "%", value: "percent" },
];

const linesTotal = computed(() =>
  calculateInvestmentLinesTotal(props.modelValue, props.investmentAmount),
);

// Le total facturé reste le Prix global HT s'il est renseigné : on signale
// quand la somme des lignes ne le retrouve pas, pour éviter les incohérences.
const hasGlobalAmount = computed(() => Number(props.investmentAmount || 0) > 0);
const totalMismatch = computed(
  () =>
    hasGlobalAmount.value &&
    Math.abs(linesTotal.value - Number(props.investmentAmount || 0)) >= 0.01,
);

const lineAmount = (line: QuoteInvestmentLine) =>
  calculateInvestmentLineAmount(line, props.investmentAmount);

const updateLine = <K extends keyof QuoteInvestmentLine>(
  id: string,
  field: K,
  value: QuoteInvestmentLine[K],
) => {
  emit(
    "update:modelValue",
    props.modelValue.map((line) =>
      line.id === id ? { ...line, [field]: value } : line,
    ),
  );
};

const addLine = () => {
  emit("update:modelValue", [...props.modelValue, createInvestmentLine()]);
};

const removeLine = (id: string) => {
  emit(
    "update:modelValue",
    props.modelValue.filter((line) => line.id !== id),
  );
};

const importParts = () => {
  emit("update:modelValue", [
    ...props.modelValue,
    ...investmentLinesFromParts(props.parts),
  ]);
};

const clearLines = () => {
  emit("update:modelValue", []);
};
</script>

<template>
  <div class="rounded-2xl border border-surface-dark/8 bg-surface-light p-4">
    <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
      <div>
        <span class="text-sm font-semibold text-surface-dark">
          Lignes du tableau Investissement
        </span>
        <p class="mt-0.5 text-xs text-surface-dark/55">
          Détaille le tableau ligne par ligne. Une ligne en «&nbsp;%&nbsp;» est
          calculée sur le Prix global HT. Sans ligne, le tableau reprend les
          parties cochées.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          type="button"
          severity="secondary"
          text
          size="small"
          class="!rounded-xl"
          label="Importer les parties"
          :disabled="!parts.length"
          @click="importParts"
        >
          <template #icon>
            <span class="material-symbols-outlined text-base">download</span>
          </template>
        </Button>
        <Button
          v-if="modelValue.length"
          type="button"
          severity="secondary"
          text
          size="small"
          class="!rounded-xl"
          label="Tout effacer"
          @click="clearLines"
        >
          <template #icon>
            <span class="material-symbols-outlined text-base">backspace</span>
          </template>
        </Button>
      </div>
    </div>

    <p
      v-if="!modelValue.length"
      class="rounded-xl border border-dashed border-surface-dark/15 bg-white px-3 py-4 text-center text-xs text-surface-dark/55"
    >
      Aucune ligne personnalisée — le tableau utilise les parties cochées (ou le
      Prix global HT). Ajoute une ligne pour prendre la main.
    </p>

    <div v-else class="space-y-2.5">
      <div
        v-for="line in modelValue"
        :key="line.id"
        class="grid grid-cols-1 items-center gap-2.5 rounded-xl border border-surface-dark/8 bg-white p-2.5 md:grid-cols-[minmax(0,1fr)_auto_6.5rem_7rem_2rem]"
      >
        <InputText
          :model-value="line.label"
          class="w-full min-w-0"
          placeholder="Ex: Nom de domaine (1ʳᵉ année)"
          @update:model-value="updateLine(line.id, 'label', $event || '')"
        />
        <SelectButton
          :model-value="line.mode"
          :options="modeOptions"
          option-label="label"
          option-value="value"
          :allow-empty="false"
          @update:model-value="updateLine(line.id, 'mode', $event)"
        />
        <InputNumber
          :model-value="line.value"
          :mode="line.mode === 'fixed' ? 'currency' : 'decimal'"
          :currency="line.mode === 'fixed' ? 'EUR' : undefined"
          :locale="currencyLocale"
          :suffix="line.mode === 'percent' ? ' %' : undefined"
          :min="0"
          :max="line.mode === 'percent' ? 100 : undefined"
          :min-fraction-digits="0"
          :max-fraction-digits="2"
          input-class="w-full text-right"
          class="w-full min-w-0"
          @update:model-value="updateLine(line.id, 'value', Number($event || 0))"
        />
        <span
          class="min-w-0 truncate text-right font-heading text-sm font-bold tabular-nums"
          :class="line.mode === 'percent' ? 'text-primary' : 'text-surface-dark/45'"
          :title="line.mode === 'percent' ? 'Montant HT calculé sur le Prix global HT' : 'Montant HT'"
        >
          {{ formatCurrency(lineAmount(line), currencyLocale) }}
        </span>
        <Button
          type="button"
          text
          rounded
          severity="danger"
          class="!h-8 !w-8 shrink-0 justify-self-end !p-0"
          aria-label="Supprimer la ligne"
          title="Supprimer la ligne"
          @click="removeLine(line.id)"
        >
          <template #icon>
            <span class="material-symbols-outlined text-base">delete</span>
          </template>
        </Button>
      </div>
    </div>

    <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
      <Button
        type="button"
        severity="secondary"
        outlined
        size="small"
        class="!rounded-xl"
        label="Ajouter une ligne"
        @click="addLine"
      >
        <template #icon>
          <span class="material-symbols-outlined text-base">add</span>
        </template>
      </Button>
      <div
        v-if="modelValue.length"
        class="text-sm"
        :class="totalMismatch ? 'text-amber-600' : 'text-surface-dark/60'"
      >
        <span>Total des lignes&nbsp;:</span>
        <strong class="ml-1 font-heading text-surface-dark">
          {{ formatCurrency(linesTotal, currencyLocale) }}
        </strong>
        <span
          v-if="totalMismatch"
          class="ml-2 inline-flex items-center gap-1 text-xs"
          :title="`Prix global HT : ${formatCurrency(Number(investmentAmount || 0), currencyLocale)}`"
        >
          <span class="material-symbols-outlined text-sm">warning</span>
          ≠ Prix global HT ({{ formatCurrency(Number(investmentAmount || 0), currencyLocale) }})
        </span>
      </div>
    </div>
  </div>
</template>
