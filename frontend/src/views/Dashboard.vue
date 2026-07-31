<!-- Dashboard.vue -->
<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import type { TooltipOptions } from "primevue/tooltip";
import WelcomeCard from "../components/dashboard/WelcomeCard.vue";
import NotesWidget from "../components/widgets/NotesWidget.vue";
import { useProjectsStore } from "../stores/projectsStore";
import { useQuotesStore } from "../stores/quotesStore";
import { useTimesheetsStore } from "../stores/timesheetsStore";
import { quoteStatusMeta } from "../lib/clientPresets";
import { formatCurrency, formatQuoteDate } from "../utils/quote";
import {
  projectActiveQuotes,
  projectToInvoiceExVat,
} from "../utils/projectFinance";

const router = useRouter();
const projectsStore = useProjectsStore();
const quotesStore = useQuotesStore();
const timesheetsStore = useTimesheetsStore();

onMounted(() => {
  if (!projectsStore.projects.length) void projectsStore.fetchProjects();
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
    .slice(0, 3),
);
const activeProjects = computed(() =>
  projectsStore.projects
    .filter((project) => !["paid", "closed"].includes(project.status))
    .sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || ""))),
);
const activeProjectsPreview = computed(() => activeProjects.value.slice(0, 4));
const activeProjectsToInvoice = computed(() =>
  activeProjects.value.reduce(
    (total, project) =>
      total +
      projectToInvoiceExVat(
        project,
        projectActiveQuotes(project, quotesStore.quotes),
      ),
    0,
  ),
);
const projectProgress = (project: (typeof activeProjects.value)[number]) => {
  const milestones = (project.milestones || []).filter(
    (item) => !["invoice_sent", "payment_received"].includes(item.kind || ""),
  );
  if (!milestones.length) return 0;
  return Math.round((milestones.filter((item) => item.status === "done").length / milestones.length) * 100);
};

const openQuote = (id: string) => {
  quotesStore.selectQuote(id);
  router.push("/quotes");
};

const openProject = (id: string) => {
  projectsStore.selectProject(id);
  router.push({ name: "project-detail", params: { id } });
};

const createQuote = () => {
  router.push({ name: "quote-new" });
};

const createClient = () => {
  router.push({ path: "/clients", query: { new: "1" } });
};

const openTimesheets = () => {
  if (runningTimesheet.value) timesheetsStore.selectTimesheet(runningTimesheet.value.id);
  router.push("/timesheets");
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <WelcomeCard />

      <div class="grid gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
        <div class="rounded-3xl border border-surface-dark/5 bg-surface-card p-5">
          <h3 class="mb-4 font-heading text-lg font-bold text-surface-dark">Actions rapides</h3>
          <div class="grid max-w-[300px] grid-cols-2 gap-2.5">
            <button
              class="flex aspect-square flex-col items-start justify-between rounded-2xl border border-primary/15 bg-primary/10 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-primary/15 hover:shadow-sm"
              @click="createQuote"
            >
              <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-primary">
                <span class="material-symbols-outlined text-xl">receipt_long</span>
              </span>
              <span class="text-xs font-bold leading-tight text-surface-dark">Devis</span>
            </button>
            <button
              class="flex aspect-square flex-col items-start justify-between rounded-2xl border border-indigo-500/15 bg-indigo-500/10 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-indigo-500/30 hover:bg-indigo-500/15 hover:shadow-sm"
              @click="createClient"
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
              @click="router.push('/projects')"
            >
              <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-white/70 text-amber-600">
                <span class="material-symbols-outlined text-xl">workspaces</span>
              </span>
              <span class="text-xs font-bold leading-tight text-surface-dark">Projets</span>
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
      <div class="order-2 grid gap-4 lg:grid-cols-2 xl:order-1">
        <!-- Derniers devis -->
        <div class="rounded-3xl border border-surface-dark/5 bg-surface-card p-5">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="font-heading text-lg font-bold text-surface-dark">Derniers devis</h3>
            <button
              class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              @click="router.push('/quotes')"
            >
              Tout voir
              <span class="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>

          <div v-if="recentQuotes.length" class="flex flex-col gap-2">
            <button
              v-for="quote in recentQuotes"
              :key="quote.id"
              class="flex cursor-pointer items-center gap-3 rounded-2xl border border-surface-dark/6 bg-white p-3 text-left transition hover:border-primary/25 hover:bg-primary/5"
              @click="openQuote(quote.id)"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-surface-dark">
                  {{ quote.title || quote.clientName || "Devis sans titre" }}
                </p>
                <p class="truncate text-xs text-surface-dark/50">
                  {{ quote.quoteRef }}
                  <span v-if="quote.quoteDate"> · {{ formatQuoteDate(quote.quoteDate) }}</span>
                </p>
              </div>
              <span
                class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                :class="quoteStatusMeta[quote.status].tagClass"
                >{{ quoteStatusMeta[quote.status].label }}</span
              >
            </button>
          </div>
          <div
            v-else
            class="rounded-2xl border border-dashed border-surface-dark/12 p-6 text-center text-sm text-surface-dark/50"
          >
            Aucun devis pour l'instant.
          </div>
        </div>

        <div class="rounded-3xl border border-surface-dark/5 bg-surface-card p-5">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="font-heading text-lg font-bold text-surface-dark">Projets actifs</h3>
            <button
              class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              @click="router.push('/projects')"
            >
              Tout voir
              <span class="material-symbols-outlined text-base">arrow_forward</span>
            </button>
          </div>

          <div class="mb-3 grid grid-cols-2 gap-2">
            <div class="rounded-2xl border border-surface-dark/6 bg-white p-3">
              <p class="text-[11px] font-semibold uppercase text-surface-dark/45">Actifs</p>
              <p class="mt-1 font-heading text-xl font-bold text-surface-dark">{{ activeProjects.length }}</p>
            </div>
            <div class="rounded-2xl border border-surface-dark/6 bg-white p-3">
              <p class="text-[11px] font-semibold uppercase text-surface-dark/45">À facturer</p>
              <p class="mt-1 truncate font-heading text-xl font-bold text-amber-600">{{ formatCurrency(activeProjectsToInvoice) }}</p>
            </div>
          </div>

          <div v-if="activeProjectsPreview.length" class="flex flex-col gap-2">
            <button
              v-for="project in activeProjectsPreview"
              :key="project.id"
              class="rounded-2xl border border-surface-dark/6 bg-white p-3 text-left transition hover:border-primary/25 hover:bg-primary/5"
              @click="openProject(project.id)"
            >
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate text-sm font-bold text-surface-dark">{{ project.title }}</p>
                  <p class="mt-1 truncate text-xs text-surface-dark/50">{{ project.clientName || "Sans client" }}</p>
                </div>
                <span class="shrink-0 text-xs font-bold text-primary">{{ projectProgress(project) }}%</span>
              </div>
              <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-dark/6">
                <div class="h-full rounded-full bg-primary" :style="{ width: `${projectProgress(project)}%` }"></div>
              </div>
            </button>
          </div>
          <div v-else class="rounded-2xl border border-dashed border-surface-dark/12 p-6 text-center text-sm text-surface-dark/50">
            Aucun projet actif.
          </div>
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
