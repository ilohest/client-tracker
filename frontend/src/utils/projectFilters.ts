import type { LocationQuery, LocationQueryRaw } from 'vue-router';
import type { Project, ProjectStatus, Quote } from '@client-tracker/contracts';
import { toDateObj } from '@/utils/date';

/**
 * Statut « macro » : les dix statuts du schéma se lisent mal en liste. On les
 * regroupe en quatre états qui répondent à la seule question utile devant le
 * tableau — qu'est-ce qui avance, qu'est-ce qui attend, qu'est-ce qui est à
 * facturer, qu'est-ce qui est fini.
 */
export type ProjectMacroStatus = 'active' | 'waiting' | 'ready' | 'closed';

export interface ProjectMacroStatusMeta {
  label: string;
  tagClass: string;
  icon: string;
}

export const projectMacroStatusMeta: Record<ProjectMacroStatus, ProjectMacroStatusMeta> = {
  active: { label: 'Actif', tagClass: '!bg-blue-500/12 !text-blue-700', icon: 'play_circle' },
  waiting: { label: 'En attente', tagClass: '!bg-amber-500/15 !text-amber-700', icon: 'pause_circle' },
  ready: { label: 'À facturer', tagClass: '!bg-emerald-500/12 !text-emerald-700', icon: 'request_quote' },
  closed: { label: 'Clos', tagClass: '!bg-surface-dark/8 !text-surface-dark', icon: 'archive' },
};

export const projectMacroStatusOptions: Array<{ label: string; value: ProjectMacroStatus }> = (
  Object.keys(projectMacroStatusMeta) as ProjectMacroStatus[]
).map((value) => ({ label: projectMacroStatusMeta[value].label, value }));

export const projectMacroStatus = (project: Project): ProjectMacroStatus => {
  if (['paid', 'closed'].includes(project.status)) return 'closed';
  if (project.status === 'ready_to_invoice') return 'ready';
  if (
    project.status === 'invoiced' ||
    project.status === 'blocked' ||
    project.health === 'blocked' ||
    ['deposit_pending', 'client_review'].includes(project.status)
  ) {
    return 'waiting';
  }
  return 'active';
};

/** Statut concret écrit en base quand on change le statut macro depuis l'UI. */
export const projectStatusForMacro = (macro: ProjectMacroStatus): ProjectStatus => {
  if (macro === 'waiting') return 'blocked';
  if (macro === 'ready') return 'ready_to_invoice';
  if (macro === 'closed') return 'closed';
  return 'in_progress';
};

/** Part de jalons terminés, en pourcentage entier. */
export const projectProgress = (project: Project): number => {
  const milestones = (project.milestones || []).filter(
    (milestone) => !['invoice_sent', 'payment_received'].includes(milestone.kind || ''),
  );
  if (!milestones.length) return 0;
  const done = milestones.filter((milestone) => milestone.status === 'done').length;
  return Math.round((done / milestones.length) * 100);
};

export const projectDoneMilestones = (project: Project): number =>
  (project.milestones || []).filter((milestone) => milestone.status === 'done').length;

/** Une échéance dépassée sur un projet non clos est le signal à traiter en premier. */
export const isProjectOverdue = (project: Project): boolean => {
  if (!project.dueDate) return false;
  if (projectMacroStatus(project) === 'closed') return false;
  return project.dueDate < new Date().toISOString().slice(0, 10);
};

export type ProjectSortField = 'title' | 'status' | 'progress' | 'budget' | 'dueDate' | 'updatedAt';
export type ProjectSortDirection = 'asc' | 'desc';

export interface ProjectListState {
  search: string;
  status: ProjectMacroStatus | '';
  clientId: string;
  dateRange: Date[] | null;
  sortField: ProjectSortField;
  sortDirection: ProjectSortDirection;
}

const SORT_FIELDS: ProjectSortField[] = [
  'title',
  'status',
  'progress',
  'budget',
  'dueDate',
  'updatedAt',
];

export const toIsoDay = (date: Date): string =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;

