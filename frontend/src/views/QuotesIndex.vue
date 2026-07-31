<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { Quote, QuoteStatus } from "@client-tracker/contracts";
import Button from "primevue/button";
import ConfirmDialog from "primevue/confirmdialog";
import DatePicker from "primevue/datepicker";
import InputText from "primevue/inputtext";
import Menu from "primevue/menu";
import Select from "primevue/select";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { quoteStatusMeta, quoteStatusOptions } from "@/lib/clientPresets";
import { useClientsStore } from "@/stores/clientsStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { toDateObj } from "@/utils/date";
import {
  calculateQuotePartsTotals,
  duplicateQuoteInput,
  formatCurrency,
  formatQuoteDate,
  getQuotePlatformLabel,
} from "@/utils/quote";
import type { QuoteSortField } from "@/utils/quoteFilters";
import {
  buildQuoteGroups,
  groupQuoteVersions,
  readQuoteListQuery,
  toIsoDay,
  writeQuoteListQuery,
} from "@/utils/quoteFilters";

/** Au-delà de ce délai, un devis envoyé sans réponse mérite une relance. */
const STALE_SENT_DAYS = 14;

const route = useRoute();
const router = useRouter();
const quotesStore = useQuotesStore();
const clientsStore = useClientsStore();
const confirm = useConfirm();
const toast = useToast();

const initialState = readQuoteListQuery(route.query);
const search = ref(initialState.search);
const filterStatus = ref<QuoteStatus | "">(initialState.status);
const filterClientId = ref(initialState.clientId);
const filterDateRange = ref<Date[] | null>(initialState.dateRange);
const sortField = ref<QuoteSortField>(initialState.sortField);
const sortDirection = ref(initialState.sortDirection);

const rowMenu = ref<InstanceType<typeof Menu> | null>(null);
const menuQuoteId = ref<string>("");
const expandedGroups = ref<Set<string>>(new Set());

const languageLabels: Record<string, string> = {
  fr: "Français",
  en: "Anglais",
  es: "Espagnol",
};

const listState = computed(() => ({
  search: search.value,
  status: filterStatus.value,
  clientId: filterClientId.value,
  dateRange: filterDateRange.value,
  sortField: sortField.value,
  sortDirection: sortDirection.value,
}));

const listQuery = computed(() => writeQuoteListQuery(listState.value));

watch(listQuery, (query) => {
  if (JSON.stringify(query) === JSON.stringify(route.query)) return;
  void router.replace({ name: "quotes", query });
});

onMounted(async () => {
  await Promise.all([quotesStore.fetchQuotes(), clientsStore.fetchClients()]);
});

const clientOptions = computed(() =>
  clientsStore.clients.map((client) => ({ label: client.name, value: client.id })),
);

const hasAnyQuote = computed(() => quotesStore.quotes.length > 0);

const activeFilters = computed(() => {
  const chips: Array<{ key: string; label: string; value: string; clear: () => void }> = [];
  if (search.value.trim()) {
    chips.push({
      key: "q",
      label: "Recherche",
      value: search.value.trim(),
      clear: () => (search.value = ""),
    });
  }
  if (filterStatus.value) {
    chips.push({
      key: "statut",
      label: "Statut",
      value: quoteStatusMeta[filterStatus.value].label,
      clear: () => (filterStatus.value = ""),
    });
  }
  if (filterClientId.value) {
    chips.push({
      key: "client",
      label: "Client",
      value:
        clientsStore.clients.find((client) => client.id === filterClientId.value)?.name ||
        "Client inconnu",
      clear: () => (filterClientId.value = ""),
    });
  }
  const [start, end] = filterDateRange.value || [];
  if (start) {
    chips.push({
      key: "periode",
      label: "Période",
      value: end
        ? `${formatQuoteDate(toIsoDay(start))} – ${formatQuoteDate(toIsoDay(end))}`
        : `À partir du ${formatQuoteDate(toIsoDay(start))}`,
      clear: () => (filterDateRange.value = null),
    });
  }
  return chips;
});

const clearAllFilters = () => {
  search.value = "";
  filterStatus.value = "";
  filterClientId.value = "";
  filterDateRange.value = null;
};

