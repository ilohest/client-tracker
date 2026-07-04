<!-- Dashboard.vue -->
<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import type { TooltipOptions } from "primevue/tooltip";
import WelcomeCard from "../components/dashboard/WelcomeCard.vue";
import NotesWidget from "../components/widgets/NotesWidget.vue";
import { useQuotesStore } from "../stores/quotesStore";
import { useTimesheetsStore } from "../stores/timesheetsStore";
import { quoteStatusMeta } from "../lib/clientPresets";
import { formatCurrency, formatQuoteDate, getQuotePlatformLabel } from "../utils/quote";

const router = useRouter();
const quotesStore = useQuotesStore();
const timesheetsStore = useTimesheetsStore();

onMounted(() => {
  if (!quotesStore.quotes.length) void quotesStore.fetchQuotes();
  if (!timesheetsStore.timesheets.length) void timesheetsStore.fetchTimesheets();
});

const quotes = computed(() => quotesStore.quotes);
const liveQuotes = computed(() =>
  quotes.value.filter((quote) => quote.status !== "superseded"),
);
const signedQuotes = computed(() =>
  liveQuotes.value.filter((quote) => quote.status === "accepted"),
);
const sentQuotesCount = computed(
  () => liveQuotes.value.filter((quote) => quote.status === "sent").length,
);
const currentYear = new Date().getFullYear();
const monthLabels = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat("fr-FR", { month: "short" })
    .format(new Date(currentYear, month, 1))
    .replace(".", ""),
);
const acceptedQuotesByMonth = computed(() => {
  const totals = Array.from({ length: 12 }, (_, month) => ({
    month,
    label: monthLabels[month],
    total: 0,
  }));
  for (const quote of signedQuotes.value) {
    if (!quote.quoteDate) continue;
    const date = new Date(quote.quoteDate);
    if (Number.isNaN(date.getTime()) || date.getFullYear() !== currentYear) continue;
    totals[date.getMonth()].total += Number(quote.totalWithVat || 0);
  }
  return totals;
});
const acceptedQuotesMonthlyMax = computed(() =>
  Math.max(1, ...acceptedQuotesByMonth.value.map((entry) => entry.total)),
);
const escapeTooltipHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
const monthlyAcceptedTooltipOptions = (entry: { label: string; total: number }): TooltipOptions => ({
  escape: false,
  fitContent: true,
  showDelay: 120,
  value: `
    <span class="dashboard-chart-tooltip__label">${escapeTooltipHtml(entry.label)}</span>
    <span class="dashboard-chart-tooltip__value">${escapeTooltipHtml(formatCurrency(entry.total))}</span>
  `,
  pt: {
    arrow: { style: { display: "none" } },
    text: {
      class: "dashboard-chart-tooltip",
      style: {
        background: "#ffffff",
        border: "1px solid rgba(233, 106, 95, 0.42)",
        borderRadius: "12px",
        boxShadow: "0 14px 34px rgba(47, 43, 61, 0.14)",
        color: "#2f2b3d",
        padding: "10px 12px",
      },
    },
  },
});
const signedValue = computed(() =>
  signedQuotes.value.reduce(
    (total, quote) => total + Number(quote.totalWithVat || 0),
    0,
  ),
);
const openTimesheetsCount = computed(() => timesheetsStore.openTimesheets.length);
const runningTimesheet = computed(() =>
  timesheetsStore.openTimesheets.find((timesheet) => timesheet.activeStartedAt),
);

const recentQuotes = computed(() =>
  [...quotes.value]
    .sort((a, b) => (b.quoteDate || "").localeCompare(a.quoteDate || ""))
    .slice(0, 6),
);

const openQuote = (id: string) => {
  quotesStore.selectQuote(id);
  router.push("/quotes");
};

const openTimesheets = () => {
  if (runningTimesheet.value) timesheetsStore.selectTimesheet(runningTimesheet.value.id);
  router.push("/timesheets");
};
</script>

