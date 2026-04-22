<script setup lang="ts">
import { computed } from 'vue';
import Select from 'primevue/select';
import { countryOptions } from '@/lib/countries';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
  }>(),
  {
    placeholder: 'Sélectionner un pays',
  },
);

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const selectedCountry = computed(
  () => countryOptions.find((country) => country.value === props.modelValue) || null,
);
</script>

<template>
  <Select
    :model-value="modelValue"
    :options="countryOptions"
    option-label="label"
    option-value="value"
    filter
    :placeholder="placeholder"
    class="w-full"
    @update:model-value="emit('update:modelValue', $event || '')"
  >
    <template #value>
      <div v-if="selectedCountry" class="flex items-center gap-2">
        <span class="text-base">{{ selectedCountry.flag }}</span>
        <span>{{ selectedCountry.label }}</span>
      </div>
      <span v-else class="text-surface-dark/45">{{ placeholder }}</span>
    </template>

    <template #option="{ option }">
      <div class="flex items-center gap-2">
        <span class="text-base">{{ option.flag }}</span>
        <span>{{ option.label }}</span>
      </div>
    </template>
  </Select>
</template>
