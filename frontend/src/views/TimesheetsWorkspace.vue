<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";
import type { Timesheet, TimesheetInput, TimesheetSession } from "@client-tracker/contracts";
import Button from "primevue/button";
import ColorPicker from "primevue/colorpicker";
import ConfirmDialog from "primevue/confirmdialog";
import Dialog from "primevue/dialog";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import type { TooltipOptions } from "primevue/tooltip";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { useAuthStore } from "@/stores/authStore";
import { useClientsStore } from "@/stores/clientsStore";
import { useProjectsStore } from "@/stores/projectsStore";
import { useQuotesStore } from "@/stores/quotesStore";
import { useTimesheetsStore } from "@/stores/timesheetsStore";
import { toDateObj } from "@/utils/date";
import { formatCurrency } from "@/utils/quote";

const authStore = useAuthStore();
const clientsStore = useClientsStore();
const projectsStore = useProjectsStore();
const quotesStore = useQuotesStore();
const timesheetsStore = useTimesheetsStore();

// Devis initial d'un projet (par ordre de création) — sert de référence de facturation par défaut.
const projectPrimaryQuote = (projectId: string) =>
  quotesStore.quotes
    .filter((quote) => quote.projectId === projectId)
    .sort(
      (a, b) =>
        (toDateObj(a.createdAt)?.getTime() || 0) -
        (toDateObj(b.createdAt)?.getTime() || 0),
    )[0] || null;
const toast = useToast();
const confirm = useConfirm();
const router = useRouter();

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

const normalizeHexColor = (value: unknown, fallback = "#e96a5f") => {
  const raw = String(value || "").replace("#", "").trim();
  return raw.length === 6 ? `#${raw}` : fallback;
};

const toPickerColor = (value: string) => normalizeHexColor(value).replace("#", "");

const nowTick = ref(Date.now());
const createDialogOpen = ref(false);
const editDialogOpen = ref(false);
const manualSessionDialogOpen = ref(false);
const editingSessionId = ref<string | null>(null);
const sessionTitle = ref("");
const calendarCursor = ref(new Date());
const calendarView = ref<"month" | "week">("month");
let timerInterval: ReturnType<typeof setInterval> | null = null;

const form = reactive({
  projectId: "",
  title: "",
  hourlyRate: 0,
  fixedPriceExVat: 0,
  color: colorPool[0],
});
const editForm = reactive({
  title: "",
  clientId: "",
  hourlyRate: 0,
  fixedPriceExVat: 0,
  projectStartDate: "",
  color: colorPool[0],
});
const manualSessionForm = reactive({
  title: "",
  date: "",
  startTime: "09:00",
  hours: 1,
  minutes: 0,
});

onMounted(() => {
  if (!timesheetsStore.timesheets.length) void timesheetsStore.fetchTimesheets();
  if (!projectsStore.projects.length) void projectsStore.fetchProjects();
  if (!clientsStore.clients.length) void clientsStore.fetchClients();
  if (!quotesStore.quotes.length) void quotesStore.fetchQuotes();
  timerInterval = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
});

onBeforeUnmount(() => {
  if (timerInterval) clearInterval(timerInterval);
});

const openTimesheets = computed(() => timesheetsStore.openTimesheets);
const closedTimesheets = computed(() => timesheetsStore.closedTimesheets);
const selectedTimesheet = computed(() => timesheetsStore.selectedTimesheet);
const selectedIsClosed = computed(() => selectedTimesheet.value?.status === "closed");
const sortedSessions = computed(() =>
  [...(selectedTimesheet.value?.sessions || [])].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  ),
);
const clientOptions = computed(() =>
  clientsStore.clients.map((client) => ({
    label: client.name || client.contactEmail || "Client",
    value: client.id,
  })),
);
const activeProjects = computed(() =>
  projectsStore.projects.filter((project) => !["paid", "closed"].includes(project.status)),
);
const linkedTimesheetByProjectId = (projectId: string) =>
  timesheetsStore.timesheets.find((timesheet) => timesheet.projectId === projectId) ||
  timesheetsStore.timesheets.find((timesheet) => projectsStore.projects.find((project) => project.id === projectId)?.timesheetId === timesheet.id) ||
  null;
const projectOptions = computed(() =>
  activeProjects.value.map((project) => {
    const linkedTimesheet = linkedTimesheetByProjectId(project.id);
    return {
      label: `${project.title}${project.clientName ? ` · ${project.clientName}` : ""}${linkedTimesheet ? " · timesheet existante" : ""}`,
      value: project.id,
    };
  }),
);
const selectedProject = computed(() =>
  projectsStore.projects.find((project) => project.id === form.projectId) || null,
);
const selectedProjectTimesheet = computed(() =>
  selectedProject.value ? linkedTimesheetByProjectId(selectedProject.value.id) : null,
);
const selectedLinkedProject = computed(
  () =>
    projectsStore.projects.find((project) => {
      const timesheet = selectedTimesheet.value;
      if (!timesheet) return false;
      return project.id === timesheet.projectId || project.timesheetId === timesheet.id;
    }) || null,
);
const editColorPickerValue = computed({
  get: () => toPickerColor(editForm.color),
  set: (value) => {
    editForm.color = normalizeHexColor(value, editForm.color);
  },
});

const totalSeconds = (timesheet: Timesheet | null) => {
  if (!timesheet) return 0;
  const runningSeconds = timesheet.activeStartedAt
    ? Math.max(0, Math.round((nowTick.value - new Date(timesheet.activeStartedAt).getTime()) / 1000))
    : 0;
  return Number(timesheet.totalTrackedSeconds || 0) + runningSeconds;
};

const budgetPercentLabel = (timesheet: Timesheet) => {
  const hourlyRate = Number(timesheet.hourlyRate || 0);
  const fixedPrice = Number(timesheet.fixedPriceExVat || 0);
  if (hourlyRate <= 0 || fixedPrice <= 0) return "Budget temps à définir";

  const theoreticalSeconds = (fixedPrice / hourlyRate) * 3600;
  if (theoreticalSeconds <= 0) return "Budget temps à définir";

  return `${Math.round((totalSeconds(timesheet) / theoreticalSeconds) * 100)}% du budget temps`;
};

const selectedTotalSeconds = computed(() => totalSeconds(selectedTimesheet.value));
const selectedTotalHours = computed(() => selectedTotalSeconds.value / 3600);
const theoreticalHours = computed(() => {
  const rate = Number(selectedTimesheet.value?.hourlyRate || 0);
  if (!selectedTimesheet.value || rate <= 0) return 0;
  return Number(selectedTimesheet.value.fixedPriceExVat || 0) / rate;
});
const progressRatio = computed(() =>
  theoreticalHours.value > 0 ? selectedTotalHours.value / theoreticalHours.value : 0,
);
const progressState = computed(() => {
  if (!theoreticalHours.value) return "neutral";
  if (progressRatio.value >= 1) return "danger";
  if (progressRatio.value >= 0.82) return "warning";
  return "ok";
});
const progressColor = computed(() => {
  if (progressState.value === "danger") return "#ef4444";
  if (progressState.value === "warning") return "#f59e0b";
  if (progressState.value === "ok") return "#10b981";
  return "#94a3b8";
});
const circleStyle = computed(() => ({
  background: `conic-gradient(${progressColor.value} ${Math.min(progressRatio.value, 1) * 360}deg, rgba(47,43,61,0.08) 0deg)`,
}));
const trackedCost = computed(() =>
  selectedTotalHours.value * Number(selectedTimesheet.value?.hourlyRate || 0),
);
const remainingHours = computed(() => theoreticalHours.value - selectedTotalHours.value);

