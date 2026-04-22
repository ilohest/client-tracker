<script setup lang="ts">
import type { Client, Quote } from '@client-tracker/contracts';
import Button from 'primevue/button';
import DatePicker from 'primevue/datepicker';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { getQuotePlatformLabel } from '@/utils/quote';

defineProps<{
  quotes: Quote[];
  selectedQuoteId: string | null;
  clients: Client[];
  search: string;
  filterClientId: string;
  filterDate: Date | null;
}>();

const emit = defineEmits<{
  select: [id: string];
  create: [];
  duplicate: [id: string];
  'update:search': [value: string];
  'update:filterClientId': [value: string];
  'update:filterDate': [value: Date | null];
}>();
</script>

<template>
  <section class="bg-surface-card border border-surface-dark/5 rounded-3xl p-5 h-full xl:sticky xl:top-6 xl:self-start xl:max-h-[85vh] xl:overflow-y-auto">
    <div class="sticky top-0 z-10 bg-surface-card pb-4">
      <div class="flex items-center justify-between gap-3 mb-4">
        <Button
          class="w-full !justify-center !rounded-2xl !px-4 !py-3 font-semibold shadow-sm"
          @click="emit('create')"
        >
          <template #icon><span class="material-symbols-outlined text-lg">post_add</span></template>
          Nouveau devis
        </Button>
      </div>

      <div class="flex flex-col gap-3">
        <InputText
          :model-value="search"
          placeholder="Rechercher un devis"
          @update:model-value="emit('update:search', $event || '')"
        />
        <Select
          :model-value="filterClientId"
          :options="clients.map((client) => ({ label: client.name, value: client.id }))"
          option-label="label"
          option-value="value"
          placeholder="Filtrer par client"
          show-clear
          @update:model-value="emit('update:filterClientId', $event || '')"
        />
        <DatePicker
          :model-value="filterDate"
          date-format="dd/mm/yy"
          show-icon
          icon-display="input"
          placeholder="Filtrer par date"
          @update:model-value="emit('update:filterDate', $event instanceof Date ? $event : null)"
        />
      </div>
    </div>

    <div class="flex flex-col gap-3 mt-4">
      <div>
        <button
        v-for="quote in quotes"
        :key="quote.id"
        class="w-full rounded-2xl border p-4 text-left transition-all"
        :class="
          selectedQuoteId === quote.id
            ? 'bg-primary/10 border-primary/20'
            : 'bg-white border-surface-dark/8 hover:border-primary/15'
        "
        @click="emit('select', quote.id)"
        >
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="font-heading font-bold text-surface-dark truncate">{{ quote.title || quote.clientName || 'Devis sans titre' }}</p>
            <p class="text-sm text-surface-dark/55 truncate">{{ quote.quoteRef }}</p>
          </div>
          <div class="flex items-center gap-2">
            <Button
              text
              severity="secondary"
              @click.stop="emit('duplicate', quote.id)"
            >
              <template #icon><span class="material-symbols-outlined text-lg">content_copy</span></template>
              Dupliquer
            </Button>
            <Tag :value="quote.status" class="!bg-surface-dark/8 !text-surface-dark" rounded />
          </div>
        </div>
        <div class="flex items-center justify-between mt-4 text-xs text-surface-dark/60">
          <span>{{ getQuotePlatformLabel(quote.platform, quote.customPlatformLabel) }}</span>
          <span>{{ quote.totalWithVat.toFixed(2) }} €</span>
        </div>
        </button>

        <div
        v-if="quotes.length === 0"
        class="rounded-2xl border border-dashed border-surface-dark/10 p-5 text-sm text-surface-dark/55"
        >
          Aucun devis pour l’instant.
        </div>
      </div>
    </div>
  </section>
</template>