const sortedQuoteGroups = computed(() => buildQuoteGroups(quotesStore.quotes, listState.value));
const sortedQuotes = computed(() => sortedQuoteGroups.value.map((group) => group.latest));
const allQuoteGroups = computed(() => groupQuoteVersions(quotesStore.quotes));
const quoteGroupCount = computed(() => allQuoteGroups.value.length);

const filteredTotal = computed(() =>
  sortedQuotes.value.reduce((total, quote) => total + (quote.totalWithVat || 0), 0),
);

const pendingQuotes = computed(() =>
  allQuoteGroups.value.map((group) => group.latest).filter((quote) => quote.status === "sent"),
);

const pendingAmount = computed(() =>
  pendingQuotes.value.reduce((total, quote) => total + (quote.totalWithVat || 0), 0),
);

const toggleSort = (field: QuoteSortField) => {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === "desc" ? "asc" : "desc";
    return;
  }
  sortField.value = field;
  sortDirection.value = field === "client" ? "asc" : "desc";
};

const daysSince = (value: unknown): number | null => {
  const date = toDateObj(value);
  if (!date) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
};

/** Un devis envoyé et sans nouvelle depuis deux semaines : c'est une relance. */
const isAwaitingFollowUp = (quote: Quote): boolean => {
  if (quote.status !== "sent") return false;
  const days = daysSince(quote.updatedAt || quote.createdAt);
  return days !== null && days > STALE_SENT_DAYS;
};

const formatRelativeDays = (value: unknown): string => {
  const days = daysSince(value);
  if (days === null) return "—";
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 31) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  return months === 1 ? "il y a 1 mois" : `il y a ${months} mois`;
};

// On emporte l'état de liste : le détail navigue dans le même ordre filtré et
// le retour restaure exactement la vue qu'on vient de quitter.
const openQuote = (id: string) => {
  void router.push({ name: "quote-detail", params: { id }, query: listQuery.value });
};

const createQuote = () => {
  void router.push({ name: "quote-new", query: listQuery.value });
};

const menuQuote = computed(
  () => quotesStore.quotes.find((quote) => quote.id === menuQuoteId.value) || null,
);

const duplicateQuote = async (source: Quote) => {
  const payload = duplicateQuoteInput(source);
  const { subtotal, totalWithVat } = calculateQuotePartsTotals(
    payload.parts,
    payload.vatRate,
    payload.discountType || "percent",
    payload.discountValue || 0,
    payload.investmentAmount || 0,
  );
  const quote = await quotesStore.saveQuote(null, { ...payload, subtotal, totalWithVat });
  toast.add({
    severity: "success",
    summary: "Devis dupliqué",
    detail: "Un nouveau brouillon a été créé à partir du devis existant.",
    life: 2500,
  });
  openQuote(quote.id);
};

const confirmDelete = (quote: Quote) => {
  confirm.require({
    message: `Le devis ${quote.quoteRef} de ${quote.clientName} sera définitivement supprimé.`,
    header: "Supprimer ce devis ?",
    icon: "warning",
    rejectProps: { label: "Annuler", severity: "secondary", outlined: true },
    acceptProps: { label: "Supprimer", severity: "danger" },
    accept: async () => {
      await quotesStore.deleteQuote(quote.id);
      toast.add({
        severity: "secondary",
        summary: "Devis supprimé",
        detail: `${quote.quoteRef} a été retiré de la liste.`,
        life: 2500,
      });
    },
  });
};

const menuItems = computed(() => [
  {
    label: "Ouvrir",
    icon: "pi pi-arrow-up-right",
    command: () => menuQuote.value && openQuote(menuQuote.value.id),
  },
  {
    label: "Dupliquer",
    icon: "pi pi-copy",
    command: () => menuQuote.value && void duplicateQuote(menuQuote.value),
  },
  {
    label: "Supprimer",
    icon: "pi pi-trash",
    class: "text-rose-600",
    command: () => menuQuote.value && confirmDelete(menuQuote.value),
  },
]);

const openRowMenu = (event: Event, quoteId: string) => {
  menuQuoteId.value = quoteId;
  rowMenu.value?.toggle(event);
};

