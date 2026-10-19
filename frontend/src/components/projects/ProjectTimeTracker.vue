<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
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
  formatSessionDateTime,
  projectBudgetHours,
  projectTrackedSeconds,
  toDateInputValue,
} from "@/utils/timeTracking";

const props = defineProps<{ project: Project }>();

const projectsStore = useProjectsStore();
const toast = useToast();
const confirm = useConfirm();

const nowTick = ref(Date.now());
let timerInterval: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
  timerInterval = setInterval(() => {
    nowTick.value = Date.now();
  }, 1000);
});
onBeforeUnmount(() => {
  if (timerInterval) clearInterval(timerInterval);
});

const isClosed = computed(() => props.project.status === "closed");
const sessionTitle = ref("");
const manualSessionDialogOpen = ref(false);
const editingSessionId = ref<string | null>(null);
const manualSessionForm = reactive({ title: "", date: "", startTime: "09:00", hours: 1, minutes: 0 });

const sortedSessions = computed(() =>
  [...(props.project.sessions || [])].sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  ),
);

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
const circleStyle = computed(() => ({
  background: `conic-gradient(${progressColor.value} ${Math.min(progressRatio.value, 1) * 360}deg, rgba(47,43,61,0.08) 0deg)`,
}));
const trackedCost = computed(() => totalHours.value * Number(props.project.hourlyRate || 0));
const remainingHours = computed(() => budgetHours.value - totalHours.value);

const showError = (error: unknown) => {
  console.error(error);
  toast.add({ severity: "error", summary: "Chrono indisponible", detail: "L'enregistrement du temps a échoué.", life: 4200 });
};

const toggleTimer = async () => {
  try {
    if (props.project.activeStartedAt) {
      await projectsStore.stopTimer(props.project.id, sessionTitle.value);
      sessionTitle.value = "";
    } else {
      await projectsStore.startTimer(props.project.id);
    }
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
        <div class="timer-ring flex aspect-square w-full max-w-64 items-center justify-center rounded-full p-3" :style="circleStyle">
          <div class="flex h-full w-full flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
            <span class="text-xs font-bold uppercase tracking-wide text-surface-dark/40">Temps total</span>
            <span class="mt-2 font-heading text-3xl font-bold text-surface-dark">{{ formatDuration(totalSeconds) }}</span>
            <span
              class="mt-3 rounded-full px-3 py-1 text-xs font-bold"
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
          </div>
        </div>

        <InputText v-model="sessionTitle" class="mt-5 w-full max-w-xs" placeholder="Titre de cette session (optionnel)" />
        <Button
          class="mt-3 !h-14 !w-full !max-w-xs !justify-center !rounded-2xl !text-base !font-bold"
          :label="isClosed ? 'Projet clôturé' : project.activeStartedAt ? 'Pause' : 'Play'"
          :severity="isClosed ? 'secondary' : project.activeStartedAt ? 'danger' : undefined"
          :disabled="isClosed"
          @click="toggleTimer"
        >
          <template #icon>
            <span class="material-symbols-outlined text-lg">{{ isClosed ? "check" : project.activeStartedAt ? "pause" : "play_arrow" }}</span>
          </template>
        </Button>
      </div>

      <div class="flex min-w-0 flex-col gap-5">
        <div class="grid gap-3 sm:grid-cols-3">
          <div class="rounded-2xl border border-surface-dark/8 bg-white p-3.5">
            <p class="text-xs font-semibold uppercase tracking-wide text-surface-dark/40">Taux horaire</p>
            <p class="mt-1.5 whitespace-nowrap text-lg font-bold text-surface-dark">{{ formatCurrency(project.hourlyRate) }}</p>
          </div>
          <div class="rounded-2xl border border-surface-dark/8 bg-white p-3.5">
            <p class="text-xs font-semibold uppercase tracking-wide text-surface-dark/40">Heures budgétées</p>
            <p class="mt-1.5 whitespace-nowrap text-lg font-bold text-surface-dark">{{ budgetHours.toFixed(1) }} h</p>
          </div>
          <div class="rounded-2xl border border-surface-dark/8 bg-white p-3.5">
            <p class="text-xs font-semibold uppercase tracking-wide text-surface-dark/40">Coût du temps</p>
            <p class="mt-1.5 whitespace-nowrap text-lg font-bold text-surface-dark">{{ formatCurrency(trackedCost) }}</p>
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
          <div v-if="sortedSessions.length" class="flex max-h-80 flex-col gap-2 overflow-y-auto pr-1">
            <div
              v-for="session in sortedSessions"
              :key="session.id"
              class="group flex items-center gap-3 rounded-2xl border border-surface-dark/8 bg-white px-3.5 py-2.5"
            >
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold text-surface-dark">{{ session.title || "Session sans titre" }}</p>
                <p class="text-xs text-surface-dark/50">{{ formatSessionDateTime(session.startedAt) }}</p>
              </div>
              <span class="text-sm font-bold text-surface-dark">{{ formatDuration(session.durationSeconds, true) }}</span>
              <div class="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
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
.timer-ring {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.75), 0 18px 40px rgba(47, 43, 61, 0.12);
}
</style>
