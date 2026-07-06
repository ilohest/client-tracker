<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import type {
  Project,
  ProjectInput,
  ProjectStatus,
  Quote,
  Timesheet,
} from "@client-tracker/contracts";
import Button from "primevue/button";
import ConfirmDialog from "primevue/confirmdialog";
import DatePicker from "primevue/datepicker";
import Dialog from "primevue/dialog";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Tag from "primevue/tag";
import Textarea from "primevue/textarea";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/authStore";
import { useClientsStore } from "@/stores/clientsStore";
import { useProjectsStore } from "@/stores/projectsStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { useTimesheetsStore } from "@/stores/timesheetsStore";
import {
  calculatePaymentScheduleStepAmounts,
  formatCurrency,
} from "@/utils/quote";

const authStore = useAuthStore();
const clientsStore = useClientsStore();
const projectsStore = useProjectsStore();
const quotesStore = useQuotesStore();
const timesheetsStore = useTimesheetsStore();
const confirm = useConfirm();
const toast = useToast();
const router = useRouter();

type ProjectMacroStatus = "all" | "active" | "waiting" | "ready" | "closed";

const dialogOpen = ref(false);
const editingProjectId = ref<string | null>(null);
const statusFilter = ref<ProjectMacroStatus>("all");
const projectSearch = ref("");
const projectDateRange = ref<Date[] | null>(null);
const newProjectNote = ref("");
const projectNoteDrafts = reactive<Record<string, string>>({});
const addMilestoneDialogOpen = ref(false);
const editingMilestoneId = ref<string | null>(null);
const draggedMilestoneId = ref<string | null>(null);
const milestoneDropTargetId = ref<string | null>(null);
const milestoneForm = reactive({
  label: "",
  kind: "custom" as NonNullable<Project["milestones"][number]["kind"]>,
});
const supplementForm = reactive({
  title: "",
  amountExVat: 0,
});

const colorPool = [
  "#e96a5f",
  "#2563eb",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#06b6d4",
  "#ef4444",
  "#64748b",
];

const form = reactive({
  title: "",
  clientId: "",
  description: "",
  budgetExVat: 0,
  hourlyRate: 0,
  invoicedExVat: 0,
  paidExVat: 0,
  dueDate: "",
  color: colorPool[0],
});

const statusOptions: Array<{ label: string; value: ProjectStatus }> = [
  { label: "Actif", value: "in_progress" },
  { label: "En attente", value: "blocked" },
  { label: "À facturer", value: "ready_to_invoice" },
  { label: "Clos", value: "closed" },
];
const filterOptions: Array<{ label: string; value: ProjectMacroStatus }> = [
  { label: "Tous", value: "all" },
  { label: "Actif", value: "active" },
  { label: "En attente", value: "waiting" },
  { label: "À facturer", value: "ready" },
  { label: "Clos", value: "closed" },
];
const macroStatusMeta: Record<
  ProjectMacroStatus,
  { label: string; class: string; icon: string }
> = {
  all: {
    label: "Tous",
    class: "!bg-surface-dark/8 !text-surface-dark",
    icon: "view_list",
  },
  active: {
    label: "Actif",
    class: "!bg-blue-500/12 !text-blue-700",
    icon: "play_circle",
  },
  waiting: {
    label: "En attente",
    class: "!bg-amber-500/12 !text-amber-700",
    icon: "pause_circle",
  },
  ready: {
    label: "À facturer",
    class: "!bg-amber-500/12 !text-amber-700",
    icon: "request_quote",
  },
  closed: {
    label: "Clos",
    class: "!bg-surface-dark/8 !text-surface-dark",
    icon: "archive",
  },
};
const clientOptions = computed(() =>
  clientsStore.clients.map((client) => ({
    label: client.name || client.contactEmail || "Client",
    value: client.id,
  })),
);
const selectedProject = computed(() => projectsStore.selectedProject);
const selectedTimesheet = computed(() =>
  selectedProject.value?.timesheetId
    ? timesheetsStore.timesheets.find(
        (item) => item.id === selectedProject.value?.timesheetId,
      ) || null
    : null,
);
const selectedQuote = computed(() =>
  selectedProject.value?.quoteId
    ? quotesStore.quotes.find(
        (item) => item.id === selectedProject.value?.quoteId,
      ) || null
    : null,
);

const milestoneKindOptions: Array<{
  label: string;
  value: NonNullable<Project["milestones"][number]["kind"]>;
}> = [
  { label: "Étape libre", value: "custom" },
  { label: "Travail", value: "work" },
  { label: "Validation client", value: "approval" },
  { label: "Facture envoyée", value: "invoice_sent" },
  { label: "Paiement reçu", value: "payment_received" },
];

const projectSupplementTotal = (project: Project) =>
  (project.projectSupplements || []).reduce(
    (total, supplement) => total + Number(supplement.amountExVat || 0),
    0,
  );

const projectBudgetBase = (project: Project) => {
  const quote = project.quoteId
    ? quotesStore.quotes.find((item) => item.id === project.quoteId)
    : null;
  return Number(quote?.subtotal ?? project.budgetExVat ?? 0);
};

const projectTotalBudget = (project: Project) =>
  projectBudgetBase(project) + projectSupplementTotal(project);

const currentYear = new Date().getFullYear();
const currentYearStart = `${currentYear}-01-01`;

const isDateOnOrAfter = (value: string | undefined, startDate = "") => {
  if (!startDate) return true;
  if (!value) return false;
  return value >= startDate;
};

const isMilestoneDone = (project: Project, label: string) =>
  project.milestones?.some(
    (milestone) => milestone.label === label && milestone.status === "done",
  ) || false;

const findPaymentReceivedMilestoneDone = (
  project: Project,
  index: number,
  stepId = "",
) =>
  project.milestones?.find((milestone) => {
    if (milestone.status !== "done") return false;
    if (milestone.kind === "payment_received") {
      if (stepId && milestone.paymentScheduleStepId === stepId) return true;
      return milestone.paymentScheduleIndex === index;
    }
    if (index === 0 && milestone.label === "Acompte reçu") return true;
    return false;
  }) || null;

const isPaymentReceivedMilestoneDone = (
  project: Project,
  index: number,
  stepId = "",
) => Boolean(findPaymentReceivedMilestoneDone(project, index, stepId));

const legacyFinalPaymentMilestone = (project: Project) =>
  project.milestones?.find(
    (milestone) =>
      milestone.status === "done" &&
      milestone.label === "Paiement final reçu" &&
      (!milestone.kind || milestone.paymentScheduleIndex === -1),
  ) || null;

const hasLegacyFinalPaymentDone = (project: Project) =>
  Boolean(legacyFinalPaymentMilestone(project));

const projectScheduledReceivedExVat = (project: Project, sinceDate = "") => {
  const quote = project.quoteId
    ? quotesStore.quotes.find((item) => item.id === project.quoteId)
    : null;
  if (!quote) {
    if (sinceDate && !isDateOnOrAfter(projectStartDate(project), sinceDate))
      return 0;
    return Number(project.invoicedExVat || project.paidExVat || 0);
  }

  const paymentSchedule = quote.paymentSchedule || [];
  if (!paymentSchedule.length) return 0;
  const legacyFinal = legacyFinalPaymentMilestone(project);
  if (legacyFinal && isDateOnOrAfter(legacyFinal.date, sinceDate))
    return Number(quote.subtotal || 0) + projectSupplementTotal(project);

  return paymentSchedule.reduce((total, step, index) => {
    const paymentMilestone = findPaymentReceivedMilestoneDone(
      project,
      index,
      step.id,
    );
    if (!paymentMilestone || !isDateOnOrAfter(paymentMilestone.date, sinceDate))
      return total;
    const isFinalPayment = index === paymentSchedule.length - 1;
    return (
      total +
      calculatePaymentScheduleStepAmounts(
        step,
        Number(quote.subtotal || 0),
        Number(quote.totalWithVat || 0),
      ).amountExcl +
      (isFinalPayment ? projectSupplementTotal(project) : 0)
    );
  }, 0);
};

const projectToInvoiceExVat = (project: Project) =>
  Math.max(
    0,
    projectTotalBudget(project) - projectScheduledReceivedExVat(project),
  );

