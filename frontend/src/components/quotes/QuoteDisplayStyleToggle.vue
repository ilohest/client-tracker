<script setup lang="ts">
import type { QuotePartDisplayStyle } from "@client-tracker/contracts";

const props = defineProps<{
  modelValue: QuotePartDisplayStyle;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: QuotePartDisplayStyle];
}>();

const toggle = () => {
  emit("update:modelValue", props.modelValue === "framed" ? "flow" : "framed");
};
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue === 'framed'"
    :aria-label="`Affichage ${modelValue === 'framed' ? 'encadré' : 'fluide'}`"
    title="Basculer entre l’affichage fluide et encadré"
    class="mr-1 inline-flex h-8 items-center gap-2 rounded-full px-2 text-[11px] font-medium text-surface-dark/55 transition-colors hover:bg-surface-dark/[0.04] hover:text-surface-dark/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
    @click="toggle"
  >
    <span>{{ modelValue === "framed" ? "Encadré" : "Fluide" }}</span>
    <span
      class="relative h-4 w-7 shrink-0 rounded-full transition-colors"
      :class="modelValue === 'framed' ? 'bg-primary/70' : 'bg-surface-dark/15'"
      aria-hidden="true"
    >
      <span
        class="absolute left-0.5 top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-transform"
        :class="modelValue === 'framed' ? 'translate-x-3' : 'translate-x-0'"
      />
    </span>
  </button>
</template>
