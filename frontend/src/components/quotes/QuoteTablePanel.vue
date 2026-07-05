<script setup lang="ts">
import type { Client, Quote, QuoteStatus } from '@client-tracker/contracts';
import Button from 'primevue/button';
import DatePicker from 'primevue/datepicker';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { formatCurrency, formatQuoteDate, getQuotePlatformLabel } from '@/utils/quote';
import { formatDateTime } from '@/utils/date';
import { quoteStatusMeta, quoteStatusOptions } from '@/lib/clientPresets';

defineProps<{
  quotes: Quote[];
  clients: Client[];
  search: string;
  filterClientId: string;
  filterDateRange: Date[] | null;
  filterStatus: QuoteStatus | '';
}>();

const emit = defineEmits<{
  create: [];
  select: [id: string];
  'update:search': [value: string];
  'update:filterClientId': [value: string];
  'update:filterDateRange': [value: Date[] | null];
  'update:filterStatus': [value: QuoteStatus | ''];
}>();
</script>

<template>
  <section class="rounded-3xl border border-surface-dark/5 bg-surface-card p-4 shadow-sm">
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-3">
        <div>
          <p class="text-sm font-semibold text-surface-dark">Liste des devis</p>
          <p class="text-xs text-surface-dark/55">Vue compacte pour retrouver rapidement un devis.</p>
        </div>
        <Button class="!rounded-xl !px-4 !py-3 font-semibold shadow-sm" @click="emit('create')" label="Nouveau devis">
          <template #icon><span class="material-symbols-outlined text-lg">add</span></template></Button>
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InputText
          :model-value="search"
          placeholder="Rechercher un devis"
          @update:model-value="emit('update:search', $event || '')"
        />
        <Select
          :model-value="filterStatus"
          :options="quoteStatusOptions"
          option-label="label"
          option-value="value"
          placeholder="Filtrer par statut"
          show-clear
          @update:model-value="emit('update:filterStatus', $event || '')"
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
          :model-value="filterDateRange"
          selection-mode="range"
          :manual-input="false"
          date-format="dd/mm/yy"
          show-icon
          icon-display="input"
          show-button-bar
          placeholder="Filtrer par période"
          @update:model-value="emit('update:filterDateRange', Array.isArray($event) ? $event.filter(Boolean) as Date[] : null)"
        />
      </div>
    </div>

    <div class="mt-4 overflow-x-auto rounded-2xl border border-surface-dark/6 bg-white">
      <table class="min-w-full text-left">
        <thead class="border-b border-surface-dark/6 bg-surface-light">
          <tr class="text-xs uppercase tracking-wide text-surface-dark/50">
            <th class="px-4 py-3 font-medium">Devis</th>
            <th class="px-4 py-3 font-medium">Client</th>
            <th class="px-4 py-3 font-medium">Date</th>
            <th class="px-4 py-3 font-medium">Statut</th>
            <th class="px-4 py-3 font-medium text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="quotes.length === 0">
            <td colspan="5" class="px-4 py-8 text-center text-sm text-surface-dark/55">
              Aucun devis ne correspond.
            </td>
          </tr>
          <tr
            v-for="quote in quotes"
            :key="quote.id"
            class="cursor-pointer border-b border-surface-dark/6 last:border-b-0 hover:bg-surface-light/70"
            @click="emit('select', quote.id)"
          >
            <td class="px-4 py-4 align-top">
              <div class="min-w-[210px]">
                <p class="font-heading font-semibold text-surface-dark">
                  {{ quote.title || quote.clientName || 'Devis sans titre' }}
                </p>
                <p class="mt-1 text-xs text-surface-dark/55">
                  {{ quote.quoteRef }}
                  <span v-if="(quote.version || 1) > 1" class="ml-1 font-semibold">v{{ quote.version }}</span>
                </p>
                <p class="mt-2 text-xs capitalize text-surface-dark/55">
                  {{ getQuotePlatformLabel(quote.platform, quote.customPlatformLabel) }}
                </p>
              </div>
            </td>
            <td class="px-4 py-4 align-top text-sm text-surface-dark/75">
              {{ quote.clientName || 'Aucun client' }}
            </td>
            <td class="px-4 py-4 align-top text-sm text-surface-dark/75">
              <div class="min-w-[150px]">
                <p>{{ quote.quoteDate ? formatQuoteDate(quote.quoteDate) : 'Non renseignée' }}</p>
                <p class="mt-1 text-xs text-surface-dark/45">
                  Modifié : {{ formatDateTime(quote.updatedAt || quote.createdAt) }}
                </p>
              </div>
            </td>
            <td class="px-4 py-4 align-top">
              <span
                class="inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
                :class="quoteStatusMeta[quote.status].tagClass"
                >{{ quoteStatusMeta[quote.status].label }}</span
              >
            </td>
            <td class="px-4 py-4 align-top text-right text-sm font-bold text-surface-dark">
              {{ formatCurrency(quote.totalWithVat) }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
