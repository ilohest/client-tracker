<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import type { Project, ProjectSession } from "@client-tracker/contracts";
import Button from "primevue/button";
import Dialog from "primevue/dialog";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import { useConfirm } from "primevue/useconfirm";
import { useToast } from "primevue/usetoast";
import { useProjectsStore } from "@/stores/projectsStore";
import { formatCurrency } from "@/utils/quote";
import {
  formatDuration,
  formatSessionTime,
  isProjectPaused,
  projectBudgetHours,
  projectOpenSessionSeconds,
  projectTrackedSeconds,
  toDateInputValue,
} from "@/utils/timeTracking";

const props = defineProps<{ project: Project }>();

const projectsStore = useProjectsStore();
const toast = useToast();
const confirm = useConfirm();

const nowTick = ref(Date.now());
let timerInterval: ReturnType<typeof setInterval> | null = null;
const handleSpaceShortcut = (event: KeyboardEvent) => {
  if (event.code !== "Space" || event.repeat || isClosed.value || manualSessionDialogOpen.value) return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const target = event.target as HTMLElement | null;
  if (target?.closest("input, textarea, select, button, a, [contenteditable], [role='dialog']")) return;
  event.preventDefault();
  void toggleTimer();
};
onMounted(() => {
  window.addEventListener("keydown", handleSpaceShortcut);
  timerInterval = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleSpaceShortcut);
  if (timerInterval) clearInterval(timerInterval);
});

const isClosed = computed(() => props.project.status === "closed");
const sessionTitle = ref(props.project.activeSessionTitle || "");
watch(
  () => props.project.activeSessionStartedAt,
  () => {
    sessionTitle.value = props.project.activeSessionTitle || "";
  },
);
const isPaused = computed(() => isProjectPaused(props.project));
const hasOpenSession = computed(() => Boolean(props.project.activeSessionStartedAt));
const openSessionSeconds = computed(() => projectOpenSessionSeconds(props.project, nowTick.value));
const manualSessionDialogOpen = ref(false);
const editingSessionId = ref<string | null>(null);
const manualSessionForm = reactive({ title: "", date: "", startTime: "09:00", hours: 1, minutes: 0 });

const sortedSessions = computed(() =>
  [...(props.project.sessions || [])].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  ),
);

const dayFormatter = new Intl.DateTimeFormat("fr-BE", { weekday: "long", day: "numeric", month: "long" });
const dayLabel = (date: Date) => {
  const key = toDateInputValue(date);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (key === toDateInputValue(today)) return "Aujourd'hui";
  if (key === toDateInputValue(yesterday)) return "Hier";
  const label = dayFormatter.format(date);
  return label.charAt(0).toUpperCase() + label.slice(1);
};
const sessionsByDay = computed(() => {
  const groups: { key: string; label: string; totalSeconds: number; sessions: ProjectSession[] }[] = [];
  for (const session of sortedSessions.value) {
    const date = new Date(session.startedAt);
    const key = toDateInputValue(date);
    let group = groups.find((entry) => entry.key === key);
    if (!group) {
      group = { key, label: dayLabel(date), totalSeconds: 0, sessions: [] };
      groups.push(group);
    }
    group.sessions.push(session);
    group.totalSeconds += Number(session.durationSeconds || 0);
  }
  return groups;
});

