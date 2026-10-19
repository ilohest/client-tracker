<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { Project, ProjectInput, ProjectStatus, Quote } from "@client-tracker/contracts";
import Button from "primevue/button";
import ConfirmDialog from "primevue/confirmdialog";
import DatePicker from "primevue/datepicker";
import InputText from "primevue/inputtext";
import Menu from "primevue/menu";
import Select from "primevue/select";
import Tag from "primevue/tag";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import ProjectFormDialog from "@/components/projects/ProjectFormDialog.vue";
import type { ProjectFormValue } from "@/components/projects/projectForm";
import { useAuthStore } from "@/stores/authStore";
import { useClientsStore } from "@/stores/clientsStore";
import { useProjectsStore } from "@/stores/projectsStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { formatCurrency } from "@/utils/quote";
import { formatDuration, projectBudgetHours, projectTrackedSeconds } from "@/utils/timeTracking";
import TimeCalendar from "@/components/projects/TimeCalendar.vue";
import type { ProjectSortField } from "@/utils/projectFilters";
import {
  buildProjectList,
  isProjectOverdue,
  projectStatusMeta,
  projectStatusOptions,
  readProjectListQuery,
  toIsoDay,
  writeProjectListQuery,
} from "@/utils/projectFilters";
import {
  isDateOnOrAfter,
  projectActiveQuotes as sharedActiveQuotes,
  projectQuotes as sharedProjectQuotes,
  projectScheduledInvoicedExVat,
  projectToInvoiceExVat,
  projectTotalBudget as sharedTotalBudget,
} from "@/utils/projectFinance";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const projectsStore = useProjectsStore();
const quotesStore = useQuotesStore();
const clientsStore = useClientsStore();
const confirm = useConfirm();
const toast = useToast();

const currentYear = new Date().getFullYear();
const currentYearStart = `${currentYear}-01-01`;

const initialState = readProjectListQuery(route.query);
const search = ref(initialState.search);
const filterStatus = ref<ProjectStatus | "">(initialState.status);
const filterClientId = ref(initialState.clientId);
const filterDateRange = ref<Date[] | null>(initialState.dateRange);
const sortField = ref<ProjectSortField>(initialState.sortField);
const sortDirection = ref(initialState.sortDirection);

const rowMenu = ref<InstanceType<typeof Menu> | null>(null);
const menuProjectId = ref("");

const colorPool = [
  "#e96a5f",
  "#6366f1",
  "#0ea5e9",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#14b8a6",
  "#ef4444",
];

const dialogOpen = ref(false);

const projectQuotes = (project: Project): Quote[] =>
  sharedProjectQuotes(project, quotesStore.quotes);
const projectTotalBudget = (project: Project): number =>
  sharedTotalBudget(project, sharedActiveQuotes(project, quotesStore.quotes));

const listState = computed(() => ({
  search: search.value,
  status: filterStatus.value,
  clientId: filterClientId.value,
  dateRange: filterDateRange.value,
  sortField: sortField.value,
  sortDirection: sortDirection.value,
}));

const listQuery = computed(() => writeProjectListQuery(listState.value));

watch(listQuery, (query) => {
  if (JSON.stringify(query) === JSON.stringify(route.query)) return;
  void router.replace({ name: "projects", query });
});

onMounted(async () => {
  await Promise.all([
    projectsStore.fetchProjects(),
    quotesStore.fetchQuotes(),
    clientsStore.fetchClients(),
  ]);
});

const clientOptions = computed(() =>
  clientsStore.clients.map((client) => ({ label: client.name, value: client.id })),
);

const hasAnyProject = computed(() => projectsStore.projects.length > 0);

const sortedProjects = computed(() =>
  buildProjectList(projectsStore.projects, listState.value, {
    quotesByProject: projectQuotes,
    budgetOf: projectTotalBudget,
  }),
);

const activeQuotesOf = (project: Project) =>
  sharedActiveQuotes(project, quotesStore.quotes);

