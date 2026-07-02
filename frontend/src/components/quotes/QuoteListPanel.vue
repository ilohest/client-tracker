<script setup lang="ts">
import type { Client, Quote, QuoteStatus } from '@client-tracker/contracts';
import Button from 'primevue/button';
import DatePicker from 'primevue/datepicker';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { formatCurrency, getQuotePlatformLabel } from '@/utils/quote';
import { quoteStatusMeta, quoteStatusOptions } from '@/lib/clientPresets';

defineProps<{
  quotes: Quote[];
  selectedQuoteId: string | null;
  clients: Client[];
  search: string;
  filterClientId: string;
  filterDate: Date | null;
  filterStatus: QuoteStatus | '';
}>();

const emit = defineEmits<{
  select: [id: string];
  create: [];
  'update:search': [value: string];
  'update:filterClientId': [value: string];
  'update:filterDate': [value: Date | null];
  'update:filterStatus': [value: QuoteStatus | ''];
}>();
</script>

<template>
  <section
    class="bg-surface-card border border-surface-dark/5 rounded-3xl p-4 h-full xl:sticky xl:top-6 xl:self-start xl:max-h-[85vh] xl:overflow-y-auto"
  >
    <div class="sticky top-0 z-10 bg-surface-card pb-4">
      <Button
        class="mb-4 w-full !justify-center !rounded-xl !py-3 font-semibold shadow-sm"
        @click="emit('create')"
      >
        <template #icon><span class="material-symbols-outlined text-lg">post_add</span></template>
        Nouveau devis
      </Button>

      <div class="flex flex-col gap-2.5">
        <InputText
          :model-value="search"
          placeholder="Rechercher un devis"
          class="w-full"
          @update:model-value="emit('update:search', $event || '')"
        />
        <div class="grid grid-cols-2 gap-2.5">
          <Select
            :model-value="filterStatus"
            :options="quoteStatusOptions"
            option-label="label"
            option-value="value"
            placeholder="Statut"
            show-clear
            class="w-full"
            @update:model-value="emit('update:filterStatus', $event || '')"
          />
          <Select
            :model-value="filterClientId"
            :options="clients.map((client) => ({ label: client.name, value: client.id }))"
            option-label="label"
            option-value="value"
            placeholder="Client"
            show-clear
            class="w-full"
            @update:model-value="emit('update:filterClientId', $event || '')"
          />
        </div>
        <DatePicker
          :model-value="filterDate"
          date-format="dd/mm/yy"
          show-icon
          icon-display="input"
          show-button-bar
          placeholder="Filtrer par date"
          class="w-full"
          @update:model-value="emit('update:filterDate', $event instanceof Date ? $event : null)"
        />
      </div>
    </div>

    <div class="flex flex-col gap-2.5">
      <button
        v-for="quote in quotes"
        :key="quote.id"
        type="button"
        class="w-full rounded-2xl border p-3.5 text-left transition-all duration-150"
        :class="
          selectedQuoteId === quote.id
            ? 'border-primary/30 bg-primary/8 ring-1 ring-primary/20'
            : 'border-surface-dark/8 bg-white hover:border-primary/25 hover:shadow-sm'
        "
        @click="emit('select', quote.id)"
      >
        <div class="flex items-start justify-between gap-3">
          <p class="min-w-0 flex-1 truncate font-heading font-bold text-surface-dark">
            {{ quote.title || quote.clientName || 'Devis sans titre' }}
          </p>
          <span
            class="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-5"
            :class="quoteStatusMeta[quote.status].tagClass"
            >{{ quoteStatusMeta[quote.status].label }}</span
          >
        </div>

        <div class="mt-0.5 flex items-center gap-1.5 text-xs text-surface-dark/50">
          <span class="truncate">{{ quote.quoteRef }}</span>
          <span
            v-if="(quote.version || 1) > 1"
            class="rounded bg-surface-dark/8 px-1.5 py-0.5 font-semibold text-surface-dark/70"
            >v{{ quote.version }}</span
          >
        </div>

        <div class="mt-3 flex items-center justify-between border-t border-surface-dark/5 pt-2.5">
          <span
            v-if="getQuotePlatformLabel(quote.platform, quote.customPlatformLabel)"
            class="inline-flex items-center gap-1 text-xs capitalize text-surface-dark/55"
          >
            <span class="material-symbols-outlined text-sm">devices</span>
            {{ getQuotePlatformLabel(quote.platform, quote.customPlatformLabel) }}
          </span>
          <span v-else></span>
          <span class="font-heading text-sm font-bold text-surface-dark">
            {{ formatCurrency(quote.totalWithVat) }}
          </span>
        </div>
      </button>

      <div
        v-if="quotes.length === 0"
        class="rounded-2xl border border-dashed border-surface-dark/12 p-6 text-center text-sm text-surface-dark/50"
      >
        <span class="material-symbols-outlined mb-1 block text-2xl text-surface-dark/25">
          receipt_long
        </span>
        Aucun devis ne correspond.
      </div>
    </div>
  </section>
</template>