<template>
  <div class="flex flex-col gap-6 p-2">
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <WelcomeCard />

      <div class="grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div class="rounded-3xl border border-surface-dark/5 bg-surface-card p-5">
          <h3 class="mb-4 font-heading text-lg font-bold text-surface-dark">Actions rapides</h3>
          <div class="grid max-w-[300px] grid-cols-2 gap-2.5">
            <button
              class="flex aspect-square flex-col items-start justify-between rounded-2xl border border-primary/15 bg-primary/10 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/15 hover:shadow-sm"
              @click="router.push('/quotes')"
            >
              <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-primary">
                <span class="material-symbols-outlined text-xl">receipt_long</span>
              </span>
              <span class="text-xs font-bold leading-tight text-surface-dark">Devis</span>
            </button>
            <button
              class="flex aspect-square flex-col items-start justify-between rounded-2xl border border-indigo-500/15 bg-indigo-500/10 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-indigo-500/30 hover:bg-indigo-500/15 hover:shadow-sm"
              @click="router.push('/clients')"
            >
              <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-indigo-600">
                <span class="material-symbols-outlined text-xl">groups</span>
              </span>
              <span class="text-xs font-bold leading-tight text-surface-dark">Clients</span>
            </button>
            <button
              class="flex aspect-square flex-col items-start justify-between rounded-2xl border border-emerald-500/15 bg-emerald-500/10 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-500/30 hover:bg-emerald-500/15 hover:shadow-sm"
              @click="openTimesheets"
            >
              <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-emerald-600">
                <span class="material-symbols-outlined text-xl">timer</span>
              </span>
              <span class="min-w-0">
                <span class="block text-xs font-bold leading-tight text-surface-dark">Timesheets</span>
                <span class="mt-1 block line-clamp-2 text-[11px] leading-snug text-surface-dark/50">
                  <template v-if="runningTimesheet">Timer actif · {{ runningTimesheet.title }}</template>
                  <template v-else>{{ openTimesheetsCount }} projet{{ openTimesheetsCount > 1 ? "s" : "" }} ouvert{{ openTimesheetsCount > 1 ? "s" : "" }}</template>
                </span>
              </span>
            </button>
            <button
              class="flex aspect-square flex-col items-start justify-between rounded-2xl border border-amber-500/15 bg-amber-500/10 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-amber-500/30 hover:bg-amber-500/15 hover:shadow-sm"
              @click="router.push('/quote-templates')"
            >
              <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-amber-600">
                <span class="material-symbols-outlined text-xl">library_books</span>
              </span>
              <span class="text-xs font-bold leading-tight text-surface-dark">Templates</span>
            </button>
          </div>
        </div>

        <div class="rounded-3xl border border-surface-dark/5 bg-surface-card p-5">
          <h3 class="mb-4 font-heading text-lg font-bold text-surface-dark">Chiffres</h3>
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-2xl border border-surface-dark/6 bg-white p-3">
              <p class="text-[11px] font-semibold uppercase text-surface-dark/45">Signé</p>
              <p class="mt-1 truncate font-heading text-xl font-bold text-surface-dark">
                {{ formatCurrency(signedValue) }}
              </p>
            </div>
            <div class="rounded-2xl border border-surface-dark/6 bg-white p-3">
              <p class="text-[11px] font-semibold uppercase text-surface-dark/45">Devis en attente</p>
              <p class="mt-1 font-heading text-xl font-bold text-surface-dark">{{ sentQuotesCount }}</p>
            </div>
            <div class="col-span-2 rounded-2xl border border-surface-dark/6 bg-white p-3">
              <div class="mb-3 flex items-center justify-between gap-3">
                <p class="text-[11px] font-semibold uppercase text-surface-dark/45">Accepté par mois</p>
                <span class="text-[11px] font-medium text-surface-dark/40">{{ currentYear }}</span>
              </div>
              <div class="flex h-24 items-end gap-1.5">
                <div
                  v-for="entry in acceptedQuotesByMonth"
                  :key="entry.month"
                  class="flex min-w-0 flex-1 flex-col items-center gap-1"
                >
                  <div class="flex h-16 w-full items-end rounded-full bg-surface-dark/5 px-0.5">
                    <div
                      v-tooltip.top="monthlyAcceptedTooltipOptions(entry)"
                      class="w-full rounded-full bg-primary/70"
                      :class="entry.total ? 'min-h-1' : 'min-h-0'"
                      :style="{ height: `${Math.round((entry.total / acceptedQuotesMonthlyMax) * 100)}%` }"
                    ></div>
                  </div>
                  <span class="truncate text-[9px] font-medium uppercase text-surface-dark/35">
                    {{ entry.label.slice(0, 1) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.9fr)]">
      <!-- Derniers devis -->
      <div class="order-2 rounded-3xl border border-surface-dark/5 bg-surface-card p-6 xl:order-1">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="font-heading text-lg font-bold text-surface-dark">Derniers devis</h3>
          <button
            class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            @click="router.push('/quotes')"
          >
            Tout voir
            <span class="material-symbols-outlined text-base">arrow_forward</span>
          </button>
        </div>

        <div v-if="recentQuotes.length" class="flex flex-col divide-y divide-surface-dark/6">
          <button
            v-for="quote in recentQuotes"
            :key="quote.id"
            class="group flex items-center gap-4 py-3 text-left transition-colors first:pt-0 last:pb-0 hover:bg-surface-light/60 -mx-2 px-2 rounded-xl"
            @click="openQuote(quote.id)"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold text-surface-dark">
                {{ quote.title || quote.clientName || "Devis sans titre" }}
              </p>
              <p class="truncate text-xs text-surface-dark/50">
                {{ quote.quoteRef }}
                <span v-if="quote.quoteDate"> · {{ formatQuoteDate(quote.quoteDate) }}</span>
                <span v-if="getQuotePlatformLabel(quote.platform, quote.customPlatformLabel)" class="capitalize">
                  · {{ getQuotePlatformLabel(quote.platform, quote.customPlatformLabel) }}
                </span>
              </p>
            </div>
            <span
              class="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold"
              :class="quoteStatusMeta[quote.status].tagClass"
              >{{ quoteStatusMeta[quote.status].label }}</span
            >
            <span class="w-24 shrink-0 text-right font-heading text-sm font-bold text-surface-dark">
              {{ formatCurrency(quote.totalWithVat) }}
            </span>
          </button>
        </div>
        <div
          v-else
          class="rounded-2xl border border-dashed border-surface-dark/12 p-8 text-center text-sm text-surface-dark/50"
        >
          Aucun devis pour l'instant.
          <button class="ml-1 font-medium text-primary hover:underline" @click="router.push('/quotes')">
            Créer un devis
          </button>
        </div>
      </div>

      <div class="order-1 h-[420px] max-h-[520px] overflow-hidden xl:order-2 xl:h-[520px]">
        <NotesWidget />
      </div>
    </div>
  </div>
</template>

<style scoped>
:global(.dashboard-chart-tooltip) {
  display: grid;
  gap: 3px;
  min-width: 118px;
  line-height: 1.2;
}

:global(.dashboard-chart-tooltip__label) {
  display: block;
  color: rgba(47, 43, 61, 0.56);
  font-size: 11px;
  font-weight: 750;
  text-transform: capitalize;
}

:global(.dashboard-chart-tooltip__value) {
  display: block;
  color: #2f2b3d;
  font-size: 12px;
  font-weight: 850;
}
</style>