const totalBudget = computed(() =>
  projectsStore.activeProjects.reduce(
    (total, project) =>
      total +
      (isDateOnOrAfter(project.startedAt || "", currentYearStart)
        ? projectTotalBudget(project)
        : 0),
    0,
  ),
);
const totalInvoiced = computed(() =>
  projectsStore.projects.reduce(
    (total, project) =>
      total +
      projectScheduledInvoicedExVat(project, activeQuotesOf(project), currentYearStart),
    0,
  ),
);
const totalToInvoice = computed(() =>
  projectsStore.projects.reduce(
    (total, project) =>
      total +
      (isDateOnOrAfter(project.startedAt || "", currentYearStart)
        ? projectToInvoiceExVat(project, activeQuotesOf(project))
        : 0),
    0,
  ),
);

const overdueCount = computed(
  () => projectsStore.projects.filter((project) => isProjectOverdue(project)).length,
);

const acceptedQuotesWithoutProject = computed(() =>
  quotesStore.quotes.filter((quote) => quote.status === "accepted" && !quote.projectId),
);

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
      value: projectStatusMeta[filterStatus.value].label,
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
      label: "Démarrage",
      value: end
        ? `${formatDate(toIsoDay(start))} – ${formatDate(toIsoDay(end))}`
        : `À partir du ${formatDate(toIsoDay(start))}`,
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

const toggleSort = (field: ProjectSortField) => {
  if (sortField.value === field) {
    sortDirection.value = sortDirection.value === "asc" ? "desc" : "asc";
    return;
  }
  sortField.value = field;
  sortDirection.value = field === "title" || field === "dueDate" ? "asc" : "desc";
};

function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-BE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

const nowTick = ref(Date.now());
let tickInterval: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  tickInterval = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
});
onBeforeUnmount(() => {
  if (tickInterval) clearInterval(tickInterval);
});

const projectSeconds = (project: Project) => projectTrackedSeconds(project, nowTick.value);

const timeRatio = (project: Project) => {
  const hours = projectBudgetHours(project);
  return hours > 0 ? projectSeconds(project) / 3600 / hours : 0;
};
const timeBarClass = (project: Project) => {
  const ratio = timeRatio(project);
  if (ratio >= 1) return "bg-red-500";
  if (ratio >= 0.82) return "bg-amber-500";
  return "bg-emerald-500";
};

const toggleProjectTimer = async (project: Project) => {
  try {
    if (project.activeStartedAt) await projectsStore.stopTimer(project.id);
    else await projectsStore.startTimer(project.id);
  } catch (error) {
    console.error(error);
    toast.add({
      severity: "error",
      summary: "Chrono indisponible",
      detail: "L'enregistrement du temps a échoué.",
      life: 4200,
    });
  }
};

const viewMode = ref<"list" | "calendar">("list");

const openProject = (id: string) => {
  void router.push({ name: "project-detail", params: { id }, query: listQuery.value });
};

const openCreateDialog = () => {
  dialogOpen.value = true;
};

const dateToIso = (date: Date | null) => (date ? toIsoDay(date) : "");

