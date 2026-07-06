<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { Project, Quote } from "@client-tracker/contracts";
import type { TooltipOptions } from "primevue/tooltip";
import Select from "primevue/select";
import { useProjectsStore } from "@/stores/projectsStore";
import { useQuotesStore } from "@/stores/quotesStore";
import {
  calculatePaymentScheduleStepAmounts,
  formatCurrency,
} from "@/utils/quote";

const projectsStore = useProjectsStore();
const quotesStore = useQuotesStore();
const selectedYear = ref(new Date().getFullYear());

type StatsMetricKey = "billed" | "signed" | "acceptedCount";

const monthLabels = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Juin",
  "Juil",
  "Août",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

const isoDate = (value: unknown) => {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString().slice(0, 10);
  }
  return "";
};

const yearFromDate = (value: string) => Number(value.slice(0, 4));
const monthFromDate = (value: string) => Number(value.slice(5, 7)) - 1;

const projectSupplementTotal = (project: Project) =>
  (project.projectSupplements || []).reduce(
    (total, supplement) => total + Number(supplement.amountExVat || 0),
    0,
  );

const paymentMilestoneMatches = (
  milestone: Project["milestones"][number],
  index: number,
  stepId = "",
) => {
  if (milestone.status !== "done") return false;
  if (milestone.kind === "payment_received") {
    if (stepId && milestone.paymentScheduleStepId === stepId) return true;
    return milestone.paymentScheduleIndex === index;
  }
  return index === 0 && milestone.label === "Acompte reçu";
};

const projectBillingEntries = (project: Project) => {
  const quote = project.quoteId
    ? quotesStore.quotes.find((item) => item.id === project.quoteId)
    : null;

  if (!quote) {
    const date = isoDate(project.startedAt || project.createdAt);
    const amount = Number(project.invoicedExVat || project.paidExVat || 0);
    return date && amount > 0 ? [{ date, amount }] : [];
  }

  const schedule = quote.paymentSchedule || [];
  if (!schedule.length) return [];

  const legacyFinal = project.milestones?.find(
    (milestone) =>
      milestone.status === "done" &&
      milestone.label === "Paiement final reçu" &&
      (!milestone.kind || milestone.paymentScheduleIndex === -1),
  );
  if (legacyFinal?.date) {
    return [
      {
        date: legacyFinal.date,
        amount: Number(quote.subtotal || 0) + projectSupplementTotal(project),
      },
    ];
  }

  return schedule.flatMap((step, index) => {
    const milestone = project.milestones?.find((item) =>
      paymentMilestoneMatches(item, index, step.id),
    );
    if (!milestone?.date) return [];
    const amount =
      calculatePaymentScheduleStepAmounts(
        step,
        Number(quote.subtotal || 0),
        Number(quote.totalWithVat || 0),
      ).amountExcl +
      (index === schedule.length - 1 ? projectSupplementTotal(project) : 0);
    return [{ date: milestone.date, amount }];
  });
};

const acceptedQuoteEntries = computed(() =>
  quotesStore.quotes
    .filter((quote) => quote.status === "accepted")
    .map((quote) => ({
      date: isoDate(quote.quoteDate || quote.updatedAt || quote.createdAt),
      total: Number(quote.subtotal || 0),
      quote,
    }))
    .filter((entry) => entry.date),
);

const availableYears = computed(() => {
  const years = new Set<number>([new Date().getFullYear()]);
  for (const entry of acceptedQuoteEntries.value) years.add(yearFromDate(entry.date));
  for (const project of projectsStore.projects) {
    for (const entry of projectBillingEntries(project)) years.add(yearFromDate(entry.date));
  }
  return [...years]
    .sort((a, b) => b - a)
    .map((year) => ({ label: String(year), value: year }));
});

const monthlyStats = computed(() =>
  monthLabels.map((label, month) => {
    const signedQuotes = acceptedQuoteEntries.value.filter(
      (entry) =>
        yearFromDate(entry.date) === selectedYear.value &&
        monthFromDate(entry.date) === month,
    );
    const billed = projectsStore.projects.reduce(
      (total, project) =>
        total +
        projectBillingEntries(project)
          .filter(
            (entry) =>
              yearFromDate(entry.date) === selectedYear.value &&
              monthFromDate(entry.date) === month,
          )
          .reduce((sum, entry) => sum + entry.amount, 0),
      0,
    );
    return {
      label,
      billed,
      signed: signedQuotes.reduce((total, entry) => total + entry.total, 0),
      acceptedCount: signedQuotes.length,
    };
  }),
);

const yearlyStats = computed(() =>
  availableYears.value.map(({ value: year }) => {
    const quotes = acceptedQuoteEntries.value.filter(
      (entry) => yearFromDate(entry.date) === year,
    );
    const billed = projectsStore.projects.reduce(
      (total, project) =>
        total +
        projectBillingEntries(project)
          .filter((entry) => yearFromDate(entry.date) === year)
          .reduce((sum, entry) => sum + entry.amount, 0),
      0,
    );
    return {
      year,
      billed,
      signed: quotes.reduce((total, entry) => total + entry.total, 0),
      acceptedCount: quotes.length,
    };
  }),
);

