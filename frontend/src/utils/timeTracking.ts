import type { Project } from '@client-tracker/contracts';

type TrackedProject = Pick<Project, 'totalTrackedSeconds' | 'activeStartedAt' | 'hourlyRate' | 'budgetExVat'>;

/** Temps total d'un projet, session en cours comprise. */
export const projectTrackedSeconds = (project: TrackedProject | null, now = Date.now()): number => {
  if (!project) return 0;
  const running = project.activeStartedAt
    ? Math.max(0, Math.round((now - new Date(project.activeStartedAt).getTime()) / 1000))
    : 0;
  return Number(project.totalTrackedSeconds || 0) + running;
};

/** Heures « théoriques » : budget HT / taux horaire (0 si l'un des deux manque). */
export const projectBudgetHours = (project: TrackedProject | null): number => {
  const rate = Number(project?.hourlyRate || 0);
  const budget = Number(project?.budgetExVat || 0);
  return rate > 0 && budget > 0 ? budget / rate : 0;
};

export const formatDuration = (seconds: number, compact = false): string => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  if (compact) return `${hours}h ${String(minutes).padStart(2, '0')}`;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
};

export const formatSessionDateTime = (value: string): string =>
  new Intl.DateTimeFormat('fr-BE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  );

export const formatSessionTime = (value: string): string =>
  new Intl.DateTimeFormat('fr-BE', { hour: '2-digit', minute: '2-digit' }).format(new Date(value));

export const toDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};