const milestoneFinancialAmount = (
  project: Project,
  milestone: Project["milestones"][number],
) => {
  if (!["invoice_sent", "payment_received"].includes(milestone.kind || ""))
    return null;
  const quote = project.quoteId
    ? quotesStore.quotes.find((item) => item.id === project.quoteId)
    : null;
  const paymentSchedule = quote?.paymentSchedule || [];
  if (!quote || !paymentSchedule.length) return null;

  const scheduleIndexById = milestone.paymentScheduleStepId
    ? paymentSchedule.findIndex(
        (step) => step.id === milestone.paymentScheduleStepId,
      )
    : -1;
  const scheduleIndex =
    scheduleIndexById >= 0
      ? scheduleIndexById
      : typeof milestone.paymentScheduleIndex === "number" &&
          milestone.paymentScheduleIndex >= 0
        ? milestone.paymentScheduleIndex
        : milestone.label.toLowerCase().includes("final")
          ? paymentSchedule.length - 1
          : -1;
  const step = paymentSchedule[scheduleIndex];
  if (!step) return null;

  const amount =
    calculatePaymentScheduleStepAmounts(
      step,
      Number(quote.subtotal || 0),
      Number(quote.totalWithVat || 0),
    ).amountExcl +
    (scheduleIndex === paymentSchedule.length - 1
      ? projectSupplementTotal(project)
      : 0);

  return {
    amount,
    label:
      milestone.kind === "invoice_sent"
        ? `${formatCurrency(amount)}`
        : `${formatCurrency(amount)}`,
  };
};

const projectDepositPercent = (project: Project) => {
  const quote = project.quoteId
    ? quotesStore.quotes.find((item) => item.id === project.quoteId)
    : null;
  const firstPaymentStep = quote?.paymentSchedule?.[0];
  if (!quote || !firstPaymentStep) return 0;

  return calculatePaymentScheduleStepAmounts(
    firstPaymentStep,
    Number(quote.subtotal || 0),
    Number(quote.totalWithVat || 0),
  ).percent;
};

const projectPaymentProgressLabel = (project: Project) => {
  const quote = project.quoteId
    ? quotesStore.quotes.find((item) => item.id === project.quoteId)
    : null;
  const paymentSchedule = quote?.paymentSchedule || [];
  if (!quote || !paymentSchedule.length) return "";

  const receivedCount = paymentSchedule.filter((step, index) =>
    isPaymentReceivedMilestoneDone(project, index, step.id),
  ).length;
  const depositPercent = projectDepositPercent(project);
  if (paymentSchedule.length <= 1) return "Paiement final 100 %";
  if (depositPercent > 0) {
    return `${receivedCount}/${paymentSchedule.length} paiements reçus · acompte ${depositPercent.toFixed(0)} %`;
  }
  return `${receivedCount}/${paymentSchedule.length} paiements reçus`;
};

const acceptedQuotesWithoutProject = computed(() =>
  quotesStore.quotes.filter(
    (quote) =>
      quote.status === "accepted" &&
      !projectsStore.projects.some((project) => project.quoteId === quote.id),
  ),
);

const projectMacroStatus = (project: Project): ProjectMacroStatus => {
  if (["paid", "closed"].includes(project.status)) return "closed";
  if (["ready_to_invoice", "invoiced"].includes(project.status)) return "ready";
  if (
    project.status === "blocked" ||
    project.health === "blocked" ||
    ["deposit_pending", "client_review"].includes(project.status)
  )
    return "waiting";
  return "active";
};

const selectedProjectStatusValue = computed<ProjectStatus>(() => {
  if (!selectedProject.value) return "in_progress";
  const macroStatus = projectMacroStatus(selectedProject.value);
  if (macroStatus === "waiting") return "blocked";
  if (macroStatus === "ready") return "ready_to_invoice";
  if (macroStatus === "closed") return "closed";
  return "in_progress";
});

const totalBudget = computed(() =>
  projectsStore.activeProjects.reduce(
    (total, project) =>
      total +
      (isDateOnOrAfter(projectStartDate(project), currentYearStart)
        ? projectTotalBudget(project)
        : 0),
    0,
  ),
);
const totalInvoiced = computed(() =>
  projectsStore.projects.reduce(
    (total, project) =>
      total + projectScheduledReceivedExVat(project, currentYearStart),
    0,
  ),
);
const totalToInvoice = computed(() =>
  projectsStore.projects.reduce(
    (total, project) =>
      total +
      (isDateOnOrAfter(projectStartDate(project), currentYearStart)
        ? projectToInvoiceExVat(project)
        : 0),
    0,
  ),
);

const projectSeconds = (project: Project) => {
  const timesheet = project.timesheetId
    ? timesheetsStore.timesheets.find((item) => item.id === project.timesheetId)
    : timesheetsStore.timesheets.find((item) => item.projectId === project.id);
  return Number(timesheet?.totalTrackedSeconds || 0);
};

const formatDuration = (seconds: number) => {
  const hours = Math.floor(Math.max(0, seconds) / 3600);
  const minutes = Math.floor((Math.max(0, seconds) % 3600) / 60);
  return `${hours}h ${String(minutes).padStart(2, "0")}`;
};