const selectedYearTotals = computed(() =>
  monthlyStats.value.reduce(
    (total, entry) => ({
      billed: total.billed + entry.billed,
      signed: total.signed + entry.signed,
      acceptedCount: total.acceptedCount + entry.acceptedCount,
    }),
    { billed: 0, signed: 0, acceptedCount: 0 },
  ),
);

const monthlyAmountMax = computed(() =>
  Math.max(
    1,
    ...monthlyStats.value.flatMap((entry) => [
      entry.billed,
      entry.signed,
    ]),
  ),
);

const monthlyAcceptedMax = computed(() =>
  Math.max(1, ...monthlyStats.value.map((entry) => entry.acceptedCount)),
);

const yearlyAmountMax = computed(() =>
  Math.max(
    1,
    ...yearlyStats.value.flatMap((entry) => [
      entry.billed,
      entry.signed,
    ]),
  ),
);

const escapeTooltipHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const formatMetricValue = (key: StatsMetricKey, value: number) =>
  key === "acceptedCount"
    ? `${value} devis accepté${value > 1 ? "s" : ""}`
    : formatCurrency(value);

const statsTooltipOptions = (
  label: string,
  value: string,
  detail = "",
): TooltipOptions => ({
  escape: false,
  fitContent: true,
  showDelay: 120,
  value: `
    <span class="stats-chart-tooltip__label">${escapeTooltipHtml(label)}</span>
    <span class="stats-chart-tooltip__value">${escapeTooltipHtml(value)}</span>
    ${detail ? `<span class="stats-chart-tooltip__detail">${escapeTooltipHtml(detail)}</span>` : ""}
  `,
  pt: {
    arrow: { style: { display: "none" } },
    text: {
      class: "stats-chart-tooltip",
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

const monthlyTooltipOptions = (
  entry: (typeof monthlyStats.value)[number],
  metric: { key: string; label: string },
) => {
  const key = metric.key as StatsMetricKey;
  return statsTooltipOptions(
    `${entry.label} ${selectedYear.value}`,
    formatMetricValue(key, Number(entry[key] || 0)),
    metric.label,
  );
};

const yearlyTooltipOptions = (
  year: number,
  label: string,
  value: number,
  detail = "",
) => statsTooltipOptions(`${label} ${year}`, formatCurrency(value), detail);

onMounted(async () => {
  await Promise.all([
    projectsStore.projects.length
      ? Promise.resolve()
      : projectsStore.fetchProjects(),
    quotesStore.quotes.length ? Promise.resolve() : quotesStore.fetchQuotes(),
  ]);
});
</script>

<template>
  <div class="flex flex-col gap-6 p-2">
    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex items-start gap-3">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <span class="material-symbols-outlined text-2xl text-primary">monitoring</span>
        </span>
        <div>
          <h1 class="text-3xl font-heading font-bold text-surface-dark">
            Stats
          </h1>
          <p class="mt-1 text-sm text-surface-dark/55">
            Facturation projets, devis signés et acceptations par période.
          </p>
        </div>
      </div>
      <Select
        v-model="selectedYear"
        :options="availableYears"
        option-label="label"
        option-value="value"
        class="w-36"
      />
    </div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div class="rounded-2xl border border-surface-dark/5 bg-white p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-surface-dark/40">
          Facturé · {{ selectedYear }}
        </p>
        <p class="mt-2 text-2xl font-bold text-surface-dark">
          {{ formatCurrency(selectedYearTotals.billed) }}
        </p>
      </div>
      <div class="rounded-2xl border border-surface-dark/5 bg-white p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-surface-dark/40">
          Devis signés · {{ selectedYear }}
        </p>
        <p class="mt-2 text-2xl font-bold text-primary">
          {{ formatCurrency(selectedYearTotals.signed) }}
        </p>
      </div>
      <div class="rounded-2xl border border-surface-dark/5 bg-white p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-surface-dark/40">
          Nombre de devis acceptés · {{ selectedYear }}
        </p>
        <p class="mt-2 text-2xl font-bold text-amber-600">
          {{ selectedYearTotals.acceptedCount }}
        </p>
      </div>
    </div>

    <section class="rounded-3xl border border-surface-dark/5 bg-surface-card p-5">
      <div class="mb-5 flex items-center justify-between gap-3">
        <h2 class="font-heading text-xl font-bold text-surface-dark">
          Détail mensuel
        </h2>
        <span class="text-sm font-semibold text-surface-dark/45">{{ selectedYear }}</span>
      </div>
      <div class="grid gap-4 lg:grid-cols-3">
        <div
          v-for="metric in [
            { key: 'billed', label: 'Facturé', color: 'bg-emerald-500/75' },
            { key: 'signed', label: 'Devis signés', color: 'bg-primary/75' },
            { key: 'acceptedCount', label: 'Nombre de devis acceptés', color: 'bg-amber-500/75' },
          ]"
          :key="metric.key"
          class="rounded-2xl border border-surface-dark/6 bg-white p-4"
        >
          <div class="flex items-start justify-between gap-3">
            <h3 class="text-sm font-bold text-surface-dark">{{ metric.label }}</h3>
            <span class="text-sm font-bold text-surface-dark/55">
              <template v-if="metric.key === 'acceptedCount'">
                {{ selectedYearTotals.acceptedCount }}
              </template>
              <template v-else-if="metric.key === 'billed'">
                {{ formatCurrency(selectedYearTotals.billed) }}
              </template>
              <template v-else>
                {{ formatCurrency(selectedYearTotals.signed) }}
              </template>
            </span>
          </div>
          <div class="mt-4 flex h-44 items-end gap-2">
            <div
              v-for="entry in monthlyStats"
              :key="`${metric.key}-${entry.label}`"
              class="flex min-w-0 flex-1 flex-col items-center gap-2"
            >
              <div class="flex h-32 w-full items-end rounded-full bg-surface-dark/5 px-1">
                <div
                  v-tooltip.top="monthlyTooltipOptions(entry, metric)"
                  class="w-full rounded-full"
                  :class="metric.color"
                  :style="{
                    height: `${Math.round((Number(entry[metric.key as keyof typeof entry]) / (metric.key === 'acceptedCount' ? monthlyAcceptedMax : monthlyAmountMax)) * 100)}%`,
                  }"
                ></div>
              </div>
              <span class="text-[10px] font-bold uppercase text-surface-dark/35">
                {{ entry.label.slice(0, 1) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="rounded-3xl border border-surface-dark/5 bg-surface-card p-5">
      <h2 class="mb-5 font-heading text-xl font-bold text-surface-dark">
        Vue d'ensemble annuelle
      </h2>
      <div class="grid gap-3">
        <div
          v-for="entry in yearlyStats"
          :key="entry.year"
          class="rounded-2xl border border-surface-dark/6 bg-white p-4"
        >
          <div class="mb-3 flex items-center justify-between gap-3">
            <h3 class="font-bold text-surface-dark">{{ entry.year }}</h3>
            <p class="text-sm font-semibold text-surface-dark/45">
              {{ entry.acceptedCount }} devis au statut accepté
            </p>
          </div>
          <div class="grid gap-3 md:grid-cols-[120px_minmax(0,1fr)_auto] md:items-center">
            <span class="text-xs font-bold uppercase text-surface-dark/40">Facturé</span>
            <div class="h-3 overflow-hidden rounded-full bg-surface-dark/6">
              <div
                v-tooltip.top="
                  yearlyTooltipOptions(
                    entry.year,
                    'Facturé',
                    entry.billed,
                    `${entry.acceptedCount} devis accepté${entry.acceptedCount > 1 ? 's' : ''}`,
                  )
                "
                class="h-full rounded-full bg-emerald-500/75"
                :style="{ width: `${Math.round((entry.billed / yearlyAmountMax) * 100)}%` }"
              ></div>
            </div>
            <span class="text-sm font-bold text-surface-dark">{{ formatCurrency(entry.billed) }}</span>
            <span class="text-xs font-bold uppercase text-surface-dark/40">Signé</span>
            <div class="h-3 overflow-hidden rounded-full bg-surface-dark/6">
              <div
                v-tooltip.top="
                  yearlyTooltipOptions(
                    entry.year,
                    'Devis signés',
                    entry.signed,
                    `${entry.acceptedCount} devis accepté${entry.acceptedCount > 1 ? 's' : ''}`,
                  )
                "
                class="h-full rounded-full bg-primary/75"
                :style="{ width: `${Math.round((entry.signed / yearlyAmountMax) * 100)}%` }"
              ></div>
            </div>
            <span class="text-sm font-bold text-surface-dark">{{ formatCurrency(entry.signed) }}</span>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
:global(.stats-chart-tooltip) {
  display: grid;
  gap: 3px;
  min-width: 118px;
  line-height: 1.2;
}

:global(.stats-chart-tooltip__label) {
  display: block;
  color: rgba(47, 43, 61, 0.56);
  font-size: 11px;
  font-weight: 750;
  text-transform: capitalize;
}

:global(.stats-chart-tooltip__value) {
  display: block;
  color: #2f2b3d;
  font-size: 12px;
  font-weight: 850;
}

:global(.stats-chart-tooltip__detail) {
  display: block;
  color: rgba(47, 43, 61, 0.48);
  font-size: 11px;
  font-weight: 650;
}
</style>
