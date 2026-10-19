<script setup lang="ts">
import { computed, ref } from "vue";
import type { Project, ProjectSession } from "@client-tracker/contracts";
import Button from "primevue/button";
import type { TooltipOptions } from "primevue/tooltip";
import { formatDuration, formatSessionTime } from "@/utils/timeTracking";

const props = defineProps<{ projects: Project[] }>();
const emit = defineEmits<{ select: [projectId: string] }>();

const visibleProjects = computed(() => props.projects);
const calendarCursor = ref(new Date());
const calendarView = ref<"month" | "week">("month");

const normalizeHexColor = (value: unknown, fallback = "#e96a5f") => {
  const raw = String(value || "").replace("#", "").trim();
  return raw.length === 6 ? `#${raw}` : fallback;
};

const escapeTooltipHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
const sessionTooltipOptions = (project: Project, session: ProjectSession): TooltipOptions => {
  const color = normalizeHexColor(project.color);
  const startedAt = new Date(session.startedAt);
  const endedAt = new Date(startedAt.getTime() + Number(session.durationSeconds || 0) * 1000);
  const sessionTitle = session.title?.trim();
  const titleLine = sessionTitle
    ? `<span class="session-tooltip__session">${escapeTooltipHtml(sessionTitle)}</span>`
    : "";

  return {
    escape: false,
    fitContent: true,
    showDelay: 120,
    value: `
      <span class="session-tooltip__project">${escapeTooltipHtml(project.title)}</span>
      ${titleLine}
      <span class="session-tooltip__meta">${formatSessionTime(session.startedAt)} - ${formatSessionTime(endedAt.toISOString())} · ${formatDuration(session.durationSeconds, true)}</span>
    `,
    pt: {
      arrow: { style: { display: "none" } },
      text: {
        class: "session-tooltip",
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
  const grouped = new Map<string, Array<{ project: Project; session: ProjectSession }>>();
  for (const project of visibleProjects.value) {
    for (const session of project.sessions || []) {
      const key = sessionDayKey(session.startedAt);
      const entries = grouped.get(key) || [];
      entries.push({ project, session });
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
    project: Project;
    session: ProjectSession;
    startMinute: number;
    endMinute: number;
    top: string;
    height: string;
    left: string;
    width: string;
  }> = [];

  for (const project of visibleProjects.value) {
    for (const session of project.sessions || []) {
      const startedAt = new Date(session.startedAt);
      if (sessionDayKey(session.startedAt) !== key) continue;

      const minutesFromStart = startedAt.getHours() * 60 + startedAt.getMinutes();
      const visibleDurationMinutes = Math.max(15, Number(session.durationSeconds || 0) / 60);
      const cappedDuration = Math.min(visibleDurationMinutes, 1440 - minutesFromStart);
      const endMinute = Math.min(minutesFromStart + cappedDuration, 1440);

      entries.push({
        project,
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
  <div>
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
              v-tooltip.top="sessionTooltipOptions(entry.project, entry.session)"
              type="button"
              class="truncate rounded-md px-2 py-1 text-left text-[11px] font-bold text-white"
              :style="{ backgroundColor: entry.project.color }"
              @click="emit('select', entry.project.id)"
            >
              {{ formatSessionTime(entry.session.startedAt) }} · {{ formatDuration(entry.session.durationSeconds, true) }} · {{ entry.project.title }}
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
            v-tooltip.top="sessionTooltipOptions(entry.project, entry.session)"
            type="button"
            class="absolute overflow-hidden rounded-lg px-2 py-1 text-left text-[11px] font-bold leading-tight text-white shadow-sm"
            :style="{
              top: entry.top,
              height: entry.height,
              left: entry.left,
              width: entry.width,
              backgroundColor: entry.project.color,
            }"
            @click="emit('select', entry.project.id)"
          >
            <span class="block truncate">{{ entry.project.title }}</span>
            <span class="block truncate text-[10px] font-semibold text-white/85">
              {{ new Intl.DateTimeFormat("fr-BE", { hour: "2-digit", minute: "2-digit" }).format(new Date(entry.session.startedAt)) }}
              · {{ formatDuration(entry.session.durationSeconds, true) }}
            </span>
          </button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
:global(.session-tooltip) {
  display: grid;
  gap: 3px;
  min-width: 150px;
  max-width: 220px;
  line-height: 1.2;
}

:global(.session-tooltip__project) {
  display: block;
  color: #2f2b3d;
  font-size: 12px;
  font-weight: 800;
}

:global(.session-tooltip__session) {
  display: block;
  color: rgba(47, 43, 61, 0.64);
  font-size: 11px;
  font-weight: 650;
}

:global(.session-tooltip__meta) {
  display: block;
  color: rgba(47, 43, 61, 0.56);
  font-size: 11px;
  font-weight: 700;
}
</style>