const toggleVersionHistory = (groupId: string) => {
  const next = new Set(expandedGroups.value);
  if (next.has(groupId)) next.delete(groupId);
  else next.add(groupId);
  expandedGroups.value = next;
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <ConfirmDialog />

    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="flex items-start gap-3">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <span class="material-symbols-outlined text-2xl text-primary">receipt_long</span>
        </span>
        <div>
          <h1 class="text-3xl font-heading font-bold text-surface-dark">Devis</h1>
          <p class="mt-1 text-sm text-surface-dark/55">
            {{ quoteGroupCount }} devis
            <template v-if="quotesStore.quotes.length !== quoteGroupCount">
              · {{ quotesStore.quotes.length }} versions
            </template>
            <template v-if="pendingQuotes.length">
              · {{ pendingQuotes.length }} en attente de réponse ·
              {{ formatCurrency(pendingAmount) }} en cours de négociation
            </template>
          </p>
        </div>
      </div>
      <Button label="Nouveau devis" @click="createQuote">
        <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
      </Button>
    </div>

    <section
      v-if="hasAnyQuote"
      class="rounded-3xl border border-surface-dark/5 bg-surface-card p-4 shadow-sm"
    >
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InputText v-model="search" placeholder="Rechercher un devis" />
        <Select
          v-model="filterStatus"
          :options="quoteStatusOptions"
          option-label="label"
          option-value="value"
          placeholder="Tous les statuts"
          show-clear
        >
          <template #value="{ value }">
            <span
              v-if="value"
              class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
              :class="quoteStatusMeta[value as QuoteStatus].tagClass"
            >
              {{ quoteStatusMeta[value as QuoteStatus].label }}
            </span>
            <span v-else class="text-surface-dark/50">Tous les statuts</span>
          </template>
          <template #option="{ option }">
            <span
              class="inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold"
              :class="quoteStatusMeta[option.value as QuoteStatus].tagClass"
            >
              {{ option.label }}
            </span>
          </template>
        </Select>
        <Select
          v-model="filterClientId"
          :options="clientOptions"
          option-label="label"
          option-value="value"
          placeholder="Tous les clients"
          show-clear
        />
        <DatePicker
          v-model="filterDateRange"
          selection-mode="range"
          :manual-input="false"
          date-format="dd/mm/yy"
          show-icon
          icon-display="input"
          show-button-bar
          placeholder="Filtrer par période"
        />
      </div>

      <div v-if="activeFilters.length" class="mt-3 flex flex-wrap items-center gap-2">
        <span class="text-[11px] font-semibold uppercase tracking-wider text-surface-dark/35">
          Filtres actifs
        </span>
        <span
          v-for="chip in activeFilters"
          :key="chip.key"
          class="inline-flex items-center gap-1.5 rounded-full bg-primary/10 py-1 pl-3 pr-1.5 text-xs font-semibold text-primary"
        >
          {{ chip.label }} <span class="text-surface-dark">{{ chip.value }}</span>
          <button
            type="button"
            class="flex items-center rounded-full p-0.5 opacity-70 transition hover:opacity-100"
            :aria-label="`Retirer le filtre ${chip.label}`"
            @click="chip.clear()"
          >
            <span class="material-symbols-outlined text-sm">close</span>
          </button>
        </span>
        <button
          type="button"
          class="px-1 py-1 text-xs text-surface-dark/55 underline underline-offset-4 hover:text-surface-dark"
          @click="clearAllFilters"
        >
          Tout effacer
        </button>
      </div>
    </section>

    <section
      v-if="!hasAnyQuote && !quotesStore.loading"
      class="flex flex-col items-center gap-2 rounded-3xl border border-surface-dark/5 bg-surface-card px-8 py-14 text-center shadow-sm"
    >
      <span class="mb-1 flex h-13 w-13 items-center justify-center rounded-2xl bg-surface-dark/6 p-3">
        <span class="material-symbols-outlined text-2xl text-surface-dark/35">post_add</span>
      </span>
      <h2 class="font-heading text-lg font-bold text-surface-dark">Créez votre premier devis</h2>
      <p class="max-w-md text-sm text-surface-dark/55">
        Partez d'un template de stack : la base commune, les conditions et la roadmap sont
        préremplies, il ne reste que le périmètre à chiffrer.
      </p>
      <Button class="mt-3" label="Nouveau devis" @click="createQuote">
        <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
      </Button>
    </section>

    <section
      v-else-if="!sortedQuotes.length && !quotesStore.loading"
      class="flex flex-col items-center gap-2 rounded-3xl border border-surface-dark/5 bg-surface-card px-8 py-14 text-center shadow-sm"
    >
      <span class="mb-1 flex h-13 w-13 items-center justify-center rounded-2xl bg-surface-dark/6 p-3">
        <span class="material-symbols-outlined text-2xl text-surface-dark/35">search_off</span>
      </span>
      <h2 class="font-heading text-lg font-bold text-surface-dark">Aucun devis ne correspond</h2>
      <p class="max-w-md text-sm text-surface-dark/55">
        {{ activeFilters.length }} filtre{{ activeFilters.length > 1 ? "s sont actifs" : " est actif" }} :
        {{ activeFilters.map((chip) => `${chip.label.toLowerCase()} ${chip.value}`).join(", ") }}.

      </p>
      <Button
        v-if="activeFilters.length"
        class="mt-3"
        severity="secondary"
        outlined
        label="Effacer les filtres"
        @click="clearAllFilters"
      />
    </section>

    <section
      v-else-if="sortedQuotes.length"
      class="overflow-hidden rounded-3xl border border-surface-dark/5 bg-surface-card shadow-sm"
    >
      <div class="overflow-x-auto">
        <table class="w-full min-w-[940px] border-collapse tabular-nums">
          <thead>
            <tr class="border-b border-surface-dark/12">
              <th
                v-for="column in [
                  { field: 'client' as QuoteSortField, label: 'Client', align: 'left' },
                  { field: null, label: 'Projet', align: 'left' },
                  { field: 'status' as QuoteSortField, label: 'Statut', align: 'left' },
                  { field: 'total' as QuoteSortField, label: 'Montant TTC', align: 'right' },
                  { field: 'quoteDate' as QuoteSortField, label: 'Date du devis', align: 'left' },
                  { field: 'updatedAt' as QuoteSortField, label: 'Modifié', align: 'left' },
                ]"
                :key="column.label"
                scope="col"
                class="sticky top-0 z-10 whitespace-nowrap bg-surface-card px-4 pb-3 pt-4 text-[11px] font-semibold uppercase tracking-wider first:pl-6"
                :class="[
                  column.align === 'right' ? 'text-right' : 'text-left',
                  sortField === column.field ? 'text-surface-dark/70' : 'text-surface-dark/35',
                ]"
              >
                <button
                  v-if="column.field"
                  type="button"
                  class="inline-flex items-center gap-1 uppercase transition hover:text-surface-dark"
                  @click="toggleSort(column.field)"
                >
                  {{ column.label }}
                  <span
                    v-if="sortField === column.field"
                    class="material-symbols-outlined text-sm"
                    aria-hidden="true"
                  >
                    {{ sortDirection === "desc" ? "arrow_downward" : "arrow_upward" }}
                  </span>
                </button>
                <span v-else>{{ column.label }}</span>
              </th>
              <th scope="col" class="sticky top-0 z-10 w-12 bg-surface-card pr-6"></th>
            </tr>
          </thead>
          <tbody>
            <template v-for="group in sortedQuoteGroups" :key="group.id">
            <tr
              class="group cursor-pointer border-b border-surface-dark/6 transition hover:bg-surface-dark/3"
              tabindex="0"
              @click="openQuote(group.latest.id)"
              @keydown.enter="openQuote(group.latest.id)"
            >
              <td class="px-4 py-3 pl-6">
                <div class="font-semibold text-surface-dark">{{ group.latest.clientName || "Client à définir" }}</div>
                <div class="mt-px font-mono text-[11.5px] text-surface-dark/55">
                  {{ group.latest.quoteRef }}
                  <span
                    v-if="group.versions.length > 1"
                    class="ml-1 rounded-md bg-surface-dark/8 px-1.5 py-px text-[10.5px] font-semibold text-surface-dark/70"
                  >
                    {{ group.versions.length }} versions · v{{ group.latest.version || 1 }} actuelle
                  </span>
                </div>
              </td>
              <td class="px-4 py-3">
                <div class="max-w-[260px] truncate text-[13.5px] text-surface-dark">
                  {{ group.latest.projectName || group.latest.title || "Projet sans titre" }}
                </div>
                <div class="mt-px text-xs text-surface-dark/55">
                  <template v-if="getQuotePlatformLabel(group.latest.platform, group.latest.customPlatformLabel)">
                    {{ getQuotePlatformLabel(group.latest.platform, group.latest.customPlatformLabel) }} ·
                  </template>
                  {{ languageLabels[group.latest.language] || group.latest.language }}
                </div>
              </td>
              <td class="px-4 py-3">
                <span
                  class="inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold"
                  :class="quoteStatusMeta[group.latest.status].tagClass"
                >
                  {{ quoteStatusMeta[group.latest.status].label }}
                </span>
              </td>
              <td
                class="whitespace-nowrap px-4 py-3 text-right font-semibold"
                :class="
                  ['draft', 'refused', 'superseded'].includes(group.latest.status)
                    ? 'font-medium text-surface-dark/55'
                    : 'text-surface-dark'
                "
              >
                {{ formatCurrency(group.latest.totalWithVat || 0) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-[13px] text-surface-dark/70">
                {{ group.latest.quoteDate ? formatQuoteDate(group.latest.quoteDate) : "—" }}
              </td>
              <td
                class="whitespace-nowrap px-4 py-3 text-[13px]"
                :class="
                  isAwaitingFollowUp(group.latest)
                    ? 'font-semibold text-amber-700'
                    : 'text-surface-dark/70'
                "
                :title="isAwaitingFollowUp(group.latest) ? 'Envoyé et sans réponse — à relancer' : undefined"
              >
                {{ formatRelativeDays(group.latest.updatedAt || group.latest.createdAt) }}
              </td>
              <td class="w-12 py-3 pr-6 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button
                    v-if="group.versions.length > 1"
                    type="button"
                    class="rounded-lg p-1.5 text-surface-dark/45 transition hover:bg-surface-dark/6 hover:text-surface-dark"
                    :aria-label="expandedGroups.has(group.id) ? 'Masquer les versions' : 'Afficher les versions'"
                    :aria-expanded="expandedGroups.has(group.id)"
                    @click.stop="toggleVersionHistory(group.id)"
                  >
                    <span class="material-symbols-outlined text-lg transition-transform" :class="expandedGroups.has(group.id) ? 'rotate-180' : ''">expand_more</span>
                  </button>
                  <button
                    type="button"
                    class="rounded-lg p-1.5 text-surface-dark/35 opacity-0 transition hover:bg-surface-dark/6 hover:text-surface-dark focus-visible:opacity-100 group-hover:opacity-100"
                    :aria-label="`Actions sur le devis ${group.latest.quoteRef}`"
                    @click.stop="openRowMenu($event, group.latest.id)"
                  >
                    <span class="material-symbols-outlined text-lg">more_vert</span>
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="group.versions.length > 1 && expandedGroups.has(group.id)" class="border-b border-surface-dark/6 bg-surface-dark/[0.025]">
              <td colspan="7" class="px-6 py-3">
                <div class="ml-3 border-l-2 border-primary/20 pl-4">
                  <div class="mb-2 text-[10px] font-semibold uppercase tracking-wider text-surface-dark/40">
                    Historique des versions
                  </div>
                  <button
                    v-for="version in group.versions"
                    :key="version.id"
                    type="button"
                    class="grid w-full grid-cols-[52px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-surface-card"
                    @click="openQuote(version.id)"
                  >
                    <span class="font-mono text-xs font-semibold text-surface-dark">v{{ version.version || 1 }}</span>
                    <span class="truncate text-xs text-surface-dark/65">
                      {{ version.projectName || version.title || "Projet sans titre" }}
                    </span>
                    <span class="rounded-full px-2 py-0.5 text-[10px] font-semibold" :class="quoteStatusMeta[version.status].tagClass">
                      {{ quoteStatusMeta[version.status].label }}
                    </span>
                    <span class="min-w-[90px] text-right text-xs font-semibold text-surface-dark/70">
                      {{ formatCurrency(version.totalWithVat || 0) }}
                    </span>
                  </button>
                </div>
              </td>
            </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div
        class="flex flex-wrap items-center justify-between gap-4 border-t border-surface-dark/6 px-6 py-3.5 text-xs text-surface-dark/55"
      >
        <span>
          <strong class="font-semibold text-surface-dark">{{ sortedQuotes.length }}</strong>
          devis sur {{ quoteGroupCount }} · {{ quotesStore.quotes.length }} version{{ quotesStore.quotes.length > 1 ? "s" : "" }} · total filtré
          <strong class="font-semibold text-surface-dark">{{ formatCurrency(filteredTotal) }}</strong>
        </span>
        <span>Entrée pour ouvrir un devis</span>
      </div>
    </section>

    <Menu ref="rowMenu" :model="menuItems" popup />
  </div>
</template>
