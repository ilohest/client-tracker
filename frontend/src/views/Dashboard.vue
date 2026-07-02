<!-- Dashboard.vue -->
<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import type { QuoteStatus } from "@client-tracker/contracts";
import WelcomeCard from "../components/dashboard/WelcomeCard.vue";
import NotesWidget from "../components/widgets/NotesWidget.vue";
import { useQuotesStore } from "../stores/quotesStore";
import { useClientsStore } from "../stores/clientsStore";
import { quoteStatusMeta } from "../lib/clientPresets";
import { formatCurrency, formatQuoteDate, getQuotePlatformLabel } from "../utils/quote";

const router = useRouter();
const quotesStore = useQuotesStore();
const clientsStore = useClientsStore();

onMounted(() => {
  if (!quotesStore.quotes.length) void quotesStore.fetchQuotes();
  if (!clientsStore.clients.length) void clientsStore.fetchClients();
});

const quotes = computed(() => quotesStore.quotes);
// On ignore les versions remplacées dans les métriques.
const liveQuotes = computed(() =>
  quotes.value.filter((quote) => quote.status !== "superseded"),
);

const PENDING: QuoteStatus[] = ["draft", "finalized", "sent", "revision_requested"];

const sumBy = (predicate: (status: QuoteStatus) => boolean) =>
  liveQuotes.value
    .filter((quote) => predicate(quote.status))
    .reduce((total, quote) => total + Number(quote.totalWithVat || 0), 0);

const pendingValue = computed(() => sumBy((s) => PENDING.includes(s)));
const signedValue = computed(() => sumBy((s) => s === "accepted"));

const kpis = computed(() => [
  {
    label: "Devis actifs",
    value: String(liveQuotes.value.length),
    icon: "receipt_long",
    tone: "text-primary bg-primary/10",
  },
  {
    label: "En attente",
    value: formatCurrency(pendingValue.value),
    icon: "hourglass_top",
    tone: "text-amber-600 bg-amber-500/12",
  },
  {
    label: "Signés",
    value: formatCurrency(signedValue.value),
    icon: "verified",
    tone: "text-emerald-600 bg-emerald-500/12",
  },
  {
    label: "Clients",
    value: String(clientsStore.clients.length),
    icon: "groups",
    tone: "text-indigo-600 bg-indigo-500/12",
  },
]);

const statusBreakdown = computed(() => {
  const counts = new Map<QuoteStatus, number>();
  for (const quote of quotes.value) {
    counts.set(quote.status, (counts.get(quote.status) || 0) + 1);
  }
  return (Object.keys(quoteStatusMeta) as QuoteStatus[])
    .map((status) => ({ status, ...quoteStatusMeta[status], count: counts.get(status) || 0 }))
    .filter((entry) => entry.count > 0);
});
const totalQuotes = computed(() => quotes.value.length);

const recentQuotes = computed(() =>
  [...quotes.value]
    .sort((a, b) => (b.quoteDate || "").localeCompare(a.quoteDate || ""))
    .slice(0, 6),
);

const openQuote = (id: string) => {
  quotesStore.selectQuote(id);
  router.push("/quotes");
};
</script>

<template>
  <div class="flex flex-col gap-6 p-2">
    <WelcomeCard />

    <!-- KPIs -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div
        v-for="kpi in kpis"
        :key="kpi.label"
        class="rounded-3xl border border-surface-dark/5 bg-surface-card p-5"
      >
        <div class="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl" :class="kpi.tone">
          <span class="material-symbols-outlined">{{ kpi.icon }}</span>
        </div>
        <p class="text-xs font-medium uppercase tracking-wide text-surface-dark/45">
          {{ kpi.label }}
        </p>
        <p class="mt-1 font-heading text-2xl font-bold text-surface-dark">{{ kpi.value }}</p>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <!-- Derniers devis -->
      <div class="rounded-3xl border border-surface-dark/5 bg-surface-card p-6 lg:col-span-2">
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

      <!-- Répartition par statut + actions rapides -->
      <div class="flex flex-col gap-6">
        <div class="rounded-3xl border border-surface-dark/5 bg-surface-card p-6">
          <h3 class="mb-4 font-heading text-lg font-bold text-surface-dark">Devis par statut</h3>
          <div v-if="totalQuotes" class="flex flex-col gap-3">
            <div
              v-for="entry in statusBreakdown"
              :key="entry.status"
              class="flex items-center gap-3"
            >
              <span
                class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                :class="entry.tagClass"
                >{{ entry.label }}</span
              >
              <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-dark/6">
                <div
                  class="h-full rounded-full bg-primary/60"
                  :style="{ width: `${Math.round((entry.count / totalQuotes) * 100)}%` }"
                ></div>
              </div>
              <span class="w-6 text-right text-sm font-semibold text-surface-dark/70">{{
                entry.count
              }}</span>
            </div>
          </div>
          <p v-else class="text-sm text-surface-dark/50">Pas encore de devis.</p>
        </div>

        <div class="rounded-3xl border border-surface-dark/5 bg-surface-card p-6">
          <h3 class="mb-4 font-heading text-lg font-bold text-surface-dark">Actions rapides</h3>
          <div class="flex flex-col gap-2.5">
            <button
              class="flex items-center gap-3 rounded-2xl border border-surface-dark/8 bg-white px-4 py-3 text-left transition-all hover:border-primary/25 hover:shadow-sm"
              @click="router.push('/quotes')"
            >
              <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <span class="material-symbols-outlined text-lg">post_add</span>
              </span>
              <span class="text-sm font-semibold text-surface-dark">Nouveau devis</span>
            </button>
            <button
              class="flex items-center gap-3 rounded-2xl border border-surface-dark/8 bg-white px-4 py-3 text-left transition-all hover:border-primary/25 hover:shadow-sm"
              @click="router.push('/clients')"
            >
              <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                <span class="material-symbols-outlined text-lg">person_add</span>
              </span>
              <span class="text-sm font-semibold text-surface-dark">Nouveau client</span>
            </button>
            <button
              class="flex items-center gap-3 rounded-2xl border border-surface-dark/8 bg-white px-4 py-3 text-left transition-all hover:border-primary/25 hover:shadow-sm"
              @click="router.push('/quote-templates')"
            >
              <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                <span class="material-symbols-outlined text-lg">library_books</span>
              </span>
              <span class="text-sm font-semibold text-surface-dark">Gérer les templates</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <NotesWidget />
  </div>
</template>
