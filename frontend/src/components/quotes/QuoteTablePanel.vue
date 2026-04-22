<script setup lang="ts">
import type { Client, Quote } from '@client-tracker/contracts';
import Button from 'primevue/button';
import DatePicker from 'primevue/datepicker';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import Tag from 'primevue/tag';
import { formatQuoteDate, getQuotePlatformLabel } from '@/utils/quote';

defineProps<{
  quotes: Quote[];
  clients: Client[];
  search: string;
  filterClientId: string;
  filterDate: Date | null;
}>();

const emit = defineEmits<{
  create: [];
  select: [id: string];
  duplicate: [id: string];
  'update:search': [value: string];
  'update:filterClientId': [value: string];
  'update:filterDate': [value: Date | null];
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
        <Button class="!rounded-2xl !px-4 !py-3 font-semibold shadow-sm" @click="emit('create')">
          <template #icon><span class="material-symbols-outlined text-lg">post_add</span></template>
          Nouveau devis
        </Button>
      </div>

      <div class="grid grid-cols-1 gap-3">
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

    <div class="mt-4 overflow-x-auto rounded-2xl border border-surface-dark/6 bg-white">
      <table class="min-w-full text-left">
        <thead class="border-b border-surface-dark/6 bg-surface-light">
          <tr class="text-xs uppercase tracking-wide text-surface-dark/50">
            <th class="px-4 py-3 font-medium">Devis</th>
            <th class="px-4 py-3 font-medium">Client</th>
            <th class="px-4 py-3 font-medium">Date</th>
            <th class="px-4 py-3 font-medium">Statut</th>
            <th class="px-4 py-3 font-medium text-right">Total</th>
            <th class="px-4 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-if="quotes.length === 0">
            <td colspan="6" class="px-4 py-8 text-center text-sm text-surface-dark/55">
              Aucun devis pour l’instant.
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
                <p class="mt-1 text-xs text-surface-dark/55">{{ quote.quoteRef }}</p>
                <p class="mt-2 text-xs text-surface-dark/55">
                  {{ getQuotePlatformLabel(quote.platform, quote.customPlatformLabel) }}
                </p>
              </div>
            </td>
            <td class="px-4 py-4 align-top text-sm text-surface-dark/75">
              {{ quote.clientName || 'Aucun client' }}
            </td>
            <td class="px-4 py-4 align-top text-sm text-surface-dark/75">
              {{ quote.quoteDate ? formatQuoteDate(quote.quoteDate) : 'Non renseignée' }}
            </td>
            <td class="px-4 py-4 align-top">
              <Tag :value="quote.status" class="!bg-surface-dark/8 !text-surface-dark" rounded />
            </td>
            <td class="px-4 py-4 align-top text-right text-sm font-semibold text-surface-dark">
              {{ quote.totalWithVat.toFixed(2) }} €
            </td>
            <td class="px-4 py-4 align-top">
              <div class="flex justify-end">
                <Button text severity="secondary" @click.stop="emit('duplicate', quote.id)">
                  <template #icon><span class="material-symbols-outlined text-lg">content_copy</span></template>
                  Dupliquer
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