const totalPortfolioSeconds = computed(() =>
  openTimesheets.value.reduce((total, item) => total + totalSeconds(item), 0),
);
const totalPortfolioCost = computed(() =>
  openTimesheets.value.reduce((total, item) => total + (totalSeconds(item) / 3600) * Number(item.hourlyRate || 0), 0),
);

const formatDuration = (seconds: number, compact = false) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  if (compact) return `${hours}h ${String(minutes).padStart(2, "0")}`;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
};

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("fr-BE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
const formatTime = (value: string) =>
  new Intl.DateTimeFormat("fr-BE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
const escapeTooltipHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
const sessionTooltipOptions = (timesheet: Timesheet, session: TimesheetSession): TooltipOptions => {
  const color = normalizeHexColor(timesheet.color);
  const startedAt = new Date(session.startedAt);
  const endedAt = new Date(startedAt.getTime() + Number(session.durationSeconds || 0) * 1000);
  const sessionTitle = session.title?.trim();
  const titleLine = sessionTitle
    ? `<span class="timesheet-tooltip__session">${escapeTooltipHtml(sessionTitle)}</span>`
    : "";

  return {
    escape: false,
    fitContent: true,
    showDelay: 120,
    value: `
      <span class="timesheet-tooltip__project">${escapeTooltipHtml(timesheet.title)}</span>
      ${titleLine}
      <span class="timesheet-tooltip__meta">${formatTime(session.startedAt)} - ${formatTime(endedAt.toISOString())} · ${formatDuration(session.durationSeconds, true)}</span>
    `,
    pt: {
      arrow: { style: { display: "none" } },
      text: {
        class: "timesheet-tooltip",
        style: {
          background: "#ffffff",
          border: `1px solid ${color}`,
          borderRadius: "12px",
          boxShadow: "0 14px 34px rgba(47, 43, 61, 0.14)",
          color: "#2f2b3d",
          padding: "10px 12px",
        },
      },
    },
  };
};

const formatCalendarTitle = (date: Date) =>
  new Intl.DateTimeFormat("fr-BE", { month: "long", year: "numeric" }).format(date);

const formatProjectDate = (value?: string) => {
  if (!value) return "Non renseignée";
  return new Intl.DateTimeFormat("fr-BE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
};

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

watch(selectedProject, (project) => {
  if (!project) {
    form.title = "";
    form.hourlyRate = Number(authStore.userProfile?.hourlyRate || 0);
    form.fixedPriceExVat = 0;
    form.color = colorPool[0];
    return;
  }

  form.title = project.title || "Projet sans titre";
  form.hourlyRate = Number(project.hourlyRate || authStore.userProfile?.hourlyRate || 0);
  form.fixedPriceExVat = Number(project.budgetExVat || 0);
  form.color = normalizeHexColor(project.color, colorPool[0]);
});

const resetForm = () => {
  const firstProjectWithoutTimesheet =
    activeProjects.value.find((project) => !linkedTimesheetByProjectId(project.id)) || activeProjects.value[0] || null;
  form.projectId = firstProjectWithoutTimesheet?.id || "";
  form.title = firstProjectWithoutTimesheet?.title || "";
  form.hourlyRate = Number(authStore.userProfile?.hourlyRate || 0);
  form.fixedPriceExVat = Number(firstProjectWithoutTimesheet?.budgetExVat || 0);
  form.color = normalizeHexColor(firstProjectWithoutTimesheet?.color, colorPool[openTimesheets.value.length % colorPool.length]);
};

const openCreateDialog = () => {
  resetForm();
  createDialogOpen.value = true;
};

const openEditDialog = () => {
  if (!selectedTimesheet.value) return;
  editForm.title = selectedTimesheet.value.title;
  editForm.clientId = selectedTimesheet.value.clientId || "";
  editForm.hourlyRate = Number(selectedTimesheet.value.hourlyRate || 0);
  editForm.fixedPriceExVat = Number(selectedTimesheet.value.fixedPriceExVat || 0);
  editForm.projectStartDate = selectedTimesheet.value.projectStartDate || "";
  editForm.color = normalizeHexColor(selectedTimesheet.value.color);
  editDialogOpen.value = true;
};

const openLinkedProject = () => {
  const project = selectedLinkedProject.value;
  if (!project) return;
  projectsStore.selectProject(project.id);
  router.push({ name: "project-detail", params: { id: project.id } });
};

const showTimesheetError = (error: unknown) => {
  console.error(error);
  toast.add({
    severity: "error",
    summary: "Timesheets indisponibles",
    detail: "Firebase refuse l'accès à la collection timesheets. Déploie les règles Firestore puis réessaie.",
    life: 5200,
  });
};

const createTimesheet = async () => {
  const project = selectedProject.value;
  if (!project) {
    toast.add({
      severity: "warn",
      summary: "Projet requis",
      detail: "Sélectionne un projet existant pour créer une timesheet.",
      life: 2800,
    });
    return;
  }
  if (selectedProjectTimesheet.value) {
    toast.add({
      severity: "warn",
      summary: "Timesheet déjà liée",
      detail: "Ce projet possède déjà une timesheet. Sélectionne-la dans la liste.",
      life: 3200,
    });
    timesheetsStore.selectTimesheet(selectedProjectTimesheet.value.id);
    createDialogOpen.value = false;
    return;
  }

  const primaryQuote = projectPrimaryQuote(project.id);
  const payload: TimesheetInput = {
    title: form.title.trim() || project.title || "Projet sans titre",
    projectId: project.id,
    sourceType: project.sourceType === "quote" ? "quote" : "custom",
    quoteId: primaryQuote?.id || "",
    quoteRef: primaryQuote?.quoteRef || "",
    clientId: project.clientId || "",
    clientName: project.clientName || "",
    color: form.color,
    hourlyRate: Number(form.hourlyRate || 0),
    fixedPriceExVat: Number(form.fixedPriceExVat || 0),
    projectStartDate: project.startedAt || "",
    status: "open",
    activeStartedAt: "",
  };

  try {
    const timesheet = await timesheetsStore.createTimesheet(payload);
    await projectsStore.updateProject(project.id, { timesheetId: timesheet.id });
    createDialogOpen.value = false;
  } catch (error) {
    showTimesheetError(error);
  }
};

const toggleTimer = async () => {
  if (!selectedTimesheet.value) return;
  try {
    if (selectedTimesheet.value.activeStartedAt) {
      await timesheetsStore.stopTimer(selectedTimesheet.value.id, sessionTitle.value);
      sessionTitle.value = "";
    } else {
      await timesheetsStore.startTimer(selectedTimesheet.value.id);
    }
  } catch (error) {
    showTimesheetError(error);
  }
};

const openManualSessionDialog = () => {
  const now = new Date();
  editingSessionId.value = null;
  manualSessionForm.title = "";
  manualSessionForm.date = toDateInputValue(now);
  manualSessionForm.startTime = `${String(now.getHours()).padStart(2, "0")}:00`;
  manualSessionForm.hours = 1;
  manualSessionForm.minutes = 0;
  manualSessionDialogOpen.value = true;
};

const openEditSessionDialog = (session: TimesheetSession) => {
  const startedAt = new Date(session.startedAt);
  editingSessionId.value = session.id;
  manualSessionForm.title = session.title || "";
  manualSessionForm.date = toDateInputValue(startedAt);
  manualSessionForm.startTime = `${String(startedAt.getHours()).padStart(2, "0")}:${String(startedAt.getMinutes()).padStart(2, "0")}`;
  manualSessionForm.hours = Math.floor(Number(session.durationSeconds || 0) / 3600);
  manualSessionForm.minutes = Math.round((Number(session.durationSeconds || 0) % 3600) / 60);
  manualSessionDialogOpen.value = true;
};

const saveManualSession = async () => {
  if (!selectedTimesheet.value) return;

  const durationSeconds =
    Math.max(0, Number(manualSessionForm.hours || 0)) * 3600 +
    Math.max(0, Number(manualSessionForm.minutes || 0)) * 60;

  if (!manualSessionForm.date || !manualSessionForm.startTime || durationSeconds <= 0) {
    toast.add({
      severity: "warn",
      summary: "Session incomplète",
      detail: "Indique une date, une heure de début et une durée supérieure à zéro.",
      life: 3200,
    });
    return;
  }

  const startedAt = new Date(`${manualSessionForm.date}T${manualSessionForm.startTime}:00`);
  const endedAt = new Date(startedAt.getTime() + durationSeconds * 1000);
  const session: TimesheetSession = {
    id: crypto.randomUUID(),
    title: manualSessionForm.title.trim(),
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationSeconds,
  };
  const existingSessions = selectedTimesheet.value.sessions || [];
  const wasEditing = Boolean(editingSessionId.value);
  const sessions = editingSessionId.value
    ? existingSessions.map((item) => (item.id === editingSessionId.value ? { ...session, id: editingSessionId.value } : item))
    : [session, ...existingSessions];
  const totalTrackedSeconds = sessions.reduce((total, item) => total + Number(item.durationSeconds || 0), 0);

  try {
    await timesheetsStore.updateTimesheet(selectedTimesheet.value.id, {
      sessions,
      totalTrackedSeconds,
    });
    manualSessionDialogOpen.value = false;
    editingSessionId.value = null;
    toast.add({
      severity: "success",
      summary: wasEditing ? "Session modifiée" : "Session ajoutée",
      detail: wasEditing
        ? "La session et le total du projet ont été mis à jour."
        : "Le temps a été ajouté au total du projet.",
      life: 2400,
    });
  } catch (error) {
    showTimesheetError(error);
  }
};

const deleteSession = (session: TimesheetSession) => {
  if (!selectedTimesheet.value) return;
  const timesheet = selectedTimesheet.value;
  confirm.require({
    message: `Supprimer cette session de ${formatDuration(session.durationSeconds, true)} ?`,
    header: "Supprimer la session",
    icon: "pi pi-exclamation-triangle",
    rejectProps: {
      label: "Annuler",
      severity: "secondary",
      outlined: true,
    },
    acceptProps: {
      label: "Supprimer",
      severity: "danger",
    },
    accept: async () => {
      const sessions = (timesheet.sessions || []).filter((item) => item.id !== session.id);
      const totalTrackedSeconds = sessions.reduce((total, item) => total + Number(item.durationSeconds || 0), 0);
      try {
        await timesheetsStore.updateTimesheet(timesheet.id, {
          sessions,
          totalTrackedSeconds,
        });
        toast.add({
          severity: "secondary",
          summary: "Session supprimée",
          detail: "Le total du projet a été recalculé.",
          life: 2400,
        });
      } catch (error) {
        showTimesheetError(error);
      }
    },
  });
};

const saveTimesheetEdits = async () => {
  if (!selectedTimesheet.value) return;
  const client = clientsStore.clients.find((item) => item.id === editForm.clientId);
  try {
    await timesheetsStore.updateTimesheet(selectedTimesheet.value.id, {
      title: editForm.title.trim() || "Projet sans titre",
      clientId: editForm.clientId,
      clientName: client?.name || selectedTimesheet.value.clientName || "",
      hourlyRate: Number(editForm.hourlyRate || 0),
      fixedPriceExVat: Number(editForm.fixedPriceExVat || 0),
      projectStartDate: editForm.projectStartDate,
      color: normalizeHexColor(editForm.color),
    });
    editDialogOpen.value = false;
    toast.add({
      severity: "success",
      summary: "Timesheet modifiée",
      detail: "Les informations du projet ont été mises à jour.",
      life: 2400,
    });
  } catch (error) {
    showTimesheetError(error);
  }
};

const closeSelected = () => {
  if (!selectedTimesheet.value) return;
  const timesheet = selectedTimesheet.value;
  confirm.require({
    message: `Clôturer "${timesheet.title}" ? Le projet passera dans les timesheets clôturées.`,
    header: "Clôturer la timesheet",
    icon: "pi pi-check-circle",
    rejectProps: {
      label: "Annuler",
      severity: "secondary",
      outlined: true,
    },
    acceptProps: {
      label: "Clôturer",
      severity: "success",
    },
    accept: async () => {
      try {
        if (timesheet.activeStartedAt) {
          await timesheetsStore.stopTimer(timesheet.id);
        }
        await timesheetsStore.updateTimesheet(timesheet.id, { status: "closed" });
        const nextOpen = timesheetsStore.openTimesheets.find((item) => item.id !== timesheet.id);
        timesheetsStore.selectTimesheet(nextOpen?.id || timesheet.id);
        toast.add({
          severity: "success",
          summary: "Timesheet clôturée",
          detail: "Le projet est marqué comme livré.",
          life: 2600,
        });
      } catch (error) {
        showTimesheetError(error);
      }
    },
  });
};

const deleteSelected = () => {
  if (!selectedTimesheet.value) return;
  const timesheet = selectedTimesheet.value;
  confirm.require({
    message: `Supprimer définitivement "${timesheet.title}" et toutes ses sessions ?`,
    header: "Supprimer la timesheet",
    icon: "pi pi-exclamation-triangle",
    rejectProps: {
      label: "Annuler",
      severity: "secondary",
      outlined: true,
    },
    acceptProps: {
      label: "Supprimer",
      severity: "danger",
    },
    accept: async () => {
      try {
        await timesheetsStore.deleteTimesheet(timesheet.id);
        toast.add({
          severity: "secondary",
          summary: "Timesheet supprimée",
          detail: "Le suivi temps a été retiré.",
          life: 2400,
        });
      } catch (error) {
        showTimesheetError(error);
      }
    },
  });
};

const monthStart = computed(() =>
  new Date(calendarCursor.value.getFullYear(), calendarCursor.value.getMonth(), 1),
);
const monthEnd = computed(() =>
  new Date(calendarCursor.value.getFullYear(), calendarCursor.value.getMonth() + 1, 0),
);
const getWeekStart = (date: Date) => {
  const start = new Date(date);
  const mondayOffset = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - mondayOffset);
  start.setHours(0, 0, 0, 0);
  return start;
};
const weekStart = computed(() => getWeekStart(calendarCursor.value));
const weekEnd = computed(() => {
  const end = new Date(weekStart.value);
  end.setDate(end.getDate() + 6);
  return end;
});
const monthCalendarDays = computed(() => {
  const days: Date[] = [];
  const start = getWeekStart(monthStart.value);

  for (let i = 0; i < 42; i += 1) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  return days;
});
const weekCalendarDays = computed(() =>
  Array.from({ length: 7 }, (_, index) => {
    const day = new Date(weekStart.value);
    day.setDate(weekStart.value.getDate() + index);
    return day;
  }),
);
const visibleCalendarDays = computed(() =>
  calendarView.value === "week" ? weekCalendarDays.value : monthCalendarDays.value,
);

const dayKey = (date: Date) => date.toISOString().slice(0, 10);
const sessionDayKey = (value: string) => new Date(value).toISOString().slice(0, 10);
const sessionsByDay = computed(() => {
  const grouped = new Map<string, Array<{ timesheet: Timesheet; session: TimesheetSession }>>();
  for (const timesheet of openTimesheets.value) {
    for (const session of timesheet.sessions || []) {
      const key = sessionDayKey(session.startedAt);
      const entries = grouped.get(key) || [];
      entries.push({ timesheet, session });
      grouped.set(key, entries);
    }
  }

  for (const entries of grouped.values()) {
    entries.sort(
      (first, second) =>
        new Date(first.session.startedAt).getTime() - new Date(second.session.startedAt).getTime(),
    );
  }

  return grouped;
});

const calendarEntries = (date: Date) => sessionsByDay.value.get(dayKey(date)) || [];
const weekHourMarks = [0, 3, 6, 9, 12, 15, 18, 21, 24];
const weekSessionEntries = (date: Date) => {
  const key = dayKey(date);
  const entries: Array<{
    timesheet: Timesheet;
    session: TimesheetSession;
    startMinute: number;
    endMinute: number;
    top: string;
    height: string;
    left: string;
    width: string;
  }> = [];

  for (const timesheet of openTimesheets.value) {
    for (const session of timesheet.sessions || []) {
      const startedAt = new Date(session.startedAt);
      if (sessionDayKey(session.startedAt) !== key) continue;

      const minutesFromStart = startedAt.getHours() * 60 + startedAt.getMinutes();
      const visibleDurationMinutes = Math.max(15, Number(session.durationSeconds || 0) / 60);
      const cappedDuration = Math.min(visibleDurationMinutes, 1440 - minutesFromStart);
      const endMinute = Math.min(minutesFromStart + cappedDuration, 1440);

      entries.push({
        timesheet,
        session,
        startMinute: minutesFromStart,
        endMinute,
        top: `${(minutesFromStart / 1440) * 100}%`,
        height: `${(cappedDuration / 1440) * 100}%`,
        left: "0.25rem",
        width: "calc(100% - 0.5rem)",
      });
    }
  }

  const sortedEntries = [...entries].sort(
    (first, second) => first.startMinute - second.startMinute || first.endMinute - second.endMinute,
  );
  let group: typeof sortedEntries = [];
  let groupEnd = 0;

  const assignConflictColumns = (conflictingEntries: typeof sortedEntries) => {
    if (!conflictingEntries.length) return;
    const columnEnds: number[] = [];
    const assignedColumns = new Map<string, number>();

    for (const entry of conflictingEntries) {
      const reusableColumn = columnEnds.findIndex((columnEnd) => entry.startMinute >= columnEnd);
      const column = reusableColumn >= 0 ? reusableColumn : columnEnds.length;
      columnEnds[column] = entry.endMinute;
      assignedColumns.set(entry.session.id, column);
    }

    const columnCount = Math.max(1, columnEnds.length);
    const slotWidth = 100 / columnCount;

    for (const entry of conflictingEntries) {
      const column = assignedColumns.get(entry.session.id) || 0;
      entry.left = `calc(${column * slotWidth}% + 0.25rem)`;
      entry.width = `calc(${slotWidth}% - 0.5rem)`;
    }
  };

  for (const entry of sortedEntries) {
    if (!group.length || entry.startMinute < groupEnd) {
      group.push(entry);
      groupEnd = Math.max(groupEnd, entry.endMinute);
      continue;
    }

    assignConflictColumns(group);
    group = [entry];
    groupEnd = entry.endMinute;
  }
  assignConflictColumns(group);

  return entries;
};
const formatPeriodRange = (start: Date, end: Date) => {
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const startLabel = new Intl.DateTimeFormat("fr-BE", {
    day: "2-digit",
    month: sameMonth ? undefined : "short",
  }).format(start);
  const endLabel = new Intl.DateTimeFormat("fr-BE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(end);
  return `${startLabel} - ${endLabel}`;
};
const calendarTitle = computed(() =>
  calendarView.value === "week"
    ? formatPeriodRange(weekStart.value, weekEnd.value)
    : formatCalendarTitle(calendarCursor.value),
);
const calendarDescription = computed(() =>
  calendarView.value === "week"
    ? "Répartition hebdomadaire par projet ouvert."
    : "Répartition mensuelle par projet ouvert.",
);
const isOutsideCurrentPeriod = (date: Date) =>
  calendarView.value === "month" && date.getMonth() !== monthStart.value.getMonth();
const changeCalendarPeriod = (offset: number) => {
  if (calendarView.value === "week") {
    const next = new Date(calendarCursor.value);
    next.setDate(next.getDate() + offset * 7);
    calendarCursor.value = next;
    return;
  }

  calendarCursor.value = new Date(calendarCursor.value.getFullYear(), calendarCursor.value.getMonth() + offset, 1);
};

</script>

<template>
  <div class="flex flex-col gap-6">
    <ConfirmDialog />

    <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div class="flex items-start gap-3">
        <span class="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <span class="material-symbols-outlined text-2xl text-primary">timer</span>
        </span>
        <div>
          <h1 class="text-3xl font-heading font-bold text-surface-dark">Timesheets</h1>
          <p class="mt-1 text-sm text-surface-dark/55">
            Temps, budget et rentabilité ·
            {{ openTimesheets.length }} projet{{ openTimesheets.length > 1 ? "s" : "" }} ouvert{{ openTimesheets.length > 1 ? "s" : "" }}
            · {{ formatDuration(totalPortfolioSeconds, true) }}
            · {{ formatCurrency(totalPortfolioCost) }} au taux saisi.
          </p>
        </div>
      </div>
      <Button label="Nouvelle timesheet" @click="openCreateDialog">
        <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
      </Button>
    </div>

    <div class="grid grid-cols-1 gap-6 xl:grid-cols-[330px_minmax(0,1fr)]">
      <aside class="rounded-3xl border border-surface-dark/5 bg-surface-card p-4">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-lg font-bold text-surface-dark">Projets ouverts</h2>
          <span class="rounded-full bg-surface-dark/5 px-2.5 py-1 text-xs font-semibold text-surface-dark/55">
            {{ openTimesheets.length }}
          </span>
        </div>

        <div v-if="openTimesheets.length" class="flex flex-col gap-2">
          <button
            v-for="timesheet in openTimesheets"
            :key="timesheet.id"
            type="button"
            class="rounded-2xl border p-3 text-left transition-all duration-150"
            :class="
              selectedTimesheet?.id === timesheet.id
                ? 'border-primary/30 bg-primary/8 ring-1 ring-primary/20'
                : 'border-surface-dark/8 bg-white hover:border-primary/25 hover:shadow-sm'
            "
            @click="timesheetsStore.selectTimesheet(timesheet.id)"
          >
            <div class="flex items-start gap-3">
              <span class="mt-1 h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: timesheet.color }"></span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-bold text-surface-dark">{{ timesheet.title }}</span>
                <span class="block truncate text-xs text-surface-dark/50">
                  {{ timesheet.clientName || "Sans client" }}
                  · {{ budgetPercentLabel(timesheet) }}
                </span>
              </span>
              <span
                v-if="timesheet.activeStartedAt"
                class="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600"
              >
                Live
              </span>
            </div>
            <div class="mt-3 flex items-center justify-between text-xs">
              <span class="font-semibold text-surface-dark">{{ formatDuration(totalSeconds(timesheet), true) }}</span>
              <span class="text-surface-dark/50">{{ formatCurrency((totalSeconds(timesheet) / 3600) * timesheet.hourlyRate) }}</span>
            </div>
          </button>
        </div>

        <div v-else class="rounded-2xl border border-dashed border-surface-dark/12 p-6 text-center text-sm text-surface-dark/50">
          Aucun projet suivi pour l'instant.
        </div>

        <div v-if="closedTimesheets.length" class="mt-6 border-t border-surface-dark/8 pt-4">
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-sm font-bold uppercase tracking-wide text-surface-dark/45">Clôturées</h3>
            <span class="rounded-full bg-surface-dark/5 px-2 py-0.5 text-[11px] font-semibold text-surface-dark/45">
              {{ closedTimesheets.length }}
            </span>
          </div>
          <div class="flex flex-col gap-2">
            <button
              v-for="timesheet in closedTimesheets"
              :key="timesheet.id"
              type="button"
              class="rounded-2xl border p-3 text-left transition-all duration-150"
              :class="
                selectedTimesheet?.id === timesheet.id
                  ? 'border-primary/30 bg-primary/8 ring-1 ring-primary/20'
                  : 'border-surface-dark/8 bg-surface-dark/[0.035] hover:border-primary/25 hover:shadow-sm'
              "
              @click="timesheetsStore.selectTimesheet(timesheet.id)"
            >
              <div class="flex items-start gap-3">
                <span class="mt-1 h-3 w-3 shrink-0 rounded-full" :style="{ backgroundColor: timesheet.color }"></span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-bold text-surface-dark">{{ timesheet.title }}</span>
                  <span class="block truncate text-xs text-surface-dark/45">
                    Livré · {{ budgetPercentLabel(timesheet) }}
                  </span>
                </span>
              </div>
            </button>
          </div>
        </div>
      </aside>

      <section v-if="selectedTimesheet" class="flex flex-col gap-6">
        <div class="grid grid-cols-1 gap-6 2xl:grid-cols-[minmax(0,1fr)_360px]">
          <div class="overflow-hidden rounded-3xl border border-surface-dark/5 bg-surface-card p-6">
            <div class="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div class="mb-2 flex items-center gap-2">
                  <span class="h-3 w-3 rounded-full" :style="{ backgroundColor: selectedTimesheet.color }"></span>
                  <span class="text-xs font-semibold uppercase tracking-wide text-surface-dark/45">
                    {{ selectedTimesheet.sourceType === "quote" ? "Devis accepté" : "Projet hors devis" }}
                  </span>
                </div>
                <h2 class="text-2xl font-bold text-surface-dark">{{ selectedTimesheet.title }}</h2>
                <p class="mt-1 text-sm text-surface-dark/50">
                  {{ selectedTimesheet.clientName || "Client non renseigné" }}
                  <template v-if="selectedTimesheet.quoteRef"> · {{ selectedTimesheet.quoteRef }}</template>
                </p>
                <p class="mt-1 text-xs font-semibold uppercase tracking-wide text-surface-dark/35">
                  Début projet · {{ formatProjectDate(selectedTimesheet.projectStartDate) }}
                </p>
              </div>
              <div class="flex flex-wrap gap-2">
                <Button
                  label="Projet"
                  severity="secondary"
                  rounded
                  class="!border !border-amber-500/15 !bg-amber-500/10 !text-surface-dark enabled:hover:!border-amber-500/30 enabled:hover:!bg-amber-500/15"
                  :disabled="!selectedLinkedProject"
                  :title="selectedLinkedProject ? 'Ouvrir le projet lié' : 'Aucun projet lié'"
                  @click="openLinkedProject"
                >
                  <template #icon><span class="material-symbols-outlined text-lg text-amber-600">workspaces</span></template>
                </Button>
                <Button severity="secondary" outlined rounded aria-label="Modifier" title="Modifier" @click="openEditDialog">
                  <template #icon><span class="material-symbols-outlined text-lg">edit</span></template>
                </Button>
                <Button
                  v-if="!selectedIsClosed"
                  label="Clôturer"
                  severity="success"
                  outlined
                  @click="closeSelected"
                >
                  <template #icon><span class="material-symbols-outlined text-lg">check</span></template>
                </Button>
                <Button severity="danger" outlined rounded aria-label="Supprimer" title="Supprimer" @click="deleteSelected">
                  <template #icon><span class="material-symbols-outlined text-lg">delete</span></template>
                </Button>
              </div>
            </div>

            <div class="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
              <div class="flex min-w-0 flex-col items-center justify-center">
                <div class="timer-ring flex aspect-square w-full max-w-72 items-center justify-center rounded-full p-3" :style="circleStyle">
                  <div class="flex h-full w-full flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
                    <span class="text-xs font-bold uppercase tracking-wide text-surface-dark/40">Temps total</span>
                    <span class="mt-2 font-heading text-4xl font-bold text-surface-dark">
                      {{ formatDuration(selectedTotalSeconds) }}
                    </span>
                    <span
                      class="mt-3 rounded-full px-3 py-1 text-xs font-bold"
                      :class="{
                        'bg-emerald-500/10 text-emerald-600': progressState === 'ok',
                        'bg-amber-500/10 text-amber-600': progressState === 'warning',
                        'bg-red-500/10 text-red-600': progressState === 'danger',
                        'bg-surface-dark/5 text-surface-dark/50': progressState === 'neutral',
                      }"
                    >
                      <template v-if="theoreticalHours">
                        {{ Math.round(progressRatio * 100) }}% du budget temps
                      </template>
                      <template v-else>Budget temps à définir</template>
                    </span>
                  </div>
                </div>

                <InputText
                  v-model="sessionTitle"
                  class="mt-5 w-full max-w-xs"
                  placeholder="Titre de cette session (optionnel)"
                />
                <Button
                  class="mt-3 !h-16 !w-full !max-w-xs !justify-center !rounded-2xl !text-base !font-bold"
                  :label="selectedIsClosed ? 'Clôturée' : selectedTimesheet.activeStartedAt ? 'Pause' : 'Play'"
                  :severity="selectedIsClosed ? 'secondary' : selectedTimesheet.activeStartedAt ? 'danger' : undefined"
                  :disabled="selectedIsClosed"
                  @click="toggleTimer"
                >
                  <template #icon>
                    <span class="material-symbols-outlined text-lg">{{ selectedIsClosed ? 'check' : selectedTimesheet.activeStartedAt ? 'pause' : 'play_arrow' }}</span>
                  </template>
                </Button>
              </div>

              <div class="grid min-w-0 content-start gap-3 sm:grid-cols-2 xl:grid-cols-1 min-[1700px]:grid-cols-2">
                <div class="min-w-0 rounded-2xl border border-surface-dark/8 bg-white p-3.5">
                  <p class="text-xs font-semibold uppercase tracking-wide text-surface-dark/40">Taux horaire</p>
                  <p class="mt-1.5 whitespace-nowrap text-lg font-bold leading-tight text-surface-dark sm:text-xl min-[1700px]:text-2xl">
                    {{ formatCurrency(selectedTimesheet.hourlyRate) }}
                  </p>
                </div>
                <div class="min-w-0 rounded-2xl border border-surface-dark/8 bg-white p-3.5">
                  <p class="text-xs font-semibold uppercase tracking-wide text-surface-dark/40">Prix HT projet</p>
                  <p class="mt-1.5 whitespace-nowrap text-lg font-bold leading-tight text-surface-dark sm:text-xl min-[1700px]:text-2xl">
                    {{ formatCurrency(selectedTimesheet.fixedPriceExVat) }}
                  </p>
                </div>
                <div class="min-w-0 rounded-2xl border border-surface-dark/8 bg-white p-3.5">
                  <p class="text-xs font-semibold uppercase tracking-wide text-surface-dark/40">Heures théoriques</p>
                  <p class="mt-1.5 whitespace-nowrap text-lg font-bold leading-tight text-surface-dark sm:text-xl min-[1700px]:text-2xl">{{ theoreticalHours.toFixed(1) }}h</p>
                </div>
                <div class="min-w-0 rounded-2xl border border-surface-dark/8 bg-white p-3.5">
                  <p class="text-xs font-semibold uppercase tracking-wide text-surface-dark/40">Coût actuel</p>
                  <p class="mt-1.5 whitespace-nowrap text-lg font-bold leading-tight text-surface-dark sm:text-xl min-[1700px]:text-2xl">{{ formatCurrency(trackedCost) }}</p>
                </div>
                <div class="min-w-0 rounded-2xl border border-surface-dark/8 bg-white p-3.5 sm:col-span-2 xl:col-span-1 min-[1700px]:col-span-2">
                  <div class="mb-2 flex items-center justify-between text-sm">
                    <span class="font-semibold text-surface-dark">Marge temps</span>
                    <span :style="{ color: progressColor }" class="font-bold">
                      {{ remainingHours >= 0 ? "+" : "" }}{{ remainingHours.toFixed(1) }}h
                    </span>
                  </div>
                  <div class="h-2 overflow-hidden rounded-full bg-surface-dark/6">
                    <div
                      class="h-full rounded-full"
                      :style="{ width: `${Math.min(progressRatio * 100, 100)}%`, backgroundColor: progressColor }"
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="rounded-3xl border border-surface-dark/5 bg-surface-card p-5">
            <div class="mb-4 flex items-center justify-between gap-3">
              <h3 class="text-lg font-bold text-surface-dark">Sessions</h3>
              <Button
                v-if="!selectedIsClosed"
                label="Ajouter"
                severity="secondary"
                outlined
                @click="openManualSessionDialog"
              >
                <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
              </Button>
            </div>
            <div v-if="selectedTimesheet.sessions.length" class="flex max-h-[520px] flex-col gap-3 overflow-y-auto pr-1">
              <div
                v-for="(session, index) in sortedSessions"
                :key="session.id"
                class="rounded-2xl border border-surface-dark/8 bg-white p-3"
              >
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0 flex-1">
                    <p class="text-[11px] font-bold uppercase tracking-wide text-surface-dark/35">
                      Session {{ sortedSessions.length - index }}
                    </p>
                    <p class="truncate text-sm font-semibold text-surface-dark">
                      {{ session.title || "Session sans titre" }}
                    </p>
                  </div>
                  <div class="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      class="flex h-8 w-8 items-center justify-center rounded-lg text-surface-dark/45 transition-colors hover:bg-surface-dark/5 hover:text-surface-dark"
                      title="Modifier la session"
                      @click="openEditSessionDialog(session)"
                    >
                      <span class="material-symbols-outlined text-[18px]">edit</span>
                    </button>
                    <button
                      type="button"
                      class="flex h-8 w-8 items-center justify-center rounded-lg text-red-500/75 transition-colors hover:bg-red-500/10 hover:text-red-600"
                      title="Supprimer la session"
                      @click="deleteSession(session)"
                    >
                      <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                </div>
                <div class="mt-2 flex items-center justify-between text-xs text-surface-dark/50">
                  <span>{{ formatDateTime(session.startedAt) }}</span>
                  <span class="font-bold text-surface-dark">{{ formatDuration(session.durationSeconds, true) }}</span>
                </div>
              </div>
            </div>
            <p v-else class="rounded-2xl border border-dashed border-surface-dark/12 p-6 text-center text-sm text-surface-dark/50">
              Lance le timer pour enregistrer ta première session.
            </p>
          </div>
        </div>

        <div class="rounded-3xl border border-surface-dark/5 bg-surface-card p-6">
          <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 class="text-lg font-bold text-surface-dark">Calendrier du temps</h3>
              <p class="text-sm text-surface-dark/50">{{ calendarDescription }}</p>
            </div>
            <div class="flex flex-col gap-2 sm:items-end">
              <div class="flex rounded-xl border border-surface-dark/10 bg-white p-1">
                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-xs font-bold transition-colors"
                  :class="calendarView === 'month' ? 'bg-primary text-white' : 'text-surface-dark/55 hover:bg-surface-dark/5'"
                  @click="calendarView = 'month'"
                >
                  Mois
                </button>
                <button
                  type="button"
                  class="rounded-lg px-3 py-1.5 text-xs font-bold transition-colors"
                  :class="calendarView === 'week' ? 'bg-primary text-white' : 'text-surface-dark/55 hover:bg-surface-dark/5'"
                  @click="calendarView = 'week'"
                >
                  Semaine
                </button>
              </div>
              <div class="flex items-center gap-2">
                <Button severity="secondary" text aria-label="Période précédente" @click="changeCalendarPeriod(-1)">
                  <template #icon><span class="material-symbols-outlined text-lg">chevron_left</span></template>
                </Button>
                <span class="min-w-44 text-center text-sm font-bold capitalize text-surface-dark">
                  {{ calendarTitle }}
                </span>
                <Button severity="secondary" text aria-label="Période suivante" @click="changeCalendarPeriod(1)">
                  <template #icon><span class="material-symbols-outlined text-lg">chevron_right</span></template>
                </Button>
              </div>
            </div>
          </div>

          <template v-if="calendarView === 'month'">
            <div class="grid grid-cols-7 gap-2 text-xs font-bold uppercase tracking-wide text-surface-dark/40">
              <span v-for="day in ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']" :key="day">{{ day }}</span>
            </div>
            <div class="mt-2 grid grid-cols-7 gap-2">
              <div
                v-for="day in monthCalendarDays"
                :key="day.toISOString()"
                class="min-h-28 rounded-2xl border border-surface-dark/8 bg-white p-2"
                :class="isOutsideCurrentPeriod(day) ? 'opacity-40' : ''"
              >
                <div class="mb-2 text-xs font-bold text-surface-dark/60">{{ day.getDate() }}</div>
                <div class="flex flex-col gap-1">
                  <button
                    v-for="entry in calendarEntries(day)"
                    :key="entry.session.id"
                    v-tooltip.top="sessionTooltipOptions(entry.timesheet, entry.session)"
                    type="button"
                    class="truncate rounded-md px-2 py-1 text-left text-[11px] font-bold text-white"
                    :style="{ backgroundColor: entry.timesheet.color }"
                    @click="timesheetsStore.selectTimesheet(entry.timesheet.id)"
                  >
                    {{ formatTime(entry.session.startedAt) }} · {{ formatDuration(entry.session.durationSeconds, true) }} · {{ entry.timesheet.title }}
                  </button>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <div class="grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-2">
              <span></span>
              <div
                v-for="day in weekCalendarDays"
                :key="`head-${day.toISOString()}`"
                class="rounded-xl bg-surface-dark/5 px-2 py-2 text-center text-xs font-bold uppercase tracking-wide text-surface-dark/50"
              >
                <span class="block">{{ ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][(day.getDay() + 6) % 7] }}</span>
                <span class="mt-0.5 block text-[11px] font-semibold normal-case tracking-normal">
                  {{ new Intl.DateTimeFormat("fr-BE", { day: "2-digit", month: "short" }).format(day) }}
                </span>
              </div>
            </div>

            <div class="mt-2 grid grid-cols-[44px_repeat(7,minmax(0,1fr))] gap-2">
              <div class="relative h-[720px]">
                <span
                  v-for="hour in weekHourMarks"
                  :key="hour"
                  class="absolute right-1 -translate-y-1/2 text-[10px] font-semibold text-surface-dark/35"
                  :style="{ top: `${(hour / 24) * 100}%` }"
                >
                  {{ String(hour).padStart(2, "0") }}h
                </span>
              </div>

              <div
                v-for="day in weekCalendarDays"
                :key="`body-${day.toISOString()}`"
                class="relative h-[720px] overflow-hidden rounded-2xl border border-surface-dark/8 bg-white"
              >
                <div
                  v-for="hour in weekHourMarks.slice(1, -1)"
                  :key="hour"
                  class="absolute left-0 right-0 border-t border-surface-dark/6"
                  :style="{ top: `${(hour / 24) * 100}%` }"
                ></div>
                <button
                  v-for="entry in weekSessionEntries(day)"
                  :key="entry.session.id"
                  v-tooltip.top="sessionTooltipOptions(entry.timesheet, entry.session)"
                  type="button"
                  class="absolute overflow-hidden rounded-lg px-2 py-1 text-left text-[11px] font-bold leading-tight text-white shadow-sm"
                  :style="{
                    top: entry.top,
                    height: entry.height,
                    left: entry.left,
                    width: entry.width,
                    backgroundColor: entry.timesheet.color,
                  }"
                  @click="timesheetsStore.selectTimesheet(entry.timesheet.id)"
                >
                  <span class="block truncate">{{ entry.timesheet.title }}</span>
                  <span class="block truncate text-[10px] font-semibold text-white/85">
                    {{ new Intl.DateTimeFormat("fr-BE", { hour: "2-digit", minute: "2-digit" }).format(new Date(entry.session.startedAt)) }}
                    · {{ formatDuration(entry.session.durationSeconds, true) }}
                  </span>
                </button>
              </div>
            </div>
          </template>
        </div>
      </section>

      <section v-else class="rounded-3xl border border-surface-dark/5 bg-surface-card p-10 text-center">
        <span class="material-symbols-outlined text-5xl text-primary">timer</span>
        <h2 class="mt-3 text-2xl font-bold text-surface-dark">Aucune timesheet sélectionnée</h2>
        <p class="mt-2 text-sm text-surface-dark/50">Crée un suivi depuis un projet existant.</p>
        <Button class="mt-5" label="Créer une timesheet" @click="openCreateDialog">
          <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
        </Button>
      </section>
    </div>

    <Dialog v-model:visible="createDialogOpen" modal header="Nouvelle timesheet" :style="{ width: 'min(680px, 92vw)' }">
      <div class="grid gap-4">
        <div class="grid gap-1.5">
          <label for="timesheet-project" class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">
            Projet existant
          </label>
          <Select
            id="timesheet-project"
            v-model="form.projectId"
            :options="projectOptions"
            option-value="value"
            option-label="label"
            placeholder="Choisir un projet"
            class="w-full"
          />
        </div>

        <div
          v-if="selectedProject"
          class="rounded-2xl border p-4"
          :class="selectedProjectTimesheet ? 'border-amber-500/20 bg-amber-500/5' : 'border-primary/20 bg-primary/5'"
        >
          <div class="flex items-start gap-3">
            <span
              class="mt-1 h-3 w-3 shrink-0 rounded-full"
              :style="{ backgroundColor: selectedProject.color }"
            ></span>
            <div class="min-w-0 flex-1">
              <p class="font-bold text-surface-dark">{{ selectedProject.title }}</p>
              <p class="mt-1 text-sm text-surface-dark/55">
                {{ selectedProject.clientName || "Sans client" }}
                <template v-if="projectPrimaryQuote(selectedProject.id)"> · {{ projectPrimaryQuote(selectedProject.id)?.quoteRef }}</template>
                · {{ selectedProject.sourceType === "quote" ? "Projet depuis devis" : "Projet hors devis" }}
              </p>
              <p v-if="selectedProjectTimesheet" class="mt-3 text-sm font-semibold text-amber-700">
                Une timesheet existe déjà pour ce projet.
              </p>
            </div>
            <span class="text-sm font-bold text-surface-dark">{{ formatCurrency(selectedProject.budgetExVat) }}</span>
          </div>
        </div>

        <div
          v-else
          class="rounded-2xl border border-dashed border-surface-dark/10 p-4 text-sm text-surface-dark/55"
        >
          Aucun projet actif disponible. Crée d'abord un projet dans la section Projets.
        </div>

        <div class="grid gap-1.5">
          <label for="timesheet-title" class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">
            Nom affiché dans la timesheet
          </label>
          <InputText id="timesheet-title" v-model="form.title" placeholder="Nom affiché" :disabled="!selectedProject" />
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="grid gap-1.5">
            <label for="timesheet-hourly-rate" class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">
              Taux horaire
            </label>
            <InputNumber
              input-id="timesheet-hourly-rate"
              v-model="form.hourlyRate"
              mode="currency"
              currency="EUR"
              locale="fr-BE"
              placeholder="Taux horaire"
              :disabled="!selectedProject"
            />
          </div>
          <div class="grid gap-1.5">
            <label for="timesheet-fixed-price" class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">
              Prix HT du projet
            </label>
            <InputNumber
              input-id="timesheet-fixed-price"
              v-model="form.fixedPriceExVat"
              mode="currency"
              currency="EUR"
              locale="fr-BE"
              placeholder="Prix HT"
              :disabled="!selectedProject"
            />
          </div>
        </div>

        <div class="rounded-2xl border border-surface-dark/8 bg-white p-4">
          <p class="text-xs font-bold uppercase tracking-wide text-surface-dark/40">Couleur calendrier</p>
          <div class="mt-2 flex items-center gap-3">
            <span class="h-9 w-9 rounded-full border border-surface-dark/10" :style="{ backgroundColor: normalizeHexColor(form.color) }"></span>
            <span class="text-sm font-semibold text-surface-dark">{{ normalizeHexColor(form.color) }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Annuler" severity="secondary" outlined @click="createDialogOpen = false" />
        <Button
          label="Créer"
          :disabled="!selectedProject || Boolean(selectedProjectTimesheet)"
          @click="createTimesheet"
        >
          <template #icon><span class="material-symbols-outlined text-lg">check</span></template>
        </Button>
      </template>
    </Dialog>

    <Dialog
      v-model:visible="manualSessionDialogOpen"
      modal
      :header="editingSessionId ? 'Modifier la session' : 'Ajouter une session'"
      :style="{ width: 'min(560px, 92vw)' }"
    >
      <div class="grid gap-4">
        <div class="grid gap-1.5">
          <label for="manual-session-title" class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">
            Titre de session
          </label>
          <InputText
            id="manual-session-title"
            v-model="manualSessionForm.title"
            placeholder="Ex: Ajustements responsive"
          />
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="grid gap-1.5">
            <label for="manual-session-date" class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">
              Date
            </label>
            <input
              id="manual-session-date"
              v-model="manualSessionForm.date"
              type="date"
              class="h-10 rounded-xl border border-surface-dark/15 bg-white px-3 text-sm text-surface-dark outline-none focus:border-primary/45 focus:ring-4 focus:ring-primary/10"
            />
          </div>
          <div class="grid gap-1.5">
            <label for="manual-session-start" class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">
              Heure de début
            </label>
            <input
              id="manual-session-start"
              v-model="manualSessionForm.startTime"
              type="time"
              class="h-10 rounded-xl border border-surface-dark/15 bg-white px-3 text-sm text-surface-dark outline-none focus:border-primary/45 focus:ring-4 focus:ring-primary/10"
            />
          </div>
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="grid gap-1.5">
            <label for="manual-session-hours" class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">
              Heures
            </label>
            <InputNumber
              input-id="manual-session-hours"
              v-model="manualSessionForm.hours"
              :min="0"
              :max="24"
              show-buttons
            />
          </div>
          <div class="grid gap-1.5">
            <label for="manual-session-minutes" class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">
              Minutes
            </label>
            <InputNumber
              input-id="manual-session-minutes"
              v-model="manualSessionForm.minutes"
              :min="0"
              :max="59"
              :step="5"
              show-buttons
            />
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Annuler" severity="secondary" outlined @click="manualSessionDialogOpen = false" />
        <Button
          :label="editingSessionId ? undefined : 'Ajouter la session'"
          :aria-label="editingSessionId ? 'Enregistrer' : undefined"
          :title="editingSessionId ? 'Enregistrer' : undefined"
          @click="saveManualSession"
        >
          <template #icon>
            <span class="material-symbols-outlined text-lg">{{ editingSessionId ? "save" : "add" }}</span>
          </template>
        </Button>
      </template>
    </Dialog>

    <Dialog v-model:visible="editDialogOpen" modal header="Modifier la timesheet" :style="{ width: 'min(620px, 92vw)' }">
      <div class="grid gap-4">
        <div class="grid gap-1.5">
          <label for="edit-timesheet-title" class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">
            Nom du projet
          </label>
          <InputText id="edit-timesheet-title" v-model="editForm.title" placeholder="Nom du projet" />
        </div>

        <div class="grid gap-1.5">
          <label for="edit-timesheet-client" class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">
            Client associé
          </label>
          <Select
            id="edit-timesheet-client"
            v-model="editForm.clientId"
            :options="clientOptions"
            option-value="value"
            option-label="label"
            show-clear
            placeholder="Associer un client (optionnel)"
            class="w-full"
          />
        </div>

        <div class="grid gap-3 sm:grid-cols-2">
          <div class="grid gap-1.5">
            <label for="edit-timesheet-hourly-rate" class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">
              Taux horaire
            </label>
            <InputNumber
              input-id="edit-timesheet-hourly-rate"
              v-model="editForm.hourlyRate"
              mode="currency"
              currency="EUR"
              locale="fr-BE"
            />
          </div>
          <div class="grid gap-1.5">
            <label for="edit-timesheet-fixed-price" class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">
              Prix HT du projet
            </label>
            <InputNumber
              input-id="edit-timesheet-fixed-price"
              v-model="editForm.fixedPriceExVat"
              mode="currency"
              currency="EUR"
              locale="fr-BE"
            />
          </div>
        </div>

        <div class="grid gap-1.5">
          <label for="edit-timesheet-start-date" class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">
            Date de début du projet
          </label>
          <input
            id="edit-timesheet-start-date"
            v-model="editForm.projectStartDate"
            type="date"
            class="h-10 rounded-xl border border-surface-dark/15 bg-white px-3 text-sm text-surface-dark outline-none focus:border-primary/45 focus:ring-4 focus:ring-primary/10"
          />
        </div>

        <div>
          <p class="mb-2 text-xs font-bold uppercase tracking-wide text-surface-dark/40">Couleur calendrier</p>
          <div class="mb-3 flex items-center gap-3">
            <ColorPicker
              v-model="editColorPickerValue"
              format="hex"
              append-to="body"
              :base-z-index="1200"
            />
            <InputText v-model="editForm.color" class="max-w-36" placeholder="#e96a5f" />
            <span
              class="h-9 w-9 rounded-full border border-surface-dark/10"
              :style="{ backgroundColor: normalizeHexColor(editForm.color) }"
            ></span>
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="color in colorPool"
              :key="color"
              type="button"
              class="h-9 w-9 rounded-full border-4"
              :class="normalizeHexColor(editForm.color) === color ? 'border-surface-dark/30' : 'border-white'"
              :style="{ backgroundColor: color }"
              @click="editForm.color = color"
            ></button>
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Annuler" severity="secondary" outlined @click="editDialogOpen = false" />
        <Button aria-label="Enregistrer" title="Enregistrer" @click="saveTimesheetEdits">
          <template #icon><span class="material-symbols-outlined text-lg">save</span></template>
        </Button>
      </template>
    </Dialog>
  </div>
</template>

<style scoped>
.timer-ring {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75), 0 18px 40px rgba(47, 43, 61, 0.12);
}

:global(.timesheet-tooltip) {
  display: grid;
  gap: 3px;
  min-width: 150px;
  max-width: 220px;
  line-height: 1.2;
}

:global(.timesheet-tooltip__project) {
  display: block;
  color: #2f2b3d;
  font-size: 12px;
  font-weight: 800;
}

:global(.timesheet-tooltip__session) {
  display: block;
  color: rgba(47, 43, 61, 0.64);
  font-size: 11px;
  font-weight: 650;
}

:global(.timesheet-tooltip__meta) {
  display: block;
  color: rgba(47, 43, 61, 0.56);
  font-size: 11px;
  font-weight: 700;
}
</style>