const formatDate = (value?: string) => {
  if (!value) return "Non planifié";
  return new Intl.DateTimeFormat("fr-BE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
};

const todayIsoDate = () => new Date().toISOString().slice(0, 10);

const dateToIso = (date: Date) =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;

const projectStartDate = (project: Project) => project.startedAt || "";

const projectEndDate = (project: Project) => project.closedAt || "";

const daysBetween = (startDate?: string, endDate?: string) => {
  if (!startDate) return 0;
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const end = new Date(`${endDate || todayIsoDate()}T00:00:00`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  return Math.max(1, Math.floor((end - start) / 86_400_000) + 1);
};

const projectDurationParts = (project: Project) => {
  const days = daysBetween(projectStartDate(project), projectEndDate(project));
  return {
    days,
    weeks: Math.floor(days / 7),
    months: Math.floor(days / 30),
  };
};

const projectDurationLabel = (project: Project) => {
  const duration = projectDurationParts(project);
  if (!duration.days) return "Non démarré";
  return `${duration.days} j · ${duration.weeks} sem · ${duration.months} mois`;
};

const searchableProjectText = (project: Project) =>
  [
    project.title,
    project.clientName,
    project.quoteRef,
    project.description,
    project.notes,
    ...(project.projectNotes || []).map((note) => note.content),
    macroStatusMeta[projectMacroStatus(project)].label,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

const filteredProjects = computed(() => {
  const query = projectSearch.value.trim().toLowerCase();
  const [filterStart, filterEnd] = projectDateRange.value || [];
  const startFilter = filterStart ? dateToIso(filterStart) : "";
  const endFilter = filterEnd ? dateToIso(filterEnd) : startFilter;

  return projectsStore.projects.filter((project) => {
    if (
      statusFilter.value !== "all" &&
      projectMacroStatus(project) !== statusFilter.value
    )
      return false;
    if (query && !searchableProjectText(project).includes(query)) return false;
    const startDate = projectStartDate(project);
    if (
      startFilter &&
      (!startDate || startDate < startFilter || startDate > endFilter)
    )
      return false;
    return true;
  });
});

const projectProgress = (project: Project) => {
  const milestones = project.milestones || [];
  if (!milestones.length) return 0;
  return Math.round(
    (milestones.filter((item) => item.status === "done").length /
      milestones.length) *
      100,
  );
};

const projectNextMilestoneIndex = (project: Project) => {
  const milestones = project.milestones || [];
  return milestones.findIndex((milestone) => milestone.status !== "done");
};

const selectedNextMilestone = computed(() => {
  if (!selectedProject.value) return null;
  const nextIndex = projectNextMilestoneIndex(selectedProject.value);
  return nextIndex >= 0 ? selectedProject.value.milestones[nextIndex] : null;
});

const milestoneVisualState = (
  project: Project,
  milestone: Project["milestones"][number],
  index: number,
) => {
  if (milestone.status === "done") return "done";
  if (milestone.status === "blocked") return "blocked";
  return index === projectNextMilestoneIndex(project) ? "next" : "future";
};

const milestoneCardClass = (
  project: Project,
  milestone: Project["milestones"][number],
  index: number,
) => {
  const state = milestoneVisualState(project, milestone, index);
  if (state === "done") return "border-emerald-500/25 bg-emerald-500/5";
  if (state === "blocked") return "border-red-500/25 bg-red-500/5";
  if (state === "next") return "border-amber-500/35 bg-amber-500/8 shadow-sm";
  return "border-surface-dark/8 bg-white";
};

const milestoneIconClass = (
  project: Project,
  milestone: Project["milestones"][number],
  index: number,
) => {
  const state = milestoneVisualState(project, milestone, index);
  if (state === "done") return "bg-emerald-500/12 text-emerald-700";
  if (state === "blocked") return "bg-red-500/12 text-red-700";
  if (state === "next") return "bg-amber-500/14 text-amber-700";
  return "bg-surface-dark/6 text-surface-dark/45";
};

const milestoneIcon = (
  project: Project,
  milestone: Project["milestones"][number],
  index: number,
) => {
  const state = milestoneVisualState(project, milestone, index);
  if (state === "done") return "check";
  if (state === "blocked") return "block";
  if (state === "next") return "arrow_forward";
  return "radio_button_unchecked";
};

const milestoneBadge = (
  project: Project,
  milestone: Project["milestones"][number],
  index: number,
) => {
  const state = milestoneVisualState(project, milestone, index);
  if (state === "done")
    return { label: "Validée", class: "bg-emerald-500/12 text-emerald-700" };
  if (state === "blocked")
    return { label: "Bloquée", class: "bg-red-500/12 text-red-700" };
  if (state === "next")
    return { label: "Étape suivante", class: "bg-amber-500/14 text-amber-700" };
  return { label: "À venir", class: "bg-surface-dark/6 text-surface-dark/45" };
};

const resetForm = () => {
  editingProjectId.value = null;
  form.title = "";
  form.clientId = "";
  form.description = "";
  form.budgetExVat = 0;
  form.hourlyRate = Number(authStore.userProfile?.hourlyRate || 0);
  form.invoicedExVat = 0;
  form.paidExVat = 0;
  form.dueDate = "";
  form.color = colorPool[projectsStore.projects.length % colorPool.length];
};

const openCreateDialog = () => {
  resetForm();
  dialogOpen.value = true;
};

const openEditDialog = () => {
  const project = selectedProject.value;
  if (!project) return;
  editingProjectId.value = project.id;
  form.title = project.title;
  form.clientId = project.clientId || "";
  form.description = project.description || "";
  form.budgetExVat = Number(project.budgetExVat || 0);
  form.hourlyRate = Number(project.hourlyRate || 0);
  form.invoicedExVat = Number(project.invoicedExVat || 0);
  form.paidExVat = Number(project.paidExVat || 0);
  form.dueDate = project.dueDate || "";
  form.color = project.color || colorPool[0];
  dialogOpen.value = true;
};

const createProjectPayload = (): ProjectInput => {
  const client = clientsStore.clients.find((item) => item.id === form.clientId);
  return {
    title: form.title.trim() || "Projet sans titre",
    description: form.description.trim(),
    notes: "",
    projectNotes: [],
    projectSupplements: [],
    sourceType: "custom",
    quoteId: "",
    quoteRef: "",
    timesheetId: "",
    clientId: form.clientId,
    clientName: client?.name || "",
    color: form.color,
    status: "in_progress",
    health: "ok",
    budgetExVat: Number(form.budgetExVat || 0),
    invoicedExVat: Number(form.invoicedExVat || 0),
    paidExVat: Number(form.paidExVat || 0),
    hourlyRate: Number(form.hourlyRate || 0),
    startedAt: new Date().toISOString().slice(0, 10),
    dueDate: form.dueDate,
    closedAt: "",
    blockedReason: "",
    nextAction: "",
    milestones: [
      {
        id: crypto.randomUUID(),
        label: "Projet créé",
        status: "done",
        date: new Date().toISOString().slice(0, 10),
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
        label: "Facture finale envoyée",
        status: "todo",
        date: "",
        kind: "invoice_sent",
      },
      {
        id: crypto.randomUUID(),
        label: "Paiement reçu",
        status: "todo",
        date: "",
        kind: "payment_received",
      },
    ],
  };
};

const saveProject = async () => {
  if (editingProjectId.value) {
    const client = clientsStore.clients.find(
      (item) => item.id === form.clientId,
    );
    await projectsStore.updateProject(editingProjectId.value, {
      title: form.title.trim() || "Projet sans titre",
      clientId: form.clientId,
      clientName: client?.name || selectedProject.value?.clientName || "",
      description: form.description.trim(),
      budgetExVat: Number(form.budgetExVat || 0),
      invoicedExVat: Number(form.invoicedExVat || 0),
      paidExVat: Number(form.paidExVat || 0),
      hourlyRate: Number(form.hourlyRate || 0),
      dueDate: form.dueDate,
      color: form.color,
    });
    toast.add({
      severity: "success",
      summary: "Projet enregistré",
      life: 2200,
    });
  } else {
    const project = await projectsStore.createProject(createProjectPayload());
    const timesheet = await timesheetsStore.createTimesheet({
      projectId: project.id,
      title: project.title,
      sourceType: "custom",
      quoteId: "",
      quoteRef: "",
      clientId: project.clientId || "",
      clientName: project.clientName || "",
      color: project.color,
      hourlyRate: project.hourlyRate,
      fixedPriceExVat: project.budgetExVat,
      projectStartDate: project.startedAt || "",
      status: "open",
      activeStartedAt: "",
    });
    await projectsStore.updateProject(project.id, {
      timesheetId: timesheet.id,
    });
    toast.add({
      severity: "success",
      summary: "Projet créé",
      detail: "La timesheet liée est prête.",
      life: 2600,
    });
  }
  dialogOpen.value = false;
};

const createFromQuote = async (quote: Quote) => {
  try {
    const color = colorPool[projectsStore.projects.length % colorPool.length];
    await projectsStore.createFromQuote(
      quote,
      Number(authStore.userProfile?.hourlyRate || 0),
      color,
    );
    toast.add({
      severity: "success",
      summary: "Projet créé",
      detail: "Le devis et la timesheet sont liés.",
      life: 2600,
    });
  } catch (error: any) {
    toast.add({
      severity: "error",
      summary: "Projet indisponible",
      detail: error.message || "Impossible de créer le projet.",
      life: 4200,
    });
  }
};

const setMilestoneStatus = async (
  project: Project,
  milestoneId: string,
  status: Project["milestones"][number]["status"],
) => {
  const milestones = project.milestones.map((milestone) =>
    milestone.id === milestoneId
      ? {
          ...milestone,
          status,
          date:
            status === "done" && !milestone.date
              ? new Date().toISOString().slice(0, 10)
              : status === "todo"
                ? ""
                : milestone.date,
        }
      : milestone,
  );
  await projectsStore.updateProject(project.id, { milestones });
};

const toggleMilestoneDone = async (
  project: Project,
  milestone: Project["milestones"][number],
) => {
  await setMilestoneStatus(
    project,
    milestone.id,
    milestone.status === "done" ? "todo" : "done",
  );
};

const defaultMilestoneLabel = (
  kind: NonNullable<Project["milestones"][number]["kind"]>,
) => {
  if (kind === "invoice_sent") return "Facture envoyée";
  if (kind === "payment_received") return "Paiement reçu";
  if (kind === "work") return "Travail en cours";
  if (kind === "approval") return "Validation client";
  return "Nouvelle étape";
};

const openAddMilestoneDialog = () => {
  if (!selectedProject.value) return;
  editingMilestoneId.value = null;
  milestoneForm.kind = "custom";
  milestoneForm.label = "";
  addMilestoneDialogOpen.value = true;
};

const openEditMilestoneDialog = (milestone: Project["milestones"][number]) => {
  editingMilestoneId.value = milestone.id;
  milestoneForm.kind = milestone.kind || "custom";
  milestoneForm.label = milestone.label;
  addMilestoneDialogOpen.value = true;
};

const closeMilestoneDialog = () => {
  addMilestoneDialogOpen.value = false;
  editingMilestoneId.value = null;
};

const addMilestone = async () => {
  const project = selectedProject.value;
  if (!project) return;
  const kind = milestoneForm.kind;
  const label = milestoneForm.label.trim() || defaultMilestoneLabel(kind);
  if (editingMilestoneId.value) {
    const milestones = project.milestones.map((milestone) =>
      milestone.id === editingMilestoneId.value
        ? { ...milestone, label, kind }
        : milestone,
    );
    await projectsStore.updateProject(project.id, { milestones });
    closeMilestoneDialog();
    toast.add({ severity: "success", summary: "Étape modifiée", life: 2200 });
    return;
  }

  const insertedMilestones: Project["milestones"] = [
    {
      id: crypto.randomUUID(),
      label,
      status: "todo",
      date: "",
      kind,
      paymentScheduleStepId: "",
      paymentScheduleIndex: -1,
    },
  ];

  if (kind === "invoice_sent") {
    insertedMilestones.push({
      id: crypto.randomUUID(),
      label: "Paiement reçu",
      status: "todo",
      date: "",
      kind: "payment_received",
      paymentScheduleStepId: "",
      paymentScheduleIndex: -1,
    });
  }

  const milestones = [...project.milestones, ...insertedMilestones];

  await projectsStore.updateProject(project.id, { milestones });
  closeMilestoneDialog();
  toast.add({
    severity: "success",
    summary:
      insertedMilestones.length > 1 ? "Étapes ajoutées" : "Étape ajoutée",
    life: 2200,
  });
};

const confirmDeleteMilestone = (milestoneId: string) => {
  const project = selectedProject.value;
  if (!project) return;
  confirm.require({
    message: "Supprimer cette étape de la ligne du temps ?",
    header: "Supprimer l'étape",
    icon: "pi pi-exclamation-triangle",
    rejectProps: { label: "Annuler", severity: "secondary", outlined: true },
    acceptProps: { label: "Supprimer", severity: "danger" },
    accept: async () => {
      await projectsStore.updateProject(project.id, {
        milestones: project.milestones.filter(
          (milestone) => milestone.id !== milestoneId,
        ),
      });
      toast.add({
        severity: "secondary",
        summary: "Étape supprimée",
        life: 2000,
      });
    },
  });
};

const startMilestoneDrag = (
  event: DragEvent,
  milestone: Project["milestones"][number],
) => {
  draggedMilestoneId.value = milestone.id;
  event.dataTransfer?.setData("text/plain", milestone.id);
  if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
};

const handleMilestoneDragOver = (
  event: DragEvent,
  milestone: Project["milestones"][number],
) => {
  event.preventDefault();
  if (draggedMilestoneId.value && draggedMilestoneId.value !== milestone.id) {
    milestoneDropTargetId.value = milestone.id;
  }
};

const resetMilestoneDrag = () => {
  draggedMilestoneId.value = null;
  milestoneDropTargetId.value = null;
};

const dropMilestone = async (
  event: DragEvent,
  targetMilestone: Project["milestones"][number],
) => {
  event.preventDefault();
  const project = selectedProject.value;
  const draggedId =
    draggedMilestoneId.value || event.dataTransfer?.getData("text/plain");
  resetMilestoneDrag();
  if (!project || !draggedId || draggedId === targetMilestone.id) return;

  const milestones = [...project.milestones];
  const fromIndex = milestones.findIndex(
    (milestone) => milestone.id === draggedId,
  );
  const toIndex = milestones.findIndex(
    (milestone) => milestone.id === targetMilestone.id,
  );
  if (fromIndex < 0 || toIndex < 0) return;

  const [moved] = milestones.splice(fromIndex, 1);
  milestones.splice(toIndex, 0, moved);
  await projectsStore.updateProject(project.id, { milestones });
};

const addProjectSupplement = async () => {
  const project = selectedProject.value;
  if (!project || !supplementForm.title.trim()) return;
  const supplement = {
    id: crypto.randomUUID(),
    title: supplementForm.title.trim(),
    amountExVat: Number(supplementForm.amountExVat || 0),
    createdAt: todayIsoDate(),
  };
  await projectsStore.updateProject(project.id, {
    projectSupplements: [...(project.projectSupplements || []), supplement],
  });
  supplementForm.title = "";
  supplementForm.amountExVat = 0;
  toast.add({ severity: "success", summary: "Supplément ajouté", life: 2200 });
};

const deleteProjectSupplement = async (supplementId: string) => {
  const project = selectedProject.value;
  if (!project) return;
  await projectsStore.updateProject(project.id, {
    projectSupplements: (project.projectSupplements || []).filter(
      (supplement) => supplement.id !== supplementId,
    ),
  });
  toast.add({
    severity: "secondary",
    summary: "Supplément supprimé",
    life: 1800,
  });
};

const updateStatus = async (status: ProjectStatus) => {
  if (!selectedProject.value) return;
  const isClosed = ["paid", "closed"].includes(status);
  await projectsStore.updateProject(selectedProject.value.id, {
    status,
    closedAt: isClosed ? selectedProject.value.closedAt || todayIsoDate() : "",
    health:
      status === "blocked"
        ? "blocked"
        : selectedProject.value.health === "blocked"
          ? "watch"
          : selectedProject.value.health,
  });
};

const projectNotes = computed(() => selectedProject.value?.projectNotes || []);

const addProjectNote = async () => {
  if (!selectedProject.value || !newProjectNote.value.trim()) return;
  const now = new Date().toISOString();
  const note = {
    id: crypto.randomUUID(),
    content: newProjectNote.value.trim(),
    createdAt: now,
    updatedAt: now,
  };
  await projectsStore.updateProject(selectedProject.value.id, {
    projectNotes: [note, ...projectNotes.value],
    notes: "",
  });
  projectNoteDrafts[note.id] = note.content;
  newProjectNote.value = "";
  toast.add({ severity: "success", summary: "Note ajoutée", life: 2000 });
};

const hasProjectNoteChanges = (note: Project["projectNotes"][number]) =>
  (projectNoteDrafts[note.id] ?? note.content) !== note.content;

const updateProjectNoteDraft = (noteId: string, value: string | undefined) => {
  projectNoteDrafts[noteId] = value || "";
};

const saveProjectNote = async (note: Project["projectNotes"][number]) => {
  if (!selectedProject.value || !hasProjectNoteChanges(note)) return;
  const content = projectNoteDrafts[note.id] ?? "";
  const nextNotes = projectNotes.value.map((item) =>
    item.id === note.id
      ? { ...item, content, updatedAt: new Date().toISOString() }
      : item,
  );
  await projectsStore.updateProject(selectedProject.value.id, {
    projectNotes: nextNotes,
    notes: "",
  });
  toast.add({ severity: "success", summary: "Note mise à jour", life: 2000 });
};

const confirmDeleteProjectNote = (noteId: string) => {
  if (!selectedProject.value) return;
  const projectId = selectedProject.value.id;
  confirm.require({
    message: "Voulez-vous vraiment supprimer cette note ?",
    header: "Supprimer la note",
    icon: "info",
    rejectProps: { label: "Annuler", severity: "secondary", outlined: true },
    acceptProps: { label: "Supprimer", severity: "danger" },
    accept: async () => {
      const nextNotes = projectNotes.value.filter((note) => note.id !== noteId);
      await projectsStore.updateProject(projectId, {
        projectNotes: nextNotes,
        notes: "",
      });
      delete projectNoteDrafts[noteId];
      toast.add({ severity: "info", summary: "Note supprimée", life: 2000 });
    },
  });
};

const deleteSelected = () => {
  const project = selectedProject.value;
  if (!project) return;
  confirm.require({
    message: `Supprimer "${project.title}" ? La timesheet liée ne sera pas supprimée automatiquement.`,
    header: "Supprimer le projet",
    icon: "pi pi-exclamation-triangle",
    rejectProps: { label: "Annuler", severity: "secondary", outlined: true },
    acceptProps: { label: "Supprimer", severity: "danger" },
    accept: async () => {
      await projectsStore.deleteProject(project.id);
      toast.add({
        severity: "secondary",
        summary: "Projet supprimé",
        life: 2200,
      });
    },
  });
};

const openQuote = () => {
  if (!selectedQuote.value) return;
  quotesStore.selectQuote(selectedQuote.value.id);
  router.push({ name: "quotes" });
};

const openTimesheet = () => {
  const timesheet = selectedTimesheet.value;
  if (!timesheet) return;
  timesheetsStore.selectTimesheet(timesheet.id);
  router.push({ name: "timesheets" });
};

const openClient = () => {
  if (!selectedProject.value?.clientId) return;
  clientsStore.selectClient(selectedProject.value.clientId);
  router.push({ name: "clients" });
};

watch(filteredProjects, (projects) => {
  if (!projects.length) return;
  if (
    !selectedProject.value ||
    !projects.some((project) => project.id === selectedProject.value?.id)
  ) {
    projectsStore.selectProject(projects[0].id);
  }
});

watch(
  () =>
    [selectedProject.value?.id, selectedProject.value?.projectNotes] as const,
  () => {
    const currentIds = new Set(projectNotes.value.map((note) => note.id));
    for (const note of projectNotes.value) {
      if (projectNoteDrafts[note.id] === undefined)
        projectNoteDrafts[note.id] = note.content;
    }
    for (const id of Object.keys(projectNoteDrafts)) {
      if (!currentIds.has(id)) delete projectNoteDrafts[id];
    }
    newProjectNote.value = "";
  },
  { immediate: true },
);

onMounted(async () => {
  await Promise.all([
    projectsStore.projects.length
      ? Promise.resolve()
      : projectsStore.fetchProjects(),
    quotesStore.quotes.length ? Promise.resolve() : quotesStore.fetchQuotes(),
    clientsStore.clients.length
      ? Promise.resolve()
      : clientsStore.fetchClients(),
    timesheetsStore.timesheets.length
      ? Promise.resolve()
      : timesheetsStore.fetchTimesheets(),
  ]);
});
</script>

<template>
  <div class="flex flex-col gap-6 p-2">
    <ConfirmDialog />

    <div
      class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"
    >
      <div class="flex items-start gap-3">
        <span
          class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10"
        >
          <span class="material-symbols-outlined text-2xl text-primary"
            >workspaces</span
          >
        </span>
        <div>
          <h1 class="text-3xl font-heading font-bold text-surface-dark">
            Projets
          </h1>
          <p class="mt-1 text-sm text-surface-dark/55">
            Le cockpit entre devis, temps, facturation et validation client.
          </p>
        </div>
      </div>
      <Button label="Nouveau projet" @click="openCreateDialog">
        <template #icon
          ><span class="material-symbols-outlined text-lg">add</span></template
        >
      </Button>
    </div>

    <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
      <div class="rounded-2xl border border-surface-dark/5 bg-white p-4">
        <p
          class="text-xs font-bold uppercase tracking-wide text-surface-dark/40"
        >
          Budget actif · {{ currentYear }}
        </p>
        <p class="mt-2 text-2xl font-bold text-surface-dark">
          {{ formatCurrency(totalBudget) }}
        </p>
      </div>
      <div class="rounded-2xl border border-surface-dark/5 bg-white p-4">
        <p
          class="text-xs font-bold uppercase tracking-wide text-surface-dark/40"
        >
          À facturer · {{ currentYear }}
        </p>
        <p class="mt-2 text-2xl font-bold text-amber-600">
          {{ formatCurrency(totalToInvoice) }}
        </p>
      </div>
      <div class="rounded-2xl border border-surface-dark/5 bg-white p-4">
        <p
          class="text-xs font-bold uppercase tracking-wide text-surface-dark/40"
        >
          Facturé · {{ currentYear }}
        </p>
        <p class="mt-2 text-2xl font-bold text-surface-dark">
          {{ formatCurrency(totalInvoiced) }}
        </p>
      </div>
    </div>

    <div
      v-if="acceptedQuotesWithoutProject.length"
      class="rounded-3xl border border-dashed border-primary/25 bg-primary/5 p-4"
    >
      <div class="mb-3 flex items-center gap-2">
        <span class="material-symbols-outlined text-primary"
          >auto_awesome_motion</span
        >
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
          <p class="mt-3 text-sm font-bold text-primary">
            {{ formatCurrency(quote.subtotal) }}
          </p>
        </button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
      <aside
        class="h-full rounded-3xl border border-surface-dark/5 bg-surface-card p-4 xl:sticky xl:top-6 xl:max-h-[85vh] xl:self-start xl:overflow-y-auto"
      >
        <div class="sticky top-0 z-10 pb-4">
          <div class="flex flex-col gap-2.5">
            <InputText
              v-model="projectSearch"
              placeholder="Rechercher un projet"
              class="w-full"
            />
            <Select
              v-model="statusFilter"
              :options="filterOptions"
              option-label="label"
              option-value="value"
              placeholder="Statut"
              class="w-full"
            />
            <DatePicker
              v-model="projectDateRange"
              selection-mode="range"
              :manual-input="false"
              date-format="dd/mm/yy"
              show-icon
              icon-display="input"
              show-button-bar
              placeholder="Filtrer par période"
              class="w-full"
              @update:model-value="
                projectDateRange = Array.isArray($event)
                  ? ($event.filter(Boolean) as Date[])
                  : null
              "
            />
          </div>
        </div>

        <div v-if="filteredProjects.length" class="flex flex-col gap-2.5">
          <button
            v-for="project in filteredProjects"
            :key="project.id"
            type="button"
            class="w-full rounded-2xl border p-3.5 text-left transition-all duration-150"
            :class="
              selectedProject?.id === project.id
                ? 'border-primary/30 bg-primary/8 ring-1 ring-primary/20'
                : projectMacroStatus(project) === 'closed'
                  ? 'border-surface-dark/8 bg-surface-dark/[0.035] hover:border-primary/25 hover:shadow-sm'
                  : 'border-surface-dark/8 bg-white hover:border-primary/25 hover:shadow-sm'
            "
            @click="projectsStore.selectProject(project.id)"
          >
            <div class="flex items-start gap-3">
              <span
                class="mt-1 h-3 w-3 shrink-0 rounded-full"
                :style="{ backgroundColor: project.color }"
              ></span>
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-sm font-bold text-surface-dark"
                  >{{ project.title }}</span
                >
                <span class="block truncate text-xs text-surface-dark/50"
                  >{{ project.clientName || "Sans client" }} ·
                  {{ formatCurrency(projectTotalBudget(project)) }}</span
                >
                <span
                  class="mt-1 block truncate text-[11px] text-surface-dark/40"
                >
                  Début {{ formatDate(projectStartDate(project)) }} ·
                  {{ projectDurationLabel(project) }}
                </span>
              </span>
              <span
                class="material-symbols-outlined text-lg"
                :class="
                  projectMacroStatus(project) === 'waiting'
                    ? 'text-amber-600'
                    : projectMacroStatus(project) === 'closed'
                      ? 'text-surface-dark/45'
                      : 'text-emerald-500'
                "
              >
                {{ macroStatusMeta[projectMacroStatus(project)].icon }}
              </span>
            </div>
            <div
              class="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-dark/6"
            >
              <div
                class="h-full rounded-full bg-primary"
                :style="{ width: `${projectProgress(project)}%` }"
              ></div>
            </div>
          </button>
        </div>
        <p
          v-else
          class="rounded-2xl border border-dashed border-surface-dark/10 p-6 text-center text-sm text-surface-dark/50"
        >
          Aucun projet dans cette vue.
        </p>
      </aside>

      <section
        v-if="selectedProject"
        class="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]"
      >
        <div class="flex flex-col gap-6">
          <div
            class="rounded-3xl border border-surface-dark/5 bg-surface-card p-6 md:p-7"
          >
            <div
              class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
            >
              <div class="min-w-0">
                <div class="mb-2 flex flex-wrap items-center gap-2">
                  <Tag
                    :value="
                      macroStatusMeta[projectMacroStatus(selectedProject)].label
                    "
                    :class="
                      macroStatusMeta[projectMacroStatus(selectedProject)].class
                    "
                    rounded
                  />
                  <span
                    class="text-xs font-bold uppercase tracking-wide text-surface-dark/40"
                  >
                    {{
                      selectedProject.sourceType === "quote"
                        ? selectedProject.quoteRef || "Devis lié"
                        : "Hors devis"
                    }}
                  </span>
                </div>
                <h2 class="text-2xl font-bold text-surface-dark">
                  {{ selectedProject.title }}
                </h2>
                <p class="mt-1 text-sm text-surface-dark/55">
                  {{ selectedProject.clientName || "Client non renseigné" }}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <Select
                  :model-value="selectedProjectStatusValue"
                  :options="statusOptions"
                  option-label="label"
                  option-value="value"
                  class="w-44"
                  @update:model-value="updateStatus($event)"
                />
                <Button
                  text
                  rounded
                  severity="secondary"
                  aria-label="Modifier"
                  title="Modifier"
                  @click="openEditDialog"
                >
                  <template #icon
                    ><span class="material-symbols-outlined text-lg"
                      >edit</span
                    ></template
                  >
                </Button>
                <Button
                  text
                  rounded
                  severity="danger"
                  aria-label="Supprimer"
                  title="Supprimer"
                  @click="deleteSelected"
                >
                  <template #icon
                    ><span class="material-symbols-outlined text-lg"
                      >delete</span
                    ></template
                  >
                </Button>
              </div>
            </div>

            <div class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <div
                class="flex min-h-[104px] flex-col justify-between rounded-2xl border border-surface-dark/6 bg-white p-4"
              >
                <p
                  class="text-xs font-bold uppercase tracking-wide text-surface-dark/40"
                >
                  Budget HT
                </p>
                <p
                  class="mt-3 break-words text-xl font-bold leading-tight text-surface-dark"
                >
                  {{ formatCurrency(projectTotalBudget(selectedProject)) }}
                </p>
                <p
                  v-if="projectSupplementTotal(selectedProject)"
                  class="mt-2 text-xs font-semibold text-surface-dark/45"
                >
                  Base
                  {{ formatCurrency(projectBudgetBase(selectedProject)) }} ·
                  suppl.
                  {{ formatCurrency(projectSupplementTotal(selectedProject)) }}
                </p>
              </div>
              <div
                class="flex min-h-[104px] flex-col justify-between rounded-2xl border border-surface-dark/6 bg-white p-4"
              >
                <p
                  class="text-xs font-bold uppercase tracking-wide text-surface-dark/40"
                >
                  Temps investi
                </p>
                <p
                  class="mt-3 text-xl font-bold leading-tight text-surface-dark"
                >
                  {{ formatDuration(projectSeconds(selectedProject)) }}
                </p>
              </div>
              <div
                class="flex min-h-[104px] flex-col justify-between rounded-2xl border border-surface-dark/6 bg-white p-4"
              >
                <p
                  class="text-xs font-bold uppercase tracking-wide text-surface-dark/40"
                >
                  Facturé
                </p>
                <p
                  class="mt-3 break-words text-xl font-bold leading-tight text-surface-dark"
                >
                  {{
                    formatCurrency(
                      projectScheduledReceivedExVat(selectedProject),
                    )
                  }}
                </p>
                <p
                  v-if="projectPaymentProgressLabel(selectedProject)"
                  class="mt-2 text-xs font-semibold text-surface-dark/45"
                >
                  {{ projectPaymentProgressLabel(selectedProject) }}
                </p>
              </div>
              <div
                class="flex min-h-[104px] flex-col justify-between rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4"
              >
                <p
                  class="text-xs font-bold uppercase tracking-wide text-amber-700/70"
                >
                  À facturer
                </p>
                <p
                  class="mt-3 break-words text-xl font-bold leading-tight text-amber-700"
                >
                  {{ formatCurrency(projectToInvoiceExVat(selectedProject)) }}
                </p>
              </div>
              <div
                class="flex min-h-[104px] flex-col justify-between rounded-2xl border border-surface-dark/6 bg-white p-4"
              >
                <p
                  class="text-xs font-bold uppercase tracking-wide text-surface-dark/40"
                >
                  Début
                </p>
                <p
                  class="mt-3 text-sm font-bold leading-snug text-surface-dark"
                >
                  {{ formatDate(projectStartDate(selectedProject)) }}
                </p>
              </div>
              <div
                class="flex min-h-[104px] flex-col justify-between rounded-2xl border border-surface-dark/6 bg-white p-4"
              >
                <p
                  class="text-xs font-bold uppercase tracking-wide text-surface-dark/40"
                >
                  Échéance
                </p>
                <p
                  class="mt-3 text-sm font-bold leading-snug text-surface-dark"
                >
                  {{ formatDate(selectedProject.dueDate) }}
                </p>
              </div>
              <div
                class="flex min-h-[104px] flex-col justify-between rounded-2xl border border-surface-dark/6 bg-white p-4"
              >
                <p
                  class="text-xs font-bold uppercase tracking-wide text-surface-dark/40"
                >
                  Clôture
                </p>
                <p
                  class="mt-3 text-sm font-bold leading-snug text-surface-dark"
                >
                  {{
                    projectEndDate(selectedProject)
                      ? formatDate(projectEndDate(selectedProject))
                      : "En cours"
                  }}
                </p>
              </div>
              <div
                class="flex min-h-[104px] flex-col justify-between rounded-2xl border border-primary/12 bg-primary/5 p-4"
              >
                <p
                  class="text-xs font-bold uppercase tracking-wide text-primary/70"
                >
                  Durée
                </p>
                <p class="mt-3 text-sm font-bold leading-snug text-primary">
                  {{ projectDurationLabel(selectedProject) }}
                </p>
              </div>
            </div>
          </div>

          <div
            class="rounded-3xl border border-surface-dark/5 bg-surface-card p-6"
          >
            <div
              class="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <h3 class="text-lg font-bold text-surface-dark">
                  Ligne du temps
                </h3>
                <p class="text-sm text-surface-dark/50">
                  De l'acceptation du devis au paiement final.
                </p>
              </div>
              <Button
                label="Ajouter une étape"
                severity="secondary"
                outlined
                class="!rounded-xl"
                @click="openAddMilestoneDialog()"
              >
                <template #icon
                  ><span class="material-symbols-outlined text-lg"
                    >add</span
                  ></template
                >
              </Button>
            </div>

            <div class="grid gap-3 lg:grid-cols-2">
              <div
                v-for="(milestone, index) in selectedProject.milestones"
                :key="milestone.id"
                draggable="true"
                class="relative cursor-grab rounded-2xl border p-4 transition-all active:cursor-grabbing"
                :class="[
                  milestoneCardClass(selectedProject, milestone, index),
                  draggedMilestoneId === milestone.id ? 'opacity-45' : '',
                  milestoneDropTargetId === milestone.id
                    ? 'ring-2 ring-primary/25'
                    : '',
                ]"
                @dragstart="startMilestoneDrag($event, milestone)"
                @dragover="handleMilestoneDragOver($event, milestone)"
                @dragleave="
                  milestoneDropTargetId === milestone.id &&
                  (milestoneDropTargetId = null)
                "
                @drop="dropMilestone($event, milestone)"
                @dragend="resetMilestoneDrag"
              >
                <div class="flex h-full flex-col gap-3 justify-between">
                  <div class="flex items-start gap-3">
                    <span
                      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      :class="
                        milestoneIconClass(selectedProject, milestone, index)
                      "
                    >
                      <span class="material-symbols-outlined text-lg">
                        {{ milestoneIcon(selectedProject, milestone, index) }}
                      </span>
                    </span>
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <p
                          class="text-xs font-bold uppercase tracking-wide text-surface-dark/35"
                        >
                          Étape {{ index + 1 }}
                        </p>
                        <span
                          class="rounded-full px-2 py-0.5 text-[11px] font-bold"
                          :class="
                            milestoneBadge(selectedProject, milestone, index)
                              .class
                          "
                        >
                          {{
                            milestoneBadge(selectedProject, milestone, index)
                              .label
                          }}
                        </span>
                      </div>
                      <p class="font-bold text-surface-dark">
                        {{ milestone.label }}
                      </p>
                      <p class="mt-1 text-xs text-surface-dark/45">
                        {{ formatDate(milestone.date) }}
                      </p>
                      <p
                        v-if="
                          milestoneFinancialAmount(selectedProject, milestone)
                        "
                        class="mt-2 inline-flex rounded-full bg-white/75 px-2.5 py-1 text-xs font-bold text-surface-dark shadow-sm ring-1 ring-surface-dark/8"
                      >
                        {{
                          milestoneFinancialAmount(selectedProject, milestone)
                            ?.label
                        }}
                      </p>
                    </div>
                    <div class="flex gap-1">
                      <Button
                        text
                        rounded
                        severity="success"
                        :aria-label="
                          milestone.status === 'done' ? 'Décocher' : 'Terminer'
                        "
                        :title="
                          milestone.status === 'done' ? 'Décocher' : 'Terminer'
                        "
                        @click="toggleMilestoneDone(selectedProject, milestone)"
                      >
                        <template #icon
                          ><span class="material-symbols-outlined text-lg">{{
                            milestone.status === "done" ? "check_box" : "check"
                          }}</span></template
                        >
                      </Button>
                      <Button
                        text
                        rounded
                        severity="danger"
                        aria-label="Bloquer"
                        title="Bloquer"
                        @click="
                          setMilestoneStatus(
                            selectedProject,
                            milestone.id,
                            'blocked',
                          )
                        "
                      >
                        <template #icon
                          ><span class="material-symbols-outlined text-lg"
                            >block</span
                          ></template
                        >
                      </Button>
                    </div>
                  </div>
                  <div
                    class="flex justify-end gap-1 border-t border-surface-dark/6 pt-2"
                  >
                    <Button
                      text
                      rounded
                      severity="secondary"
                      aria-label="Modifier"
                      title="Modifier"
                      @click="openEditMilestoneDialog(milestone)"
                    >
                      <template #icon
                        ><span class="material-symbols-outlined text-lg"
                          >edit</span
                        ></template
                      >
                    </Button>
                    <Button
                      text
                      rounded
                      severity="danger"
                      aria-label="Supprimer"
                      title="Supprimer"
                      @click="confirmDeleteMilestone(milestone.id)"
                    >
                      <template #icon
                        ><span class="material-symbols-outlined text-lg"
                          >delete</span
                        ></template
                      >
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div
            class="rounded-3xl border border-surface-dark/5 bg-surface-card p-6"
          >
            <div
              class="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between"
            >
              <div>
                <h3 class="text-lg font-bold text-surface-dark">
                  Suppléments payants
                </h3>
                <p class="text-sm text-surface-dark/50">
                  Ajouts hors devis pris en compte dans le budget total.
                </p>
              </div>
              <span
                class="rounded-full bg-amber-500/10 px-3 py-1 text-sm font-bold text-amber-700"
              >
                {{ formatCurrency(projectSupplementTotal(selectedProject)) }}
              </span>
            </div>

            <div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_auto]">
              <InputText
                v-model="supplementForm.title"
                placeholder="Ex. Page supplémentaire, intégration, urgence..."
              />
              <InputNumber
                v-model="supplementForm.amountExVat"
                mode="currency"
                currency="EUR"
                locale="fr-BE"
              />
              <Button
                label="Ajouter"
                :disabled="
                  !supplementForm.title.trim() ||
                  Number(supplementForm.amountExVat || 0) <= 0
                "
                class="!rounded-xl"
                @click="addProjectSupplement"
              >
                <template #icon
                  ><span class="material-symbols-outlined text-lg"
                    >add</span
                  ></template
                >
              </Button>
            </div>

            <div class="mt-4 grid gap-2">
              <div
                v-for="supplement in selectedProject.projectSupplements || []"
                :key="supplement.id"
                class="flex items-center justify-between gap-3 rounded-2xl border border-surface-dark/8 bg-white p-3"
              >
                <div class="min-w-0">
                  <p class="truncate text-sm font-bold text-surface-dark">
                    {{ supplement.title }}
                  </p>
                  <p class="text-xs text-surface-dark/40">
                    {{ formatDate(supplement.createdAt) }}
                  </p>
                </div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold text-surface-dark">
                    {{ formatCurrency(supplement.amountExVat) }}
                  </span>
                  <Button
                    text
                    rounded
                    severity="danger"
                    aria-label="Supprimer"
                    title="Supprimer"
                    @click="deleteProjectSupplement(supplement.id)"
                  >
                    <template #icon
                      ><span class="material-symbols-outlined text-lg"
                        >delete</span
                      ></template
                    >
                  </Button>
                </div>
              </div>
              <p
                v-if="!(selectedProject.projectSupplements || []).length"
                class="rounded-2xl border border-dashed border-surface-dark/10 p-5 text-center text-sm text-surface-dark/45"
              >
                Aucun supplément pour ce projet.
              </p>
            </div>
          </div>
        </div>

        <aside
          class="flex flex-col gap-4 2xl:sticky 2xl:top-6 2xl:max-h-[85vh] 2xl:self-start 2xl:overflow-y-auto"
        >
          <div
            class="rounded-3xl border border-surface-dark/5 bg-surface-card p-5"
          >
            <h3 class="text-lg font-bold text-surface-dark">Raccourcis</h3>
            <div class="mt-4 grid gap-2">
              <Button
                label="Client"
                :disabled="!selectedProject.clientId"
                class="!justify-start !rounded-xl !border !border-indigo-500/15 !bg-indigo-500/10 !text-indigo-600 hover:!border-indigo-500/30 hover:!bg-indigo-500/15 disabled:!bg-indigo-500/5 disabled:!opacity-50"
                @click="openClient"
              >
                <template #icon
                  ><span class="material-symbols-outlined text-lg"
                    >groups</span
                  ></template
                >
              </Button>
              <Button
                label="Devis"
                :disabled="!selectedQuote"
                class="!justify-start !rounded-xl !border !border-primary/15 !bg-primary/10 !text-primary hover:!border-primary/30 hover:!bg-primary/15 disabled:!bg-primary/5 disabled:!opacity-50"
                @click="openQuote"
              >
                <template #icon
                  ><span class="material-symbols-outlined text-lg"
                    >receipt_long</span
                  ></template
                >
              </Button>
              <Button
                label="Timesheet"
                :disabled="!selectedTimesheet"
                class="!justify-start !rounded-xl !border !border-emerald-500/15 !bg-emerald-500/10 !text-emerald-600 hover:!border-emerald-500/30 hover:!bg-emerald-500/15 disabled:!bg-emerald-500/5 disabled:!opacity-50"
                @click="openTimesheet"
              >
                <template #icon
                  ><span class="material-symbols-outlined text-lg"
                    >timer</span
                  ></template
                >
              </Button>
            </div>
          </div>

          <div
            class="rounded-3xl border border-surface-dark/5 bg-surface-card p-5"
          >
            <h3 class="text-lg font-bold text-surface-dark">Étape suivante</h3>
            <p
              class="mt-3 rounded-2xl border p-4 text-sm font-semibold"
              :class="
                selectedNextMilestone
                  ? 'border-amber-500/25 bg-amber-500/8 text-amber-800'
                  : 'border-emerald-500/25 bg-emerald-500/8 text-emerald-700'
              "
            >
              {{
                selectedNextMilestone?.label ||
                "Toutes les étapes sont validées."
              }}
            </p>
            <p
              v-if="selectedProject.blockedReason"
              class="mt-3 rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700"
            >
              {{ selectedProject.blockedReason }}
            </p>
          </div>

          <div
            class="rounded-3xl border border-surface-dark/5 bg-surface-card p-5"
          >
            <div class="mb-4 flex items-center justify-between gap-3">
              <h3
                class="flex items-center gap-2 font-heading text-lg font-bold text-surface-dark"
              >
                <span class="material-symbols-outlined text-primary"
                  >sticky_note_2</span
                >
                Notes
              </h3>
              <span
                class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
                >{{ projectNotes.length }}</span
              >
            </div>
            <div class="mb-4 flex gap-2">
              <InputText
                v-model="newProjectNote"
                placeholder="Ajouter une note projet..."
                class="flex-1 !text-sm !rounded-xl"
                @keydown.enter="addProjectNote"
              />
              <Button
                aria-label="Ajouter"
                :disabled="!newProjectNote.trim()"
                class="!h-10 !w-10 !rounded-xl"
                @click="addProjectNote"
              >
                <template #icon
                  ><span class="material-symbols-outlined text-lg"
                    >add</span
                  ></template
                >
              </Button>
            </div>
            <div class="space-y-3">
              <div
                v-for="note in projectNotes"
                :key="note.id"
                class="group flex items-start gap-2 rounded-xl border border-surface-dark/8 bg-white p-3 text-sm text-surface-dark/70 transition-all hover:border-primary/20 hover:bg-primary/5"
              >
                <Textarea
                  :model-value="projectNoteDrafts[note.id] ?? note.content"
                  auto-resize
                  rows="2"
                  class="flex-1 !border-0 !bg-transparent !p-0 !text-sm !leading-relaxed !shadow-none focus:!ring-0"
                  @update:model-value="updateProjectNoteDraft(note.id, $event)"
                />
                <div
                  class="flex flex-col gap-1 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <button
                    type="button"
                    aria-label="Enregistrer"
                    title="Enregistrer"
                    :disabled="!hasProjectNoteChanges(note)"
                    class="flex h-7 w-7 items-center justify-center rounded-full text-surface-dark/35 transition-colors hover:bg-primary/10 hover:text-primary disabled:cursor-not-allowed disabled:opacity-25"
                    @click="saveProjectNote(note)"
                  >
                    <span class="material-symbols-outlined text-xs">save</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Supprimer"
                    title="Supprimer"
                    class="flex h-7 w-7 items-center justify-center rounded-full text-surface-dark/35 transition-colors hover:bg-red-50 hover:text-red-500"
                    @click="confirmDeleteProjectNote(note.id)"
                  >
                    <span class="material-symbols-outlined text-xs"
                      >delete</span
                    >
                  </button>
                </div>
              </div>
              <div
                v-if="projectNotes.length === 0"
                class="py-8 text-center text-xs italic text-surface-dark/40"
              >
                Aucune note pour l'instant.
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section
        v-else
        class="rounded-3xl border border-dashed border-surface-dark/10 bg-white p-10 text-center text-sm text-surface-dark/50"
      >
        Aucun projet sélectionné.
      </section>
    </div>

    <Dialog
      v-model:visible="addMilestoneDialogOpen"
      modal
      :header="editingMilestoneId ? 'Modifier l’étape' : 'Ajouter une étape'"
      :style="{ width: 'min(560px, 92vw)' }"
    >
      <div class="grid gap-4">
        <label class="grid gap-1.5">
          <span
            class="text-xs font-bold uppercase tracking-wide text-surface-dark/45"
            >Type</span
          >
          <Select
            v-model="milestoneForm.kind"
            :options="milestoneKindOptions"
            option-label="label"
            option-value="value"
          />
        </label>
        <label class="grid gap-1.5">
          <span
            class="text-xs font-bold uppercase tracking-wide text-surface-dark/45"
            >Libellé</span
          >
          <InputText
            v-model="milestoneForm.label"
            :placeholder="defaultMilestoneLabel(milestoneForm.kind)"
          />
        </label>
        <p
          v-if="milestoneForm.kind === 'invoice_sent' && !editingMilestoneId"
          class="rounded-2xl border border-amber-500/20 bg-amber-500/8 p-3 text-sm font-semibold text-amber-800"
        >
          Une étape “Paiement reçu” sera ajoutée automatiquement juste après.
        </p>
      </div>
      <template #footer>
        <Button
          text
          severity="secondary"
          label="Annuler"
          @click="closeMilestoneDialog"
        />
        <Button
          :label="editingMilestoneId ? 'Enregistrer' : 'Ajouter'"
          @click="addMilestone"
        >
          <template #icon
            ><span class="material-symbols-outlined text-lg">{{
              editingMilestoneId ? "save" : "add"
            }}</span></template
          >
        </Button>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="dialogOpen"
      modal
      :header="
        editingProjectId ? 'Modifier le projet' : 'Nouveau projet hors devis'
      "
      :style="{ width: 'min(720px, 92vw)' }"
    >
      <div class="grid gap-4">
        <div class="grid gap-3 md:grid-cols-2">
          <label class="grid gap-1.5">
            <span
              class="text-xs font-bold uppercase tracking-wide text-surface-dark/45"
              >Nom</span
            >
            <InputText v-model="form.title" />
          </label>
          <label class="grid gap-1.5">
            <span
              class="text-xs font-bold uppercase tracking-wide text-surface-dark/45"
              >Client</span
            >
            <Select
              v-model="form.clientId"
              :options="clientOptions"
              option-label="label"
              option-value="value"
              show-clear
            />
          </label>
        </div>
        <label class="grid gap-1.5">
          <span
            class="text-xs font-bold uppercase tracking-wide text-surface-dark/45"
            >Description</span
          >
          <Textarea v-model="form.description" rows="3" auto-resize />
        </label>
        <div class="grid gap-3 md:grid-cols-3">
          <label class="grid gap-1.5">
            <span
              class="text-xs font-bold uppercase tracking-wide text-surface-dark/45"
              >Budget HT</span
            >
            <InputNumber
              v-model="form.budgetExVat"
              mode="currency"
              currency="EUR"
              locale="fr-BE"
            />
          </label>
          <label class="grid gap-1.5">
            <span
              class="text-xs font-bold uppercase tracking-wide text-surface-dark/45"
              >Facturé HT</span
            >
            <InputNumber
              v-model="form.invoicedExVat"
              mode="currency"
              currency="EUR"
              locale="fr-BE"
            />
          </label>
          <label class="grid gap-1.5">
            <span
              class="text-xs font-bold uppercase tracking-wide text-surface-dark/45"
              >Payé HT</span
            >
            <InputNumber
              v-model="form.paidExVat"
              mode="currency"
              currency="EUR"
              locale="fr-BE"
            />
          </label>
        </div>
        <div class="grid gap-3 md:grid-cols-3">
          <label class="grid gap-1.5">
            <span
              class="text-xs font-bold uppercase tracking-wide text-surface-dark/45"
              >Taux horaire</span
            >
            <InputNumber
              v-model="form.hourlyRate"
              mode="currency"
              currency="EUR"
              locale="fr-BE"
            />
          </label>
          <label class="grid gap-1.5">
            <span
              class="text-xs font-bold uppercase tracking-wide text-surface-dark/45"
              >Échéance</span
            >
            <input
              v-model="form.dueDate"
              type="date"
              class="h-10 rounded-xl border border-surface-dark/15 bg-white px-3 text-sm outline-none focus:border-primary/45 focus:ring-4 focus:ring-primary/10"
            />
          </label>
          <label class="grid gap-1.5">
            <span
              class="text-xs font-bold uppercase tracking-wide text-surface-dark/45"
              >Couleur</span
            >
            <Select v-model="form.color" :options="colorPool" class="w-full">
              <template #value="{ value }"
                ><span class="flex items-center gap-2"
                  ><span
                    class="h-3 w-3 rounded-full"
                    :style="{ backgroundColor: value }"
                  ></span
                  >{{ value }}</span
                ></template
              >
              <template #option="{ option }"
                ><span class="flex items-center gap-2"
                  ><span
                    class="h-3 w-3 rounded-full"
                    :style="{ backgroundColor: option }"
                  ></span
                  >{{ option }}</span
                ></template
              >
            </Select>
          </label>
        </div>
      </div>
      <template #footer>
        <Button
          text
          severity="secondary"
          aria-label="Annuler"
          title="Annuler"
          @click="dialogOpen = false"
        >
          <template #icon
            ><span class="material-symbols-outlined text-lg"
              >close</span
            ></template
          >
        </Button>
        <Button
          aria-label="Enregistrer"
          title="Enregistrer"
          :disabled="!form.title.trim()"
          @click="saveProject"
        >
          <template #icon
            ><span class="material-symbols-outlined text-lg"
              >save</span
            ></template
          >
        </Button>
      </template>
    </Dialog>
  </div>
</template>
