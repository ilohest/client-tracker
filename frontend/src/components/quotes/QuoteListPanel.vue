<script setup lang="ts">
import type { Client, Quote, QuoteStatus } from '@client-tracker/contracts';
import Button from 'primevue/button';
import DatePicker from 'primevue/datepicker';
import InputText from 'primevue/inputtext';
import Select from 'primevue/select';
import { formatCurrency, getQuotePlatformLabel } from '@/utils/quote';
import { formatDateTime } from '@/utils/date';
import { quoteStatusMeta, quoteStatusOptions } from '@/lib/clientPresets';

defineProps<{
  quotes: Quote[];
  selectedQuoteId: string | null;
  clients: Client[];
  search: string;
  filterClientId: string;
  filterDateRange: Date[] | null;
  filterStatus: QuoteStatus | '';
  compact?: boolean;
}>();

const emit = defineEmits<{
  select: [id: string];
  create: [];
  'update:search': [value: string];
  'update:filterClientId': [value: string];
  'update:filterDateRange': [value: Date[] | null];
  'update:filterStatus': [value: QuoteStatus | ''];
}>();
</script>

<template>
  <section
    class="bg-surface-card border border-surface-dark/5 rounded-3xl h-full xl:sticky xl:top-6 xl:self-start xl:max-h-[85vh] xl:overflow-y-auto"
    :class="compact ? 'p-2' : 'p-4'"
  >
    <div class="sticky top-0 z-10 bg-surface-card" :class="compact ? 'pb-2' : 'pb-4'">
      <Button
        class="w-full !justify-center !rounded-xl font-semibold shadow-sm"
        :class="compact ? 'mb-2 !px-0 !py-3' : 'mb-4 !py-3'"
        @click="emit('create')"
        :label="compact ? '' : 'Nouveau devis'"
        :title="compact ? 'Nouveau devis' : undefined"
        :aria-label="compact ? 'Nouveau devis' : undefined">
        <template #icon><span class="material-symbols-outlined text-lg">post_add</span></template></Button>

      <div v-if="!compact" class="flex flex-col gap-2.5">
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
          >
            <template #value="{ value, placeholder }">
              <span
                v-if="value"
                class="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                :class="quoteStatusMeta[value as QuoteStatus].tagClass"
                >{{ quoteStatusMeta[value as QuoteStatus].label }}</span
              >
              <span v-else>{{ placeholder }}</span>
            </template>
            <template #option="{ option }">
              <span
                class="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                :class="quoteStatusMeta[option.value as QuoteStatus].tagClass"
                >{{ option.label }}</span
              >
            </template>
          </Select>
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
          :model-value="filterDateRange"
          selection-mode="range"
          :manual-input="false"
          date-format="dd/mm/yy"
          show-icon
          icon-display="input"
          show-button-bar
          placeholder="Filtrer par période"
          class="w-full"
          @update:model-value="emit('update:filterDateRange', Array.isArray($event) ? $event.filter(Boolean) as Date[] : null)"
        />
      </div>
    </div>

    <div class="flex flex-col" :class="compact ? 'gap-2' : 'gap-2.5'">
      <button
        v-for="quote in quotes"
        :key="quote.id"
        type="button"
        class="w-full rounded-2xl border text-left transition-all duration-150"
        :class="[
          compact ? 'flex h-14 items-center justify-center p-0' : 'p-3.5',
          selectedQuoteId === quote.id
            ? 'border-primary/30 bg-primary/8 ring-1 ring-primary/20'
            : 'border-surface-dark/8 bg-white hover:border-primary/25 hover:shadow-sm',
        ]"
        :title="compact ? quote.title || quote.clientName || quote.quoteRef || 'Devis sans titre' : undefined"
        @click="emit('select', quote.id)"
      >
        <template v-if="compact">
          <span
            class="material-symbols-outlined"
            :class="selectedQuoteId === quote.id ? 'text-primary' : 'text-surface-dark/45'"
            >receipt_long</span
          >
        </template>
        <template v-else>
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
        <p class="mt-2 text-[11px] leading-4 text-surface-dark/45">
          Modifié : {{ formatDateTime(quote.updatedAt || quote.createdAt) }}
        </p>

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
        </template>
      </button>

      <div
        v-if="quotes.length === 0"
        class="rounded-2xl border border-dashed border-surface-dark/12 text-center text-sm text-surface-dark/50"
        :class="compact ? 'p-3' : 'p-6'"
      >
        <span class="material-symbols-outlined mb-1 block text-2xl text-surface-dark/25">
          receipt_long
        </span>
        Aucun devis ne correspond.
      </div>
    </div>
  </section>
</template>