const saveProject = async (form: ProjectFormValue) => {
  const client = clientsStore.clients.find((entry) => entry.id === form.clientId);
  const payload: ProjectInput = {
    title: form.title.trim(),
    description: form.description.trim(),
    notes: "",
    projectSupplements: [],
    sourceType: "custom",
    clientId: form.clientId,
    clientName: client?.name || "",
    color: form.color,
    status: "in_progress",
    budgetExVat: Number(form.budgetExVat || 0),
    invoicedExVat: 0,
    paidExVat: 0,
    billingWaivedExVat: 0,
    hourlyRate: Number(form.hourlyRate || 0),
    startedAt: dateToIso(form.startedAt),
    dueDate: dateToIso(form.dueDate),
    closedAt: "",
    nextAction: "",
    milestones: [
      {
        id: crypto.randomUUID(),
        label: "Cadrage initial validé",
        status: "done",
        date: dateToIso(form.startedAt),
        kind: "custom",
      },
      {
        id: crypto.randomUUID(),
        label: "Travail en cours",
        status: "todo",
        date: "",
        kind: "work",
      },
      {
        id: crypto.randomUUID(),
        label: "Validation client",
        status: "todo",
        date: "",
        kind: "approval",
      },
      {
        id: crypto.randomUUID(),
        label: "Implémentation des retours",
        status: "todo",
        date: "",
        kind: "work",
      },
      {
        id: crypto.randomUUID(),
        label: "Livraison",
        status: "todo",
        date: "",
        kind: "delivery",
      },
      {
        id: crypto.randomUUID(),
        label: "Facture d'acompte envoyée",
        status: "todo",
        date: "",
        kind: "invoice_sent",
        paymentScheduleIndex: 0,
      },
      {
        id: crypto.randomUUID(),
        label: "Acompte reçu",
        status: "todo",
        date: "",
        kind: "payment_received",
        paymentScheduleIndex: 0,
      },
      {
        id: crypto.randomUUID(),
        label: "Facture finale envoyée",
        status: "todo",
        date: "",
        kind: "invoice_sent",
        paymentScheduleIndex: -1,
      },
      {
        id: crypto.randomUUID(),
        label: "Paiement final reçu",
        status: "todo",
        date: "",
        kind: "payment_received",
        paymentScheduleIndex: -1,
      },
    ],
  };

  try {
    const project = await projectsStore.createProject(payload);
    dialogOpen.value = false;
    toast.add({
      severity: "success",
      summary: "Projet créé",
      detail: `${payload.title} est prêt à être suivi.`,
      life: 2500,
    });
    if (project?.id) openProject(project.id);
  } catch (error: any) {
    toast.add({
      severity: "error",
      summary: "Projet indisponible",
      detail: error.message || "Impossible de créer le projet.",
      life: 4200,
    });
  }
};

const createFromQuote = async (quote: Quote) => {
  try {
    const color = colorPool[projectsStore.projects.length % colorPool.length];
    const project = await projectsStore.createFromQuote(
      quote,
      Number(authStore.userProfile?.hourlyRate || 0),
      color,
    );
    toast.add({
      severity: "success",
      summary: "Projet créé depuis le devis",
      detail: "Le devis est lié au projet.",
      life: 2800,
    });
    if (project?.id) openProject(project.id);
  } catch (error: any) {
    toast.add({
      severity: "error",
      summary: "Projet indisponible",
      detail: error.message || "Impossible de créer le projet.",
      life: 4200,
    });
  }
};

const menuProject = computed(
  () => projectsStore.projects.find((project) => project.id === menuProjectId.value) || null,
);

const confirmDelete = (project: Project) => {
  confirm.require({
    message: `Le projet ${project.title} et son suivi seront définitivement supprimés.`,
    header: "Supprimer ce projet ?",
    icon: "warning",
    rejectProps: { label: "Annuler", severity: "secondary", outlined: true },
    acceptProps: { label: "Supprimer", severity: "danger" },
    accept: async () => {
      await projectsStore.deleteProject(project.id);
      toast.add({
        severity: "secondary",
        summary: "Projet supprimé",
        detail: `${project.title} a été retiré de la liste.`,
        life: 2500,
      });
    },
  });
};

const menuItems = computed(() => [
  {
    label: "Ouvrir",
    icon: "pi pi-arrow-up-right",
    command: () => menuProject.value && openProject(menuProject.value.id),
  },
  {
    label: "Supprimer",
    icon: "pi pi-trash",
    command: () => menuProject.value && confirmDelete(menuProject.value),
  },
]);

const openRowMenu = (event: Event, projectId: string) => {
  menuProjectId.value = projectId;
  rowMenu.value?.toggle(event);
};

const columns: Array<{ field: ProjectSortField | null; label: string; align?: "right" }> = [
  { field: "title", label: "Projet" },
  { field: "status", label: "Statut" },
  { field: "time", label: "Temps" },
  { field: "budget", label: "Budget HT", align: "right" },
  { field: "dueDate", label: "Échéance" },
  { field: "updatedAt", label: "Modifié" },
];