const totalSeconds = computed(() => projectTrackedSeconds(props.project, nowTick.value));
const totalHours = computed(() => totalSeconds.value / 3600);
const budgetHours = computed(() => projectBudgetHours(props.project));
const progressRatio = computed(() => (budgetHours.value > 0 ? totalHours.value / budgetHours.value : 0));
const progressState = computed(() => {
  if (!budgetHours.value) return "neutral";
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
const RING_CIRCUMFERENCE = 2 * Math.PI * 45;
const ringOffset = computed(() => RING_CIRCUMFERENCE * (1 - Math.min(progressRatio.value, 1)));
const trackedCost = computed(() => totalHours.value * Number(props.project.hourlyRate || 0));
const remainingHours = computed(() => budgetHours.value - totalHours.value);

const showError = (error: unknown) => {
  console.error(error);
  toast.add({ severity: "error", summary: "Chrono indisponible", detail: "L'enregistrement du temps a échoué.", life: 4200 });
};

const toggleTimer = async () => {
  try {
    if (props.project.activeStartedAt) {
      await projectsStore.pauseTimer(props.project.id, sessionTitle.value);
    } else {
      await projectsStore.startTimer(props.project.id);
    }
  } catch (error) {
    showError(error);
  }
};

const finishSession = async () => {
  try {
    await projectsStore.stopTimer(props.project.id, sessionTitle.value);
    sessionTitle.value = "";
  } catch (error) {
    showError(error);
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

const openEditSessionDialog = (session: ProjectSession) => {
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
  const session: ProjectSession = {
    id: editingSessionId.value || crypto.randomUUID(),
    title: manualSessionForm.title.trim(),
    startedAt: startedAt.toISOString(),
    endedAt: new Date(startedAt.getTime() + durationSeconds * 1000).toISOString(),
    durationSeconds,
  };
  const existing = props.project.sessions || [];
  const wasEditing = Boolean(editingSessionId.value);
  const sessions = wasEditing
    ? existing.map((item) => (item.id === session.id ? session : item))
    : [session, ...existing];

  try {
    await projectsStore.setSessions(props.project.id, sessions);
    manualSessionDialogOpen.value = false;
    editingSessionId.value = null;
    toast.add({
      severity: "success",
      summary: wasEditing ? "Session modifiée" : "Session ajoutée",
      detail: "Le total du projet a été mis à jour.",
      life: 2400,
    });
  } catch (error) {
    showError(error);
  }
};

const deleteSession = (session: ProjectSession) => {
  confirm.require({
    message: `Supprimer cette session de ${formatDuration(session.durationSeconds, true)} ?`,
    header: "Supprimer la session",
    icon: "pi pi-exclamation-triangle",
    rejectProps: { label: "Annuler", severity: "secondary", outlined: true },
    acceptProps: { label: "Supprimer", severity: "danger" },
    accept: async () => {
      try {
        await projectsStore.setSessions(
          props.project.id,
          (props.project.sessions || []).filter((item) => item.id !== session.id),
        );
        toast.add({ severity: "secondary", summary: "Session supprimée", detail: "Le total du projet a été recalculé.", life: 2400 });
      } catch (error) {
        showError(error);
      }
    },
  });
};
</script>

<template>
  <section class="rounded-3xl border border-surface-dark/5 bg-surface-card p-6">
    <h3 class="mb-5 flex items-center gap-2 font-heading text-lg font-bold text-surface-dark">
      <span class="material-symbols-outlined text-primary">timer</span>
      Temps
    </h3>

    <div class="grid gap-8 xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
      <div class="flex min-w-0 flex-col items-center">
        <div class="relative aspect-square w-full max-w-64">
          <svg viewBox="0 0 100 100" class="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r="45" fill="none" stroke-width="4.5" stroke="rgba(47,43,61,0.07)" />
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke-width="4.5"
              stroke-linecap="round"
              :stroke="progressColor"
              :stroke-dasharray="RING_CIRCUMFERENCE"
              :stroke-dashoffset="ringOffset"
              class="transition-[stroke-dashoffset] duration-700 ease-out"
            />
          </svg>
          <div class="absolute inset-3.5 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-[inset_0_2px_10px_rgba(47,43,61,0.06)]">
            <span class="text-[11px] font-bold uppercase tracking-[0.14em] text-surface-dark/40">Temps total</span>
            <span class="mt-1 font-heading text-3xl font-bold tabular-nums text-surface-dark">{{ formatDuration(totalSeconds) }}</span>
            <button
              type="button"
              class="timer-toggle mt-3 flex h-20 w-20 items-center justify-center rounded-full text-white transition duration-200 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
              :class="project.activeStartedAt ? 'timer-toggle--running' : 'timer-toggle--idle'"
              :disabled="isClosed"
              :title="isClosed ? 'Projet clôturé' : project.activeStartedAt ? 'Mettre en pause (Espace)' : isPaused ? 'Reprendre (Espace)' : 'Démarrer (Espace)'"
              :aria-label="project.activeStartedAt ? 'Mettre en pause' : isPaused ? 'Reprendre le chrono' : 'Démarrer le chrono'"
              @click="toggleTimer"
            >
              <span class="material-symbols-outlined !text-5xl" style="font-variation-settings: 'FILL' 1">
                {{ isClosed ? "check" : project.activeStartedAt ? "pause" : "play_arrow" }}
              </span>
            </button>
          </div>
        </div>

        <span
          class="mt-4 rounded-full px-3 py-1 text-xs font-bold"
          :class="{
            'bg-emerald-500/10 text-emerald-600': progressState === 'ok',
            'bg-amber-500/10 text-amber-600': progressState === 'warning',
            'bg-red-500/10 text-red-600': progressState === 'danger',
            'bg-surface-dark/5 text-surface-dark/50': progressState === 'neutral',
          }"
        >
          <template v-if="budgetHours">{{ Math.round(progressRatio * 100) }}% du budget temps</template>
          <template v-else>Budget temps à définir</template>
        </span>

        <p v-if="hasOpenSession" class="mt-5 text-xs font-bold uppercase tracking-wide text-surface-dark/45">
          Session {{ isPaused ? "en pause" : "en cours" }} · <span class="font-mono">{{ formatDuration(openSessionSeconds) }}</span>
        </p>
        <InputText v-model="sessionTitle" class="mt-3 w-full max-w-xs" placeholder="Titre de cette session (optionnel)" />
        <Button
          v-if="hasOpenSession && !isClosed"
          class="mt-3 !h-12 !w-full !max-w-xs !justify-center !rounded-2xl !font-bold"
          label="Terminer la session"
          severity="danger"
          outlined
          @click="finishSession"
        >
          <template #icon><span class="material-symbols-outlined text-lg">stop_circle</span></template>
        </Button>
      </div>

      <div class="flex min-w-0 flex-col gap-5">
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl border border-surface-dark/8 bg-white p-3.5">
            <p class="text-xs font-semibold uppercase tracking-wide text-surface-dark/40">Taux horaire</p>
            <p class="mt-1.5 whitespace-nowrap text-lg font-bold text-surface-dark">{{ project.hourlyRate ? formatCurrency(project.hourlyRate) : '—' }}</p>
          </div>
          <div class="rounded-2xl border border-surface-dark/8 bg-white p-3.5">
            <p class="text-xs font-semibold uppercase tracking-wide text-surface-dark/40">Heures budgétées</p>
            <p class="mt-1.5 whitespace-nowrap text-lg font-bold text-surface-dark">{{ budgetHours ? `${budgetHours.toFixed(1)} h` : '—' }}</p>
          </div>
          <div class="rounded-2xl border border-surface-dark/8 bg-white p-3.5">
            <p class="text-xs font-semibold uppercase tracking-wide text-surface-dark/40">Coût du temps</p>
            <p class="mt-1.5 whitespace-nowrap text-lg font-bold text-surface-dark">{{ project.hourlyRate ? formatCurrency(trackedCost) : '—' }}</p>
          </div>
        </div>

        <div v-if="budgetHours" class="rounded-2xl border border-surface-dark/8 bg-white p-3.5">
          <div class="mb-2 flex items-center justify-between text-sm">
            <span class="font-semibold text-surface-dark">Marge temps</span>
            <span :style="{ color: progressColor }" class="font-bold">
              {{ remainingHours >= 0 ? "+" : "" }}{{ remainingHours.toFixed(1) }}h
            </span>
          </div>
          <div class="h-2 overflow-hidden rounded-full bg-surface-dark/6">
            <div class="h-full rounded-full" :style="{ width: `${Math.min(progressRatio * 100, 100)}%`, backgroundColor: progressColor }"></div>
          </div>
        </div>

        <div>
          <div class="mb-3 flex items-center justify-between gap-3">
            <h4 class="text-sm font-bold uppercase tracking-wide text-surface-dark/45">Sessions</h4>
            <Button v-if="!isClosed" label="Ajouter" severity="secondary" outlined size="small" @click="openManualSessionDialog">
              <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
            </Button>
          </div>
          <div v-if="sortedSessions.length || hasOpenSession" class="flex max-h-[26rem] flex-col gap-4 overflow-y-auto pr-1">
            <div
              v-if="hasOpenSession"
              class="flex items-center gap-3 rounded-2xl border border-primary/25 bg-primary/5 px-3.5 py-2.5"
            >
              <span
                class="h-2.5 w-2.5 shrink-0 rounded-full"
                :class="isPaused ? 'bg-amber-400' : 'animate-pulse bg-emerald-500'"
              ></span>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-surface-dark">{{ sessionTitle || "Session en cours" }}</p>
                <p class="text-xs text-surface-dark/50">{{ isPaused ? "En pause" : "En cours" }} · depuis {{ formatSessionTime(project.activeSessionStartedAt) }}</p>
              </div>
              <span class="font-mono text-sm font-bold tabular-nums text-surface-dark">{{ formatDuration(openSessionSeconds) }}</span>
            </div>

            <section v-for="group in sessionsByDay" :key="group.key" class="flex flex-col gap-1.5">
              <div class="flex items-baseline justify-between px-1">
                <h5 class="text-xs font-bold uppercase tracking-wide text-surface-dark/40">{{ group.label }}</h5>
                <span class="text-xs font-semibold text-surface-dark/40">{{ formatDuration(group.totalSeconds, true) }}</span>
              </div>
              <div
                v-for="session in group.sessions"
                :key="session.id"
                class="group flex items-center gap-3 rounded-2xl border border-surface-dark/8 bg-white px-3.5 py-2.5 transition hover:border-surface-dark/15 hover:shadow-sm"
              >
                <div class="min-w-0 flex-1">
                  <p class="line-clamp-2 break-words text-sm font-semibold leading-snug" :class="session.title ? 'text-surface-dark' : 'text-surface-dark/45'">
                    {{ session.title || "Session sans titre" }}
                  </p>
                  <p class="text-xs text-surface-dark/50">à {{ formatSessionTime(session.startedAt) }}</p>
                </div>
                <div class="relative shrink-0">
                  <span class="block text-sm font-bold tabular-nums text-surface-dark transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
                    {{ formatDuration(session.durationSeconds, true) }}
                  </span>
                  <div class="absolute inset-y-0 right-0 flex items-center bg-white opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-lg text-surface-dark/45 hover:bg-surface-dark/5 hover:text-surface-dark"
                    title="Modifier la session"
                    @click="openEditSessionDialog(session)"
                  >
                    <span class="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    type="button"
                    class="flex h-8 w-8 items-center justify-center rounded-lg text-red-500/75 hover:bg-red-500/10 hover:text-red-600"
                    title="Supprimer la session"
                    @click="deleteSession(session)"
                  >
                    <span class="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
          <p v-else class="rounded-2xl border border-dashed border-surface-dark/12 p-6 text-center text-sm text-surface-dark/50">
            Lance le chrono pour enregistrer ta première session.
          </p>
        </div>
      </div>
    </div>

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

  </section>
</template>

<style scoped>
.timer-toggle--idle {
  background: linear-gradient(135deg, var(--p-primary-400, #8b7cf6), var(--p-primary-600, #6d5ae6));
  box-shadow: 0 10px 24px -6px color-mix(in srgb, var(--p-primary-600, #6d5ae6) 65%, transparent);
}
.timer-toggle--running {
  background: linear-gradient(135deg, #34d399, #059669);
  box-shadow: 0 10px 24px -6px rgba(5, 150, 105, 0.6);
  animation: timer-pulse 2s ease-in-out infinite;
}
@keyframes timer-pulse {
  0%, 100% { box-shadow: 0 10px 24px -6px rgba(5, 150, 105, 0.6), 0 0 0 0 rgba(16, 185, 129, 0.35); }
  50% { box-shadow: 0 10px 24px -6px rgba(5, 150, 105, 0.6), 0 0 0 12px rgba(16, 185, 129, 0); }
}
</style>