const parseIsoDay = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const asString = (value: LocationQuery[string]): string =>
  typeof value === 'string' ? value : '';

export const readProjectListQuery = (query: LocationQuery): ProjectListState => {
  const status = asString(query.statut) as ProjectMacroStatus;
  const start = parseIsoDay(asString(query.du));
  const end = parseIsoDay(asString(query.au));
  const sortField = asString(query.tri) as ProjectSortField;

  return {
    search: asString(query.q),
    status: projectMacroStatusOptions.some((option) => option.value === status) ? status : '',
    clientId: asString(query.client),
    dateRange: start ? (end ? [start, end] : [start]) : null,
    sortField: SORT_FIELDS.includes(sortField) ? sortField : 'dueDate',
    sortDirection: query.sens === 'desc' ? 'desc' : 'asc',
  };
};

export const writeProjectListQuery = (state: ProjectListState): LocationQueryRaw => {
  const query: LocationQueryRaw = {};
  if (state.search.trim()) query.q = state.search.trim();
  if (state.status) query.statut = state.status;
  if (state.clientId) query.client = state.clientId;

  const [start, end] = state.dateRange || [];
  if (start) query.du = toIsoDay(start);
  if (end) query.au = toIsoDay(end);

  if (state.sortField !== 'dueDate') query.tri = state.sortField;
  if (state.sortDirection !== 'asc') query.sens = state.sortDirection;
  return query;
};

export const filterProjects = (
  projects: Project[],
  state: ProjectListState,
  quotesByProject: (project: Project) => Quote[],
): Project[] => {
  const search = state.search.trim().toLowerCase();
  const [filterStart, filterEnd] = state.dateRange || [];
  const startFilter = filterStart ? toIsoDay(filterStart) : '';
  const endFilter = filterEnd ? toIsoDay(filterEnd) : startFilter;

  return projects.filter((project) => {
    if (state.status && projectMacroStatus(project) !== state.status) return false;
    if (state.clientId && project.clientId !== state.clientId) return false;
    if (startFilter) {
      const startedAt = project.startedAt || '';
      if (!startedAt || startedAt < startFilter || startedAt > endFilter) return false;
    }
    if (!search) return true;

    return [
      project.title,
      project.clientName,
      project.description,
      project.nextAction,
      ...quotesByProject(project).map((quote) => quote.quoteRef),
      projectMacroStatusMeta[projectMacroStatus(project)].label,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(search);
  });
};

export const sortProjectList = (
  projects: Project[],
  state: ProjectListState,
  budgetOf: (project: Project) => number,
): Project[] => {
  const factor = state.sortDirection === 'asc' ? 1 : -1;
  const timestamp = (value: unknown) => toDateObj(value)?.getTime() || 0;

  return [...projects].sort((a, b) => {
    switch (state.sortField) {
      case 'title':
        return factor * a.title.localeCompare(b.title, 'fr');
      case 'status':
        return (
          factor *
          projectMacroStatusMeta[projectMacroStatus(a)].label.localeCompare(
            projectMacroStatusMeta[projectMacroStatus(b)].label,
            'fr',
          )
        );
      case 'progress':
        return factor * (projectProgress(a) - projectProgress(b));
      case 'budget':
        return factor * (budgetOf(a) - budgetOf(b));
      case 'updatedAt':
        return (
          factor *
          (timestamp(a.updatedAt || a.createdAt) - timestamp(b.updatedAt || b.createdAt))
        );
      default: {
        // Les projets sans échéance ne doivent jamais passer devant ceux qui en
        // ont une, quel que soit le sens de tri.
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return factor * a.dueDate.localeCompare(b.dueDate);
      }
    }
  });
};

/** Liste filtrée puis triée : l'ordre exact affiché dans l'index. */
export const buildProjectList = (
  projects: Project[],
  state: ProjectListState,
  helpers: {
    quotesByProject: (project: Project) => Quote[];
    budgetOf: (project: Project) => number;
  },
): Project[] =>
  sortProjectList(
    filterProjects(projects, state, helpers.quotesByProject),
    state,
    helpers.budgetOf,
  );
