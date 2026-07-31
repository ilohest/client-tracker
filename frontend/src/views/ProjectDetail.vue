<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import type {
  Project,
  ProjectStatus,
  Quote,
  Timesheet,
} from "@client-tracker/contracts";
import Button from "primevue/button";
import ConfirmDialog from "primevue/confirmdialog";
import Dialog from "primevue/dialog";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Menu from "primevue/menu";
import MultiSelect from "primevue/multiselect";
import Select from "primevue/select";
import Tag from "primevue/tag";
import Textarea from "primevue/textarea";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { useRoute, useRouter } from "vue-router";
import ProjectFormDialog from "@/components/projects/ProjectFormDialog.vue";
import type { ProjectFormValue } from "@/components/projects/projectForm";
import { quoteStatusMeta } from "@/lib/clientPresets";
import { useAuthStore } from "@/stores/authStore";
import { useClientsStore } from "@/stores/clientsStore";
import { useProjectsStore } from "@/stores/projectsStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { useTimesheetsStore } from "@/stores/timesheetsStore";
import { toDateObj } from "@/utils/date";
import {
  calculatePaymentScheduleStepAmounts,
  formatCurrency,
} from "@/utils/quote";
import type { ProjectMacroStatus } from "@/utils/projectFilters";
import {
  buildProjectList,
  isProjectOverdue,
  projectDoneMilestones,
  projectMacroStatus,
  projectMacroStatusMeta,
  projectMacroStatusOptions,
  projectProgress,
  projectStatusForMacro,
  readProjectListQuery,
} from "@/utils/projectFilters";
import {
  hasLegacyFinalPaymentDone as sharedHasLegacyFinalPaymentDone,
  isPaymentReceivedMilestoneDone as sharedIsPaymentReceivedDone,
  projectActiveQuotes as sharedProjectActiveQuotes,
  projectBudgetBase as sharedBudgetBase,
  projectQuotes as sharedProjectQuotes,
  projectScheduledReceivedExVat as sharedScheduledReceivedExVat,
  projectScheduledInvoicedExVat as sharedScheduledInvoicedExVat,
  projectSupplementTotal as sharedSupplementTotal,
  projectToReceiveExVat as sharedToReceiveExVat,
  projectToInvoiceExVat as sharedToInvoiceExVat,
  projectTotalBudget as sharedTotalBudget,
} from "@/utils/projectFinance";

const authStore = useAuthStore();
const clientsStore = useClientsStore();
const projectsStore = useProjectsStore();
const quotesStore = useQuotesStore();
const timesheetsStore = useTimesheetsStore();
const confirm = useConfirm();
const toast = useToast();
const router = useRouter();
const route = useRoute();

const dialogOpen = ref(false);
const newProjectNote = ref("");
const projectNoteDrafts = reactive<Record<string, string>>({});
const addMilestoneDialogOpen = ref(false);
const finishProjectDialogOpen = ref(false);
const finishProjectBillingChoice = ref<
  "invoice_now" | "already_invoiced" | "no_invoice"