const formatRelativeDays = (value: unknown): string => {
  const date = value ? new Date(value as string) : null;
  if (!date || Number.isNaN(date.getTime())) return "—";
  const days = Math.floor((Date.now() - date.getTime()) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "hier";
  if (days < 31) return `il y a ${days} j`;
  const months = Math.floor(days / 30);
  return months === 1 ? "il y a 1 mois" : `il y a ${months} mois`;
};
</script>

<template>
  <div class="flex flex-col gap-6">
    <ConfirmDialog />

    <div class="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div class="flex items-start gap-3">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <span class="material-symbols-outlined text-2xl text-primary">workspaces</span>
        </span>
        <div>
          <h1 class="text-3xl font-heading font-bold text-surface-dark">Projets</h1>
          <p class="mt-1 text-sm text-surface-dark/55">
            {{ projectsStore.projects.length }} projet{{
              projectsStore.projects.length > 1 ? "s" : ""
            }}
            <template v-if="overdueCount">
              ·
              <span class="font-semibold text-rose-700">
                {{ overdueCount }} en retard
              </span>
            </template>
            · Le cockpit entre devis, temps, facturation et validation client.
          </p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div v-if="hasAnyProject" class="flex rounded-xl border border-surface-dark/10 bg-white p-1">
          <button
            type="button"
            class="rounded-lg px-3 py-1.5 text-xs font-bold transition-colors"
            :class="viewMode === 'list' ? 'bg-primary text-white' : 'text-surface-dark/55 hover:bg-surface-dark/5'"
            @click="viewMode = 'list'"
          >
            Liste
          </button>
          <button
            type="button"
            class="rounded-lg px-3 py-1.5 text-xs font-bold transition-colors"
            :class="viewMode === 'calendar' ? 'bg-primary text-white' : 'text-surface-dark/55 hover:bg-surface-dark/5'"
            @click="viewMode = 'calendar'"
          >
            Calendrier
          </button>
        </div>
        <Button label="Nouveau projet" @click="openCreateDialog">
          <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
        </Button>
      </div>
    </div>

    <div v-if="hasAnyProject" class="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div class="rounded-2xl border border-surface-dark/5 bg-white p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-surface-dark/40">
          Budget actif · {{ currentYear }}
        </p>
        <p class="mt-2 text-2xl font-bold tabular-nums text-surface-dark">
          {{ formatCurrency(totalBudget) }}
        </p>
      </div>
      <div class="rounded-2xl border border-surface-dark/5 bg-white p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-surface-dark/40">
          À facturer · {{ currentYear }}
        </p>
        <p class="mt-2 text-2xl font-bold tabular-nums text-amber-600">
          {{ formatCurrency(totalToInvoice) }}
        </p>
      </div>
      <div class="rounded-2xl border border-surface-dark/5 bg-white p-4">
        <p class="text-xs font-bold uppercase tracking-wide text-surface-dark/40">
          Facturé · {{ currentYear }}
        </p>
        <p class="mt-2 text-2xl font-bold tabular-nums text-surface-dark">
          {{ formatCurrency(totalInvoiced) }}
        </p>
      </div>
    </div>

    <div
      v-if="acceptedQuotesWithoutProject.length"
      class="rounded-3xl border border-dashed border-primary/25 bg-primary/5 p-4"
    >
      <div class="mb-3 flex items-center gap-2">
        <span class="material-symbols-outlined text-primary">auto_awesome_motion</span>
        <h2 class="text-base font-bold text-surface-dark">
          Devis acceptés prêts à devenir projets
        </h2>
      </div>
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <button
          v-for="quote in acceptedQuotesWithoutProject"
          :key="quote.id"
          type="button"
          class="rounded-2xl border border-primary/20 bg-white/75 p-4 text-left opacity-75 transition hover:opacity-100 hover:shadow-sm"
          @click="createFromQuote(quote)"
        >
          <p class="text-sm font-bold text-surface-dark">
            {{ quote.projectName || quote.title || quote.clientName }}
          </p>
          <p class="mt-1 text-xs text-surface-dark/50">
            {{ quote.quoteRef }} · {{ quote.clientName }}
          </p>
          <p class="mt-3 text-sm font-bold tabular-nums text-primary">
            {{ formatCurrency(quote.subtotal) }}
          </p>
        </button>
      </div>
    </div>

    <section
      v-if="hasAnyProject"
      class="rounded-3xl border border-surface-dark/5 bg-surface-card p-4 shadow-sm"
    >
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <InputText v-model="search" placeholder="Rechercher un projet" />
        <Select
          v-model="filterStatus"
          :options="projectStatusOptions"
          option-label="label"
          option-value="value"
          placeholder="Tous les statuts"
          show-clear
        >
          <template #value="{ value }">
            <Tag
              v-if="value"
              :value="projectStatusMeta[value as ProjectStatus].label"
              :class="projectStatusMeta[value as ProjectStatus].tagClass"
              rounded
            />
            <span v-else class="text-surface-dark/50">Tous les statuts</span>
          </template>
          <template #option="{ option }">
            <Tag
              :value="option.label"
              :class="projectStatusMeta[option.value as ProjectStatus].tagClass"
              rounded
            />
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
          placeholder="Démarrage entre…"
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
      v-if="!hasAnyProject && !projectsStore.loading"
      class="flex flex-col items-center gap-2 rounded-3xl border border-surface-dark/5 bg-surface-card px-8 py-14 text-center shadow-sm"
    >
      <span class="mb-1 flex items-center justify-center rounded-2xl bg-surface-dark/6 p-3">
        <span class="material-symbols-outlined text-2xl text-surface-dark/35">workspaces</span>
      </span>
      <h2 class="font-heading text-lg font-bold text-surface-dark">Suivez votre premier projet</h2>
      <p class="max-w-md text-sm text-surface-dark/55">
        Un devis accepté devient un projet en un clic, avec ses jalons de facturation déjà posés et un chrono prêt à démarrer.
        Vous pouvez aussi créer un projet hors devis.
      </p>
      <Button class="mt-3" label="Nouveau projet" @click="openCreateDialog">
        <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
      </Button>
    </section>

    <section
      v-else-if="!sortedProjects.length && !projectsStore.loading"
      class="flex flex-col items-center gap-2 rounded-3xl border border-surface-dark/5 bg-surface-card px-8 py-14 text-center shadow-sm"
    >
      <span class="mb-1 flex items-center justify-center rounded-2xl bg-surface-dark/6 p-3">
        <span class="material-symbols-outlined text-2xl text-surface-dark/35">search_off</span>
      </span>
      <h2 class="font-heading text-lg font-bold text-surface-dark">Aucun projet ne correspond</h2>
      <p class="max-w-md text-sm text-surface-dark/55">
        {{ activeFilters.length }} filtre{{
          activeFilters.length > 1 ? "s sont actifs" : " est actif"
        }}
        :
        {{ activeFilters.map((chip) => `${chip.label.toLowerCase()} ${chip.value}`).join(", ") }}.
      </p>
      <Button
        class="mt-3"
        severity="secondary"
        outlined
        label="Effacer les filtres"
        @click="clearAllFilters"
      />
    </section>

    <section
      v-else-if="sortedProjects.length && viewMode === 'calendar'"
      class="rounded-3xl border border-surface-dark/5 bg-surface-card p-6 shadow-sm"
    >
      <TimeCalendar :projects="sortedProjects" @select="openProject" />
    </section>

    <section
      v-else-if="sortedProjects.length"
      class="overflow-hidden rounded-3xl border border-surface-dark/5 bg-surface-card shadow-sm"
    >
      <div class="overflow-x-auto">
        <table class="w-full min-w-[980px] border-collapse tabular-nums">
          <thead>
            <tr class="border-b border-surface-dark/12">
              <th
                v-for="column in columns"
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
            <tr
              v-for="project in sortedProjects"
              :key="project.id"
              class="group cursor-pointer border-b border-surface-dark/6 transition last:border-b-0 hover:bg-surface-dark/3"
              tabindex="0"
              @click="openProject(project.id)"
              @keydown.enter="openProject(project.id)"
            >
              <td class="px-4 py-3 pl-6">
                <div class="flex items-center gap-2.5">
                  <span
                    class="h-2.5 w-2.5 shrink-0 rounded-full"
                    :class="project.activeStartedAt ? 'animate-pulse ring-4 ring-emerald-500/25' : ''"
                    :style="{ backgroundColor: project.activeStartedAt ? '#10b981' : project.color }"
                    aria-hidden="true"
                  ></span>
                  <div class="min-w-0">
                    <div class="max-w-[280px] truncate font-semibold text-surface-dark">
                      {{ project.title }}
                    </div>
                    <div class="mt-px truncate text-xs text-surface-dark/55">
                      {{ project.clientName || "Client non renseigné" }}
                      <template v-if="projectQuotes(project).length">
                        ·
                        <span class="font-mono">{{
                          projectQuotes(project)
                            .map((quote) => quote.quoteRef)
                            .join(" + ")
                        }}</span>
                      </template>
                    </div>
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">
                <Tag
                  :value="projectStatusMeta[project.status].label"
                  :class="projectStatusMeta[project.status].tagClass"
                  rounded
                />
              </td>
              <td class="px-4 py-3">
                <div class="flex w-[150px] flex-col gap-1">
                  <span class="text-[13px] font-semibold text-surface-dark">
                    {{ formatDuration(projectSeconds(project), true) }}
                    <span v-if="projectBudgetHours(project)" class="font-normal text-surface-dark/45">
                      / {{ Math.round(projectBudgetHours(project)) }}h
                    </span>
                  </span>
                  <div v-if="projectBudgetHours(project)" class="h-1.5 overflow-hidden rounded-full bg-surface-dark/8">
                    <div
                      class="h-full rounded-full transition-[width]"
                      :class="timeBarClass(project)"
                      :style="{ width: `${Math.min(timeRatio(project) * 100, 100)}%` }"
                    ></div>
                  </div>
                </div>
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-right">
                <div class="font-semibold text-surface-dark">
                  {{ formatCurrency(projectTotalBudget(project)) }}
                </div>
              </td>
              <td
                class="whitespace-nowrap px-4 py-3 text-[13px]"
                :class="
                  isProjectOverdue(project)
                    ? 'font-semibold text-rose-700'
                    : 'text-surface-dark/70'
                "
                :title="isProjectOverdue(project) ? 'Échéance dépassée' : undefined"
              >
                {{ formatDate(project.dueDate) }}
              </td>
              <td class="whitespace-nowrap px-4 py-3 text-[13px] text-surface-dark/70">
                {{ formatRelativeDays(project.updatedAt || project.createdAt) }}
              </td>
              <td class="w-24 py-3 pr-6 text-right">
                <div class="flex items-center justify-end gap-1">
                  <button
                    v-if="project.status !== 'closed'"
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-full transition"
                    :class="
                      project.activeStartedAt
                        ? 'bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25'
                        : 'text-surface-dark/35 opacity-0 hover:bg-primary/10 hover:text-primary focus-visible:opacity-100 group-hover:opacity-100'
                    "
                    :title="project.activeStartedAt ? 'Arrêter le chrono' : 'Lancer le chrono'"
                    :aria-label="project.activeStartedAt ? 'Arrêter le chrono' : 'Lancer le chrono'"
                    @click.stop="toggleProjectTimer(project)"
                  >
                    <span class="material-symbols-outlined text-xl">
                      {{ project.activeStartedAt ? "stop_circle" : "play_circle" }}
                    </span>
                  </button>
                  <button
                    type="button"
                    class="rounded-lg p-1.5 text-surface-dark/35 opacity-0 transition hover:bg-surface-dark/6 hover:text-surface-dark focus-visible:opacity-100 group-hover:opacity-100"
                    :aria-label="`Actions sur le projet ${project.title}`"
                    @click.stop="openRowMenu($event, project.id)"
                  >
                    <span class="material-symbols-outlined text-lg">more_vert</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div
        class="flex flex-wrap items-center justify-between gap-4 border-t border-surface-dark/6 px-6 py-3.5 text-xs text-surface-dark/55"
      >
        <span>
          <strong class="font-semibold text-surface-dark">{{ sortedProjects.length }}</strong>
          projet{{ sortedProjects.length > 1 ? "s" : "" }} sur
          {{ projectsStore.projects.length }}
        </span>
      </div>
    </section>

    <Menu ref="rowMenu" :model="menuItems" popup />

    <ProjectFormDialog
      v-model:visible="dialogOpen"
      mode="create"
      :client-options="clientOptions"
      :color-options="colorPool"
      :default-hourly-rate="Number(authStore.userProfile?.hourlyRate || 0)"
      :default-color="colorPool[projectsStore.projects.length % colorPool.length]"
      @submit="saveProject"
    />
  </div>
</template>