>("invoice_now");
const editingMilestoneId = ref<string | null>(null);
const draggedMilestoneId = ref<string | null>(null);
const milestoneDropTargetId = ref<string | null>(null);
const milestoneForm = reactive({
  label: "",
  kind: "custom" as NonNullable<Project["milestones"][number]["kind"]>,
});
const milestoneLane = ref<"workflow" | "finance">("workflow");
const supplementForm = reactive({
  title: "",
  amountExVat: 0,
  description: "",
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

const statusOptions: Array<{ label: string; value: ProjectStatus }> = [
  { label: "Actif", value: "in_progress" },
  { label: "En attente", value: "blocked" },
  { label: "À facturer", value: "ready_to_invoice" },
  { label: "Clos", value: "closed" },
];
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
// Tous les devis liés à un projet (devis initial + avenants), du plus ancien au plus récent.
const projectQuotes = (project: Project): Quote[] =>
  sharedProjectQuotes(project, quotesStore.quotes);

const projectActiveQuotes = (project: Project): Quote[] =>
  sharedProjectActiveQuotes(project, quotesStore.quotes);

const selectedProjectQuotes = computed(() =>
  selectedProject.value ? projectQuotes(selectedProject.value) : [],
);
const selectedProjectActiveQuotes = computed(() =>
  selectedProject.value ? projectActiveQuotes(selectedProject.value) : [],
);
const selectedPrimaryQuote = computed(
  () =>
    selectedProjectActiveQuotes.value[0] ||
    selectedProjectQuotes.value[0] ||
    null,
);

const projectSupplementTotal = (project: Project) =>
  sharedSupplementTotal(project);

const projectBudgetBase = (project: Project) =>
  sharedBudgetBase(project, projectActiveQuotes(project));

const projectTotalBudget = (project: Project) =>
  sharedTotalBudget(project, projectActiveQuotes(project));

const currentYear = new Date().getFullYear();
const currentYearStart = `${currentYear}-01-01`;

const isMilestoneDone = (project: Project, label: string) =>
  project.milestones?.some(
    (milestone) => milestone.label === label && milestone.status === "done",
  ) || false;

const isPaymentReceivedMilestoneDone = (
  project: Project,
  quoteId: string,
  index: number,
  stepId = "",
) => sharedIsPaymentReceivedDone(project, quoteId, index, stepId);

const hasLegacyFinalPaymentDone = (project: Project) =>
  sharedHasLegacyFinalPaymentDone(project);

const projectScheduledReceivedExVat = (project: Project, sinceDate = "") =>
  sharedScheduledReceivedExVat(
    project,
    projectActiveQuotes(project),
    sinceDate,
  );

const projectScheduledInvoicedExVat = (project: Project, sinceDate = "") =>
  sharedScheduledInvoicedExVat(
    project,
    projectActiveQuotes(project),
    sinceDate,
  );

const projectToInvoiceExVat = (project: Project) =>
  sharedToInvoiceExVat(project, projectActiveQuotes(project));

const projectToReceiveExVat = (project: Project) =>
  sharedToReceiveExVat(project, projectActiveQuotes(project));

const milestoneFinancialAmount = (
  project: Project,
  milestone: Project["milestones"][number],
) => {
  if (!["invoice_sent", "payment_received"].includes(milestone.kind || ""))
    return null;
  if (milestone.addOnId) {
    const addOn = project.projectSupplements?.find(
      (item) => item.id === milestone.addOnId,
    );
    return addOn
      ? {
          amount: Number(addOn.amountExVat || 0),
          label: formatCurrency(addOn.amountExVat),
        }
      : null;
  }
  const activeQuotes = projectActiveQuotes(project);
  const quote = milestone.quoteId
    ? activeQuotes.find((item) => item.id === milestone.quoteId)
    : null;
  if (!quote) return null;
  const paymentSchedule = quote.paymentSchedule?.length
    ? quote.paymentSchedule
    : [
        {
          id: "",
          label: "Paiement final",
          mode: "percent" as const,
          value: 100,
        },
      ];

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

  const isLastQuote = activeQuotes[activeQuotes.length - 1]?.id === quote.id;
  const amount =
    calculatePaymentScheduleStepAmounts(
      step,
      Number(quote.subtotal || 0),
      Number(quote.totalWithVat || 0),
    ).amountExcl +
    (isLastQuote && scheduleIndex === paymentSchedule.length - 1
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
  // L'acompte concerne le devis initial du projet.
  const quote = projectActiveQuotes(project)[0];
  const firstPaymentStep = quote?.paymentSchedule?.[0];
  if (!quote || !firstPaymentStep) return 0;

  return calculatePaymentScheduleStepAmounts(
    firstPaymentStep,
    Number(quote.subtotal || 0),
    Number(quote.totalWithVat || 0),
  ).percent;
};

const projectPaymentProgressLabel = (project: Project) => {
  const activeQuotes = projectActiveQuotes(project);
  const allSteps = activeQuotes.flatMap((quote) =>
    (quote.paymentSchedule?.length
      ? quote.paymentSchedule
      : [
          {
            id: "",
            label: "Paiement final",
            mode: "percent" as const,
            value: 100,
          },
        ]
    ).map((step, index) => ({ quote, step, index })),
  );
  if (!allSteps.length) return "";

  const receivedCount = allSteps.filter(({ quote, step, index }) =>
    isPaymentReceivedMilestoneDone(project, quote.id, index, step.id),
  ).length;
  const depositPercent = projectDepositPercent(project);
  if (allSteps.length <= 1) return "Paiement final 100 %";
  if (depositPercent > 0) {
    return `${receivedCount}/${allSteps.length} paiements reçus · acompte ${depositPercent.toFixed(0)} %`;
  }
  return `${receivedCount}/${allSteps.length} paiements reçus`;
};

const acceptedQuotesWithoutProject = computed(() =>
  quotesStore.quotes.filter(
    (quote) => quote.status === "accepted" && !quote.projectId,
  ),
);

const attachableQuotesForSelectedProject = computed(() => {
  if (!selectedProject.value) return [];
  const clientId = selectedProject.value.clientId;
  return acceptedQuotesWithoutProject.value.filter(
    (quote) => !clientId || quote.clientId === clientId,
  );
});

const selectedProjectStatusValue = computed<ProjectStatus>(() =>
  selectedProject.value
    ? projectStatusForMacro(projectMacroStatus(selectedProject.value))
    : "in_progress",
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

type SummaryMetricTone = "neutral" | "success" | "warning" | "info" | "primary";
type SummaryMetric = {
  key: string;
  label: string;
  value: string;
  icon: string;
  tone: SummaryMetricTone;
  detail?: string;
  wide?: boolean;
};

const summaryCardClass: Record<SummaryMetricTone, string> = {
  neutral: "border-surface-dark/7 bg-white",
  success: "border-emerald-500/18 bg-emerald-500/6",
  warning: "border-amber-500/20 bg-amber-500/7",
  info: "border-blue-500/18 bg-blue-500/6",
  primary: "border-primary/15 bg-primary/6",
};

const summaryIconClass: Record<SummaryMetricTone, string> = {
  neutral: "bg-surface-dark/6 text-surface-dark/50",
  success: "bg-emerald-500/12 text-emerald-700",
  warning: "bg-amber-500/14 text-amber-700",
  info: "bg-blue-500/12 text-blue-700",
  primary: "bg-primary/12 text-primary",
};

const summaryValueClass: Record<SummaryMetricTone, string> = {
  neutral: "text-surface-dark",
  success: "text-emerald-700",
  warning: "text-amber-700",
  info: "text-blue-700",
  primary: "text-primary",
};

const financialSummaryMetrics = computed<SummaryMetric[]>(() => {
  const project = selectedProject.value;
  if (!project) return [];
  const supplementTotal = projectSupplementTotal(project);
  return [
    {
      key: "budget",
      label: "Budget total HT",
      value: formatCurrency(projectTotalBudget(project)),
      detail: supplementTotal
        ? `Base ${formatCurrency(projectBudgetBase(project))} · suppl. ${formatCurrency(supplementTotal)}`
        : "Périmètre actuellement lié au projet",
      icon: "account_balance_wallet",
      tone: "neutral",
      wide: true,
    },
    {
      key: "invoiced",
      label: "Facturé",
      value: formatCurrency(projectScheduledInvoicedExVat(project)),
      icon: "receipt_long",
      tone: "neutral",
    },
    {
      key: "received",
      label: "Encaissé",
      value: formatCurrency(projectScheduledReceivedExVat(project)),
      detail: projectPaymentProgressLabel(project),
      icon: "check_circle",
      tone: "success",
    },
    {
      key: "to-invoice",
      label: "À facturer",
      value: formatCurrency(projectToInvoiceExVat(project)),
      icon: "request_quote",
      tone: "warning",
    },
    {
      key: "to-receive",
      label: "À encaisser",
      value: formatCurrency(projectToReceiveExVat(project)),
      icon: "payments",
      tone: "info",
    },
  ];
});

const planningSummaryMetrics = computed<SummaryMetric[]>(() => {
  const project = selectedProject.value;
  if (!project) return [];
  return [
    {
      key: "time",
      label: "Temps investi",
      value: formatDuration(projectSeconds(project)),
      detail: "Temps enregistré dans la timesheet",
      icon: "timer",
      tone: "primary",
      wide: true,
    },
    {
      key: "start",
      label: "Début",
      value: formatDate(projectStartDate(project)),
      icon: "play_circle",
      tone: "neutral",
    },
    {
      key: "due",
      label: "Échéance",
      value: formatDate(project.dueDate),
      icon: "event",
      tone: "neutral",
    },
    {
      key: "close",
      label: "Clôture",
      value: projectEndDate(project)
        ? formatDate(projectEndDate(project))
        : "En cours",
      icon: "flag",
      tone: "neutral",
    },
    {
      key: "duration",
      label: "Durée",
      value: projectDurationLabel(project),
      icon: "date_range",
      tone: "primary",
    },
  ];
});

const projectNextMilestoneIndex = (project: Project) => {
  const milestones = project.milestones || [];
  return milestones.findIndex((milestone) => milestone.status !== "done");
};

const selectedNextMilestone = computed(() => {
  if (!selectedProject.value) return null;
  const nextIndex = projectNextMilestoneIndex(selectedProject.value);
  return nextIndex >= 0 ? selectedProject.value.milestones[nextIndex] : null;
});

const selectedWorkflowMilestones = computed(() =>
  (selectedProject.value?.milestones || []).filter(
    (milestone) =>
      !["invoice_sent", "payment_received"].includes(milestone.kind || ""),
  ),
);

const selectedFinancialMilestones = computed(() =>
  (selectedProject.value?.milestones || []).filter((milestone) =>
    ["invoice_sent", "payment_received"].includes(milestone.kind || ""),
  ),
);

const selectedMilestoneGroups = computed(() => [
  {
    key: "workflow",
    label: "Production",
    description: "",
    icon: "design_services",
    milestones: selectedWorkflowMilestones.value,
  },
  {
    key: "finance",
    label: "Finance",
    description: "",
    icon: "payments",
    milestones: selectedFinancialMilestones.value,
  },
]);

const milestoneIndex = (
  project: Project,
  milestone: Project["milestones"][number],
) => project.milestones.findIndex((item) => item.id === milestone.id);

const milestoneVisualState = (
  project: Project,
  milestone: Project["milestones"][number],
  _index: number,
) => {
  if (milestone.status === "done") return "done";
  if (milestone.status === "blocked") return "blocked";
  const financial = ["invoice_sent", "payment_received"].includes(
    milestone.kind || "",
  );
  const nextInLane = project.milestones.find(
    (item) =>
      item.status !== "done" &&
      ["invoice_sent", "payment_received"].includes(item.kind || "") ===
        financial,
  );
  return nextInLane?.id === milestone.id ? "next" : "future";
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

const openEditDialog = () => {
  if (!selectedProject.value) return;
  dialogOpen.value = true;
};

const saveProject = async (form: ProjectFormValue) => {
  const project = selectedProject.value;
  if (!project) return;
  const client = clientsStore.clients.find((item) => item.id === form.clientId);
  await projectsStore.updateProject(project.id, {
    title: form.title.trim() || "Projet sans titre",
    clientId: form.clientId,
    clientName: client?.name || project.clientName || "",
    description: form.description.trim(),
    budgetExVat: Number(form.budgetExVat || 0),
    hourlyRate: Number(form.hourlyRate || 0),
    startedAt: form.startedAt ? dateToIso(form.startedAt) : "",
    dueDate: form.dueDate ? dateToIso(form.dueDate) : "",
    color: form.color,
  });
  toast.add({ severity: "success", summary: "Projet enregistré", life: 2200 });
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
  if (milestone.kind === "payment_received" && milestone.status !== "done") {
    const today = todayIsoDate();
    const milestones = project.milestones.map((item) => {
      const sameAddOn = milestone.addOnId && item.addOnId === milestone.addOnId;
      const sameQuoteStep =
        milestone.quoteId &&
        item.quoteId === milestone.quoteId &&
        (milestone.paymentScheduleStepId
          ? item.paymentScheduleStepId === milestone.paymentScheduleStepId
          : item.paymentScheduleIndex === milestone.paymentScheduleIndex);
      if (
        item.id === milestone.id ||
        (item.kind === "invoice_sent" && (sameAddOn || sameQuoteStep))
      ) {
        return { ...item, status: "done" as const, date: item.date || today };
      }
      return item;
    });
    await projectsStore.updateProject(project.id, { milestones });
    return;
  }
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
  if (kind === "delivery") return "Livraison";
  return "Nouvelle étape";
};

const openAddMilestoneDialog = (lane: "workflow" | "finance") => {
  if (!selectedProject.value) return;
  editingMilestoneId.value = null;
  milestoneLane.value = lane;
  milestoneForm.kind = lane === "finance" ? "invoice_sent" : "custom";
  milestoneForm.label = "";
  addMilestoneDialogOpen.value = true;
};

const openEditMilestoneDialog = (milestone: Project["milestones"][number]) => {
  editingMilestoneId.value = milestone.id;
  milestoneForm.kind = milestone.kind || "custom";
  milestoneLane.value = ["invoice_sent", "payment_received"].includes(
    milestoneForm.kind,
  )
    ? "finance"
    : "workflow";
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
  const addOnId = crypto.randomUUID();
  const supplement = {
    id: addOnId,
    title: supplementForm.title.trim(),
    amountExVat: Number(supplementForm.amountExVat || 0),
    createdAt: todayIsoDate(),
    description: supplementForm.description.trim(),
  };
  await projectsStore.updateProject(project.id, {
    projectSupplements: [...(project.projectSupplements || []), supplement],
    milestones: [
      ...project.milestones,
      {
        id: crypto.randomUUID(),
        label: `Facture add-on — ${supplement.title}`,
        status: "todo",
        date: "",
        kind: "invoice_sent",
        addOnId,
      },
      {
        id: crypto.randomUUID(),
        label: `Paiement add-on — ${supplement.title}`,
        status: "todo",
        date: "",
        kind: "payment_received",
        addOnId,
      },
    ],
  });
  supplementForm.title = "";
  supplementForm.amountExVat = 0;
  supplementForm.description = "";
  toast.add({
    severity: "success",
    summary: "Add-on ajouté",
    detail: "Ses étapes de facturation et de paiement sont prêtes.",
    life: 2600,
  });
};

const addOnMilestone = (
  project: Project,
  addOnId: string,
  kind: "invoice_sent" | "payment_received",
) =>
  project.milestones.find(
    (milestone) => milestone.addOnId === addOnId && milestone.kind === kind,
  );

const addOnStatus = (project: Project, addOnId: string) => {
  const payment = addOnMilestone(project, addOnId, "payment_received");
  if (payment?.status === "done")
    return { label: "Encaissé", class: "bg-emerald-500/12 text-emerald-700" };
  const invoice = addOnMilestone(project, addOnId, "invoice_sent");
  if (invoice?.status === "done")
    return { label: "Facturé", class: "bg-blue-500/12 text-blue-700" };
  return { label: "À facturer", class: "bg-amber-500/14 text-amber-700" };
};

const setAddOnFinancialState = async (
  project: Project,
  addOnId: string,
  state: "invoiced" | "paid",
) => {
  const today = todayIsoDate();
  const milestones = project.milestones.map((milestone) => {
    if (milestone.addOnId !== addOnId) return milestone;
    const shouldComplete =
      milestone.kind === "invoice_sent" ||
      (state === "paid" && milestone.kind === "payment_received");
    return shouldComplete
      ? { ...milestone, status: "done" as const, date: milestone.date || today }
      : milestone;
  });
  await projectsStore.updateProject(project.id, { milestones });
};

const deleteProjectSupplement = (supplementId: string) => {
  const project = selectedProject.value;
  if (!project) return;
  const addOn = project.projectSupplements?.find(
    (item) => item.id === supplementId,
  );
  const state = addOnStatus(project, supplementId).label.toLowerCase();
  confirm.require({
    message: `Supprimer l’add-on « ${addOn?.title || "Add-on"} » ? Ses étapes financières (${state}) seront également retirées.`,
    header: "Supprimer l’add-on",
    icon: "pi pi-exclamation-triangle",
    rejectProps: { label: "Annuler", severity: "secondary", outlined: true },
    acceptProps: { label: "Supprimer", severity: "danger" },
    accept: async () => {
      await projectsStore.updateProject(project.id, {
        projectSupplements: (project.projectSupplements || []).filter(
          (supplement) => supplement.id !== supplementId,
        ),
        milestones: project.milestones.filter(
          (milestone) => milestone.addOnId !== supplementId,
        ),
      });
      toast.add({
        severity: "secondary",
        summary: "Add-on supprimé",
        life: 1800,
      });
    },
  });
};

const openFinishProjectDialog = () => {
  finishProjectBillingChoice.value = "invoice_now";
  finishProjectDialogOpen.value = true;
};

const finishProject = async () => {
  const project = selectedProject.value;
  if (!project) return;
  const today = todayIsoDate();
  const choice = finishProjectBillingChoice.value;
  const milestones = project.milestones.map((milestone) => {
    const isWorkflowStep = ["work", "approval", "delivery"].includes(
      milestone.kind || "",
    );
    const isInvoiceStep = milestone.kind === "invoice_sent";
    if (isWorkflowStep || (choice === "already_invoiced" && isInvoiceStep)) {
      return {
        ...milestone,
        status: "done" as const,
        date: milestone.date || today,
      };
    }
    return milestone;
  });
  await projectsStore.updateProject(project.id, {
    milestones,
    status:
      choice === "no_invoice"
        ? "closed"
        : choice === "already_invoiced"
          ? "invoiced"
          : "ready_to_invoice",
    closedAt: choice === "no_invoice" ? project.closedAt || today : "",
    billingWaivedExVat:
      choice === "no_invoice"
        ? Number(project.billingWaivedExVat || 0) +
          projectToInvoiceExVat(project)
        : Number(project.billingWaivedExVat || 0),
    nextAction:
      choice === "invoice_now"
        ? "Envoyer la facture finale"
        : choice === "already_invoiced"
          ? "Suivre le paiement"
          : "",
  });
  finishProjectDialogOpen.value = false;
  toast.add({
    severity: "success",
    summary: "Travail terminé",
    detail:
      choice === "invoice_now"
        ? "Le projet est maintenant à facturer."
        : choice === "already_invoiced"
          ? "La facture est enregistrée comme envoyée."
          : "Le projet est clôturé sans facturation restante.",
    life: 3000,
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
      await router.replace({ name: "projects" });
      toast.add({
        severity: "secondary",
        summary: "Projet supprimé",
        life: 2200,
      });
    },
  });
};

const openQuote = (quote?: Quote | null) => {
  const target = quote || selectedPrimaryQuote.value;
  if (!target) return;
  quotesStore.selectQuote(target.id);
  router.push({ name: "quote-detail", params: { id: target.id } });
};

const createLinkedQuote = () => {
  const project = selectedProject.value;
  if (!project) return;
  void router.push({
    name: "quote-new",
    query: { project: project.id, retourProjet: project.id },
  });
};

const attachQuoteIds = ref<string[]>([]);

const attachQuoteToSelectedProject = async () => {
  const project = selectedProject.value;
  const quotes = attachableQuotesForSelectedProject.value.filter((item) =>
    attachQuoteIds.value.includes(item.id),
  );
  if (!project || !quotes.length) return;
  await projectsStore.attachQuotesToProject(project, quotes);
  attachQuoteIds.value = [];
  toast.add({
    severity: "success",
    summary: quotes.length > 1 ? "Devis liés" : "Devis lié",
    detail: `${quotes.length} devis ajouté${quotes.length > 1 ? "s" : ""} au projet avec ses jalons financiers.`,
    life: 2600,
  });
};

const detachQuoteFromSelectedProject = (quote: Quote) => {
  const project = selectedProject.value;
  if (!project) return;
  confirm.require({
    message: `Détacher le devis "${quote.quoteRef}" de ce projet ? Ses jalons de paiement associés seront retirés de la roadmap.`,
    header: "Détacher le devis",
    icon: "pi pi-exclamation-triangle",
    rejectProps: { label: "Annuler", severity: "secondary", outlined: true },
    acceptProps: { label: "Détacher", severity: "danger" },
    accept: async () => {
      await projectsStore.detachQuoteFromProject(project, quote);
      toast.add({
        severity: "secondary",
        summary: "Devis détaché",
        life: 2200,
      });
    },
  });
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

// --- NAVIGATION INDEX <-> DÉTAIL ---
// L'index transmet son état de liste dans l'URL : le pas-à-pas suit donc le même
// ordre filtré que le tableau qu'on vient de quitter.
const listQuery = computed(() => ({ ...route.query }));

const siblingProjects = computed(() =>
  buildProjectList(
    projectsStore.projects,
    readProjectListQuery(listQuery.value),
    {
      quotesByProject: projectQuotes,
      budgetOf: projectTotalBudget,
    },
  ),
);
const siblingIndex = computed(() =>
  siblingProjects.value.findIndex(
    (project) => project.id === projectsStore.selectedProjectId,
  ),
);
const previousProject = computed(() =>
  siblingIndex.value > 0 ? siblingProjects.value[siblingIndex.value - 1] : null,
);
const nextProject = computed(() =>
  siblingIndex.value >= 0 &&
  siblingIndex.value < siblingProjects.value.length - 1
    ? siblingProjects.value[siblingIndex.value + 1]
    : null,
);

const routeProjectId = computed(() =>
  typeof route.params.id === "string" ? route.params.id : "",
);

const backToList = () => {
  void router.push({ name: "projects", query: listQuery.value });
};

const goToSibling = (project: Project | null) => {
  if (!project) return;
  void router.push({
    name: "project-detail",
    params: { id: project.id },
    query: route.query,
  });
};

/** La route est la source de vérité pour la sélection. */
const loadFromRoute = () => {
  const project =
    projectsStore.projects.find((entry) => entry.id === routeProjectId.value) ||
    null;
  // Lien périmé ou projet supprimé : on renvoie à la liste plutôt que d'afficher
  // un écran vide.
  if (!project) {
    void router.replace({ name: "projects", query: listQuery.value });
    toast.add({
      severity: "warn",
      summary: "Projet introuvable",
      detail: "Ce projet n’existe plus ou n’est pas accessible.",
      life: 3000,
    });
    return;
  }
  projectsStore.selectProject(project.id);
};

watch(routeProjectId, () => {
  if (!projectsStore.projects.length) return;
  if (projectsStore.selectedProjectId === routeProjectId.value) return;
  loadFromRoute();
});

const projectMenu = ref<InstanceType<typeof Menu> | null>(null);

// Les raccourcis client / devis / timesheet vivent dans le rail (un clic, toujours
// visibles) : le menu ne porte que ce qui n'a pas sa place ailleurs.
const projectMenuItems = computed(() => [
  {
    label: "Supprimer le projet",
    icon: "pi pi-trash",
    command: deleteSelected,
  },
]);

const toggleProjectMenu = (event: Event) => {
  projectMenu.value?.toggle(event);
};

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
  loadFromRoute();
});
</script>

<template>
  <div class="flex flex-col gap-6">
    <ConfirmDialog />

    <div
      v-if="selectedProject"
      class="sticky top-4 z-20 flex flex-wrap items-center gap-3 rounded-3xl border border-surface-dark/8 bg-surface-card/95 p-2.5 shadow-sm backdrop-blur"
    >
      <div class="flex min-w-0 flex-1 basis-[340px] items-center gap-3">
        <Button
          text
          severity="secondary"
          class="!h-9 !w-9 !shrink-0 !rounded-xl !p-0"
          aria-label="Retour à la liste des projets"
          title="Retour à la liste des projets"
          @click="backToList"
        >
          <template #icon
            ><span class="material-symbols-outlined text-lg"
              >arrow_back</span
            ></template
          >
        </Button>

        <div class="min-w-0">
          <div class="flex items-center gap-2">
            <h1
              class="truncate font-heading text-lg font-bold text-surface-dark"
            >
              {{ selectedProject.title }}
            </h1>
            <Tag
              :value="
                projectMacroStatusMeta[projectMacroStatus(selectedProject)]
                  .label
              "
              :class="
                projectMacroStatusMeta[projectMacroStatus(selectedProject)]
                  .tagClass
              "
              rounded
            />
            <span
              v-if="isProjectOverdue(selectedProject)"
              class="shrink-0 whitespace-nowrap rounded-full bg-rose-500/12 px-2.5 py-0.5 text-xs font-semibold text-rose-700"
            >
              En retard
            </span>
          </div>
          <p class="truncate text-xs text-surface-dark/55">
            {{ selectedProject.clientName || "Client non renseigné" }}
            ·
            <span class="font-mono">{{
              selectedProjectQuotes.length
                ? selectedProjectQuotes
                    .map((quote) => quote.quoteRef)
                    .join(" + ")
                : "Hors devis"
            }}</span>
            · {{ projectDoneMilestones(selectedProject) }}/{{
              (selectedProject.milestones || []).length
            }}
            jalons
          </p>
        </div>

        <div
          v-if="siblingIndex >= 0 && siblingProjects.length > 1"
          class="ml-1 flex shrink-0 items-center gap-0.5 border-l border-surface-dark/8 pl-2"
        >
          <Button
            text
            severity="secondary"
            class="!h-8 !w-8 !rounded-lg !p-0"
            aria-label="Projet précédent"
            :disabled="!previousProject"
            @click="goToSibling(previousProject)"
          >
            <template #icon
              ><span class="material-symbols-outlined text-lg"
                >chevron_left</span
              ></template
            >
          </Button>
          <span
            class="whitespace-nowrap px-1 text-[11px] tabular-nums text-surface-dark/40"
          >
            {{ siblingIndex + 1 }} / {{ siblingProjects.length }}
          </span>
          <Button
            text
            severity="secondary"
            class="!h-8 !w-8 !rounded-lg !p-0"
            aria-label="Projet suivant"
            :disabled="!nextProject"
            @click="goToSibling(nextProject)"
          >
            <template #icon
              ><span class="material-symbols-outlined text-lg"
                >chevron_right</span
              ></template
            >
          </Button>
        </div>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <Button
          v-if="!['paid', 'closed'].includes(selectedProject.status)"
          label="Terminer le travail"
          class="!rounded-xl"
          @click="openFinishProjectDialog"
        >
          <template #icon
            ><span class="material-symbols-outlined text-lg"
              >task_alt</span
            ></template
          >
        </Button>
        <Select
          :model-value="projectMacroStatus(selectedProject)"
          :options="projectMacroStatusOptions"
          option-label="label"
          option-value="value"
          class="w-40"
          @update:model-value="updateStatus(projectStatusForMacro($event))"
        >
          <template #value="{ value }">
            <Tag
              v-if="value"
              :value="projectMacroStatusMeta[value as ProjectMacroStatus].label"
              :class="
                projectMacroStatusMeta[value as ProjectMacroStatus].tagClass
              "
              rounded
            />
          </template>
          <template #option="{ option }">
            <Tag
              :value="option.label"
              :class="
                projectMacroStatusMeta[option.value as ProjectMacroStatus]
                  .tagClass
              "
              rounded
            />
          </template>
        </Select>
        <Button
          severity="secondary"
          outlined
          class="!rounded-xl"
          label="Modifier"
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
          severity="secondary"
          class="!h-9 !w-9 !rounded-xl !p-0"
          aria-label="Autres actions"
          @click="toggleProjectMenu"
        >
          <template #icon
            ><span class="material-symbols-outlined text-lg"
              >more_vert</span
            ></template
          >
        </Button>
        <Menu ref="projectMenu" :model="projectMenuItems" popup />
      </div>
    </div>

    <section
      v-if="selectedProject"
      class="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
    >
      <div class="flex flex-col gap-6">
        <div
          class="rounded-3xl border border-surface-dark/5 bg-surface-card p-4 sm:p-6"
        >
          <div class="mb-4 flex items-center gap-3">
            <span
              class="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-dark/6 text-surface-dark/55"
            >
              <span class="material-symbols-outlined text-lg"
                >space_dashboard</span
              >
            </span>
            <div>
              <h3 class="font-bold text-surface-dark">Synthèse du projet</h3>
            </div>
          </div>

          <div class="grid gap-4 2xl:grid-cols-2">
            <section
              class="rounded-2xl border border-surface-dark/6 bg-surface-dark/[0.018] p-3 sm:p-4"
            >
              <div class="mb-3 flex items-center gap-2 px-1">
                <span class="material-symbols-outlined text-lg text-primary"
                  >calendar_month</span
                >
                <h4 class="text-sm font-bold text-surface-dark">Planning</h4>
              </div>
              <div class="grid gap-2.5 sm:grid-cols-2">
                <div
                  v-for="metric in planningSummaryMetrics"
                  :key="metric.key"
                  class="flex min-w-0 items-start gap-3 rounded-xl border p-3.5"
                  :class="[
                    summaryCardClass[metric.tone],
                    metric.wide ? 'sm:col-span-2' : '',
                  ]"
                >
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    :class="summaryIconClass[metric.tone]"
                  >
                    <span class="material-symbols-outlined text-base">{{
                      metric.icon
                    }}</span>
                  </span>
                  <div class="min-w-0 flex-1">
                    <p
                      class="text-[10px] font-bold uppercase tracking-wider text-surface-dark/40"
                    >
                      {{ metric.label }}
                    </p>
                    <p
                      class="mt-1 break-words text-base font-bold leading-tight"
                      :class="summaryValueClass[metric.tone]"
                    >
                      {{ metric.value }}
                    </p>
                    <p
                      v-if="metric.detail"
                      class="mt-1 truncate text-[11px] text-surface-dark/45"
                      :title="metric.detail"
                    >
                      {{ metric.detail }}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section
              class="rounded-2xl border border-surface-dark/6 bg-surface-dark/[0.018] p-3 sm:p-4"
            >
              <div class="mb-3 flex items-center gap-2 px-1">
                <span class="material-symbols-outlined text-lg text-primary"
                  >account_balance</span
                >
                <h4 class="text-sm font-bold text-surface-dark">Finance</h4>
              </div>
              <div class="grid gap-2.5 sm:grid-cols-2">
                <div
                  v-for="metric in financialSummaryMetrics"
                  :key="metric.key"
                  class="flex min-w-0 items-start gap-3 rounded-xl border p-3.5"
                  :class="[
                    summaryCardClass[metric.tone],
                    metric.wide ? 'sm:col-span-2' : '',
                  ]"
                >
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    :class="summaryIconClass[metric.tone]"
                  >
                    <span class="material-symbols-outlined text-base">{{
                      metric.icon
                    }}</span>
                  </span>
                  <div class="min-w-0 flex-1">
                    <p
                      class="text-[10px] font-bold uppercase tracking-wider text-surface-dark/40"
                    >
                      {{ metric.label }}
                    </p>
                    <p
                      class="mt-1 break-words text-lg font-bold leading-tight"
                      :class="summaryValueClass[metric.tone]"
                    >
                      {{ metric.value }}
                    </p>
                    <p
                      v-if="metric.detail"
                      class="mt-1 truncate text-[11px] text-surface-dark/45"
                      :title="metric.detail"
                    >
                      {{ metric.detail }}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div
          class="min-w-0 overflow-hidden rounded-3xl border border-surface-dark/5 bg-surface-card p-4 sm:p-6"
        >
          <div class="mb-5">
            <div>
              <h3 class="text-lg font-bold text-surface-dark">
                Ligne du temps
              </h3>
            </div>
          </div>

          <div
            class="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
          >
            <div
              v-for="group in selectedMilestoneGroups"
              :key="group.key"
              class="min-w-0 overflow-hidden rounded-2xl border border-surface-dark/7 bg-white/55 p-3"
            >
              <div class="mb-3 flex items-center justify-between gap-3 px-1">
                <div class="flex min-w-0 items-center gap-3">
                  <span
                    class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
                  >
                    <span class="material-symbols-outlined text-lg">{{
                      group.icon
                    }}</span>
                  </span>
                  <div class="min-w-0">
                    <h4 class="font-bold text-surface-dark">
                      {{ group.label }}
                    </h4>
                    <p class="truncate text-xs text-surface-dark/45">
                      {{ group.description }}
                    </p>
                  </div>
                </div>
                <Button
                  label="Ajouter"
                  size="small"
                  severity="secondary"
                  outlined
                  class="!shrink-0 !rounded-lg"
                  @click="
                    openAddMilestoneDialog(group.key as 'workflow' | 'finance')
                  "
                >
                  <template #icon
                    ><span class="material-symbols-outlined text-base"
                      >add</span
                    ></template
                  >
                </Button>
              </div>
              <div class="grid gap-2">
                <div
                  v-for="milestone in group.milestones"
                  :key="milestone.id"
                  draggable="true"
                  class="group grid min-w-0 max-w-full cursor-grab grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 transition-all active:cursor-grabbing"
                  :class="[
                    milestoneCardClass(
                      selectedProject,
                      milestone,
                      milestoneIndex(selectedProject, milestone),
                    ),
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
                  <span
                    class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                    :class="
                      milestoneIconClass(
                        selectedProject,
                        milestone,
                        milestoneIndex(selectedProject, milestone),
                      )
                    "
                  >
                    <span class="material-symbols-outlined text-lg">
                      {{
                        milestoneIcon(
                          selectedProject,
                          milestone,
                          milestoneIndex(selectedProject, milestone),
                        )
                      }}
                    </span>
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-bold text-surface-dark">
                      {{ milestone.label }}
                    </p>
                    <p class="text-xs text-surface-dark/45">
                      {{ formatDate(milestone.date) }}
                    </p>
                  </div>
                  <div
                    class="flex min-w-0 shrink-0 items-center gap-1 sm:gap-2"
                  >
                    <span
                      v-if="
                        milestoneFinancialAmount(selectedProject, milestone)
                      "
                      class="hidden shrink-0 rounded-full bg-white/80 px-2.5 py-1 text-xs font-bold text-surface-dark ring-1 ring-surface-dark/8 lg:inline-flex"
                    >
                      {{
                        milestoneFinancialAmount(selectedProject, milestone)
                          ?.label
                      }}
                    </span>
                    <span
                      class="hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold min-[1850px]:inline-flex"
                      :class="
                        milestoneBadge(
                          selectedProject,
                          milestone,
                          milestoneIndex(selectedProject, milestone),
                        ).class
                      "
                    >
                      {{
                        milestoneBadge(
                          selectedProject,
                          milestone,
                          milestoneIndex(selectedProject, milestone),
                        ).label
                      }}
                    </span>
                    <div class="flex shrink-0 gap-0.5 rounded-lg bg-white/35">
                      <Button
                        text
                        rounded
                        severity="success"
                        class="!h-8 !w-8 !p-0"
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
                        severity="secondary"
                        class="!h-8 !w-8 !p-0"
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
                        class="!h-8 !w-8 !p-0 opacity-40 transition-opacity group-hover:opacity-100"
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
              <p
                v-if="!group.milestones.length"
                class="rounded-xl border border-dashed border-surface-dark/10 p-4 text-center text-xs text-surface-dark/40"
              >
                Aucune étape dans ce parcours.
              </p>
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
              <h3 class="text-lg font-bold text-surface-dark">Devis liés</h3>
            </div>
            <div class="flex flex-wrap items-center gap-2">
              <span
                class="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary"
              >
                {{ formatCurrency(projectBudgetBase(selectedProject)) }}
              </span>
              <Button
                label="Nouveau devis"
                size="small"
                outlined
                class="!rounded-lg"
                @click="createLinkedQuote"
              >
                <template #icon
                  ><span class="material-symbols-outlined text-base"
                    >add</span
                  ></template
                >
              </Button>
            </div>
          </div>

          <div
            v-if="attachableQuotesForSelectedProject.length"
            class="mb-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]"
          >
            <MultiSelect
              v-model="attachQuoteIds"
              :options="
                attachableQuotesForSelectedProject.map((quote) => ({
                  label: `${quote.quoteRef} · ${quote.clientName} · ${formatCurrency(quote.subtotal)}`,
                  value: quote.id,
                }))
              "
              option-label="label"
              option-value="value"
              placeholder="Sélectionner un ou plusieurs devis acceptés…"
              display="chip"
              :max-selected-labels="2"
              selected-items-label="{0} devis sélectionnés"
              filter
              class="w-full"
            />
            <Button
              :label="
                attachQuoteIds.length > 1
                  ? `Lier ${attachQuoteIds.length} devis`
                  : 'Lier le devis'
              "
              :disabled="!attachQuoteIds.length"
              class="!rounded-xl"
              @click="attachQuoteToSelectedProject"
            >
              <template #icon
                ><span class="material-symbols-outlined text-lg"
                  >link</span
                ></template
              >
            </Button>
          </div>

          <div class="grid gap-2">
            <div
              v-for="quote in selectedProjectQuotes"
              :key="quote.id"
              class="flex items-center justify-between gap-3 rounded-2xl border border-surface-dark/8 bg-white p-3"
            >
              <button
                type="button"
                class="min-w-0 flex-1 text-left"
                @click="openQuote(quote)"
              >
                <p class="truncate text-sm font-bold text-surface-dark">
                  {{ quote.quoteRef }}
                </p>
                <p class="text-xs text-surface-dark/40">
                  {{ quote.title || quote.projectName }}
                </p>
              </button>
              <span
                class="rounded-full px-2 py-0.5 text-xs font-bold"
                :class="quoteStatusMeta[quote.status].tagClass"
                >{{ quoteStatusMeta[quote.status].label }}</span
              >
              <span class="text-sm font-bold text-surface-dark">
                {{ formatCurrency(quote.subtotal) }}
              </span>
              <Button
                text
                rounded
                severity="danger"
                aria-label="Détacher"
                title="Détacher du projet"
                @click="detachQuoteFromSelectedProject(quote)"
              >
                <template #icon
                  ><span class="material-symbols-outlined text-lg"
                    >link_off</span
                  ></template
                >
              </Button>
            </div>
            <p
              v-if="!selectedProjectQuotes.length"
              class="rounded-2xl border border-dashed border-surface-dark/10 p-5 text-center text-sm text-surface-dark/45"
            >
              Aucun devis lié à ce projet.
            </p>
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
                Add-ons hors devis
              </h3>
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
          <Textarea
            v-model="supplementForm.description"
            rows="2"
            auto-resize
            class="mt-3 w-full"
            placeholder="Précisions facultatives : périmètre, demande client, délai…"
          />

          <div class="mt-4 grid gap-2">
            <div
              v-for="supplement in selectedProject.projectSupplements || []"
              :key="supplement.id"
              class="flex flex-col gap-3 rounded-2xl border border-surface-dark/8 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="truncate text-sm font-bold text-surface-dark">
                    {{ supplement.title }}
                  </p>
                  <span
                    class="rounded-full px-2 py-0.5 text-[11px] font-bold"
                    :class="addOnStatus(selectedProject, supplement.id).class"
                  >
                    {{ addOnStatus(selectedProject, supplement.id).label }}
                  </span>
                </div>
                <p
                  v-if="supplement.description"
                  class="mt-1 text-xs text-surface-dark/55"
                >
                  {{ supplement.description }}
                </p>
                <p class="text-xs text-surface-dark/40">
                  Ajouté le {{ formatDate(supplement.createdAt) }}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-bold text-surface-dark">
                  {{ formatCurrency(supplement.amountExVat) }}
                </span>
                <Button
                  v-if="
                    addOnStatus(selectedProject, supplement.id).label ===
                    'À facturer'
                  "
                  label="Marquer facturé"
                  size="small"
                  outlined
                  class="!rounded-lg"
                  @click="
                    setAddOnFinancialState(
                      selectedProject,
                      supplement.id,
                      'invoiced',
                    )
                  "
                />
                <Button
                  v-if="
                    addOnStatus(selectedProject, supplement.id).label ===
                    'Facturé'
                  "
                  label="Marquer encaissé"
                  size="small"
                  severity="success"
                  outlined
                  class="!rounded-lg"
                  @click="
                    setAddOnFinancialState(
                      selectedProject,
                      supplement.id,
                      'paid',
                    )
                  "
                />
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
              Aucun add-on pour ce projet.
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
              v-if="!selectedProjectQuotes.length"
              label="Devis"
              disabled
              class="!justify-start !rounded-xl !border !border-primary/15 !bg-primary/10 !text-primary disabled:!bg-primary/5 disabled:!opacity-50"
            >
              <template #icon
                ><span class="material-symbols-outlined text-lg"
                  >receipt_long</span
                ></template
              >
            </Button>
            <Button
              v-for="quote in selectedProjectQuotes"
              :key="quote.id"
              :label="quote.quoteRef || 'Devis'"
              class="!justify-start !rounded-xl !border !border-primary/15 !bg-primary/10 !text-primary hover:!border-primary/30 hover:!bg-primary/15"
              @click="openQuote(quote)"
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
              selectedNextMilestone?.label || "Toutes les étapes sont validées."
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
                  <span class="material-symbols-outlined text-xs">delete</span>
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

    <Dialog
      v-model:visible="finishProjectDialogOpen"
      modal
      header="Terminer le travail"
      :style="{ width: 'min(600px, 92vw)' }"
    >
      <div class="grid gap-4">
        <p class="text-sm text-surface-dark/60">
          Les étapes de production seront terminées. Indique où en est la
          facturation pour préparer automatiquement la prochaine action.
        </p>
        <label
          v-for="option in [
            {
              value: 'invoice_now',
              label: 'À facturer maintenant',
              detail: 'Le projet apparaîtra dans les actions à facturer.',
              icon: 'request_quote',
            },
            {
              value: 'already_invoiced',
              label: 'Facture déjà envoyée',
              detail:
                'Les étapes de facture seront validées, mais pas les paiements.',
              icon: 'mark_email_read',
            },
            {
              value: 'no_invoice',
              label: 'Ne pas facturer',
              detail: 'Le projet sera clôturé sans montant restant à traiter.',
              icon: 'money_off',
            },
          ]"
          :key="option.value"
          class="flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition-colors"
          :class="
            finishProjectBillingChoice === option.value
              ? 'border-primary/35 bg-primary/6'
              : 'border-surface-dark/10 bg-white'
          "
        >
          <input
            v-model="finishProjectBillingChoice"
            type="radio"
            :value="option.value"
            class="mt-1 accent-primary"
          />
          <span class="material-symbols-outlined text-primary">{{
            option.icon
          }}</span>
          <span>
            <span class="block text-sm font-bold text-surface-dark">{{
              option.label
            }}</span>
            <span class="block text-xs text-surface-dark/50">{{
              option.detail
            }}</span>
          </span>
        </label>
      </div>
      <template #footer>
        <Button
          text
          severity="secondary"
          label="Annuler"
          @click="finishProjectDialogOpen = false"
        />
        <Button label="Confirmer" @click="finishProject">
          <template #icon
            ><span class="material-symbols-outlined text-lg"
              >task_alt</span
            ></template
          >
        </Button>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="addMilestoneDialogOpen"
      modal
      :header="
        editingMilestoneId
          ? 'Modifier l’étape'
          : milestoneLane === 'finance'
            ? 'Ajouter une échéance financière'
            : 'Ajouter une étape de production'
      "
      :style="{ width: 'min(560px, 92vw)' }"
    >
      <div class="grid gap-4">
        <div
          class="flex items-start gap-3 rounded-2xl border border-surface-dark/8 bg-surface-dark/[0.025] p-3"
        >
          <span class="material-symbols-outlined mt-0.5 text-primary">
            {{ milestoneLane === "finance" ? "payments" : "design_services" }}
          </span>
          <div>
            <p class="text-sm font-bold text-surface-dark">
              Parcours
              {{ milestoneLane === "finance" ? "Finance" : "Production" }}
            </p>
            <p class="mt-0.5 text-xs leading-relaxed text-surface-dark/50">
              {{
                editingMilestoneId
                  ? "Le parcours est déterminé automatiquement par cette étape."
                  : milestoneLane === "finance"
                    ? "Cette échéance apparaîtra dans la colonne Finance. Une étape de paiement correspondante sera préparée automatiquement."
                    : "Cette étape apparaîtra dans la colonne Production."
              }}
            </p>
          </div>
        </div>
        <label class="grid gap-1.5">
          <span
            class="text-xs font-bold uppercase tracking-wide text-surface-dark/45"
            >Libellé</span
          >
          <InputText
            v-model="milestoneForm.label"
            :placeholder="
              milestoneLane === 'finance'
                ? 'Ex : Facture intermédiaire envoyée'
                : 'Ex : Maquettes à valider'
            "
          />
        </label>
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

    <ProjectFormDialog
      v-model:visible="dialogOpen"
      mode="edit"
      :project="selectedProject"
      :client-options="clientOptions"
      :color-options="colorPool"
      :default-hourly-rate="Number(authStore.userProfile?.hourlyRate || 0)"
      :default-color="selectedProject?.color || colorPool[0]"
      @submit="saveProject"
    />
  </div>
</template>
