import type { LocationQuery, LocationQueryRaw } from 'vue-router';
import type {
  Client,
  ClientPlatform,
  ClientStage,
  Project,
  Quote,
} from '@client-tracker/contracts';
import { clientStageOptions } from '@/lib/clientPresets';
import { formatClientAddress, formatClientFullName } from '@/utils/address';
import { getCountryLabel } from '@/lib/countries';
import { toDateObj } from '@/utils/date';
import { getQuotePlatformLabel } from '@/utils/quote';
import {
  projectActiveQuotes,
  projectToInvoiceExVat,
  projectToReceiveExVat,
} from '@/utils/projectFinance';

/** Couleur de la relation commerciale, indépendante de l'avancement des missions. */
export const clientStageTagClass: Record<ClientStage, string> = {
  prospect: '!bg-surface-dark/8 !text-surface-dark',
  opportunity: '!bg-violet-500/12 !text-violet-700',
  active: '!bg-blue-500/12 !text-blue-700',
  recurring: '!bg-emerald-500/12 !text-emerald-700',
  paused: '!bg-amber-500/15 !text-amber-700',
  former: '!bg-surface-dark/6 !text-surface-dark/60',
};

export const clientStageLabel = (stage: ClientStage): string =>
  clientStageOptions.find((option) => option.value === stage)?.label || stage;

export const clientDisplayName = (client: Client): string =>
  formatClientFullName(client) || client.companyName || client.name || 'Client sans nom';

/** Chiffre d'affaires réellement signé : uniquement les devis acceptés. */
export const clientSignedRevenue = (client: Client, quotes: Quote[]): number =>
  quotes
    .filter((quote) => quote.clientId === client.id && quote.status === 'accepted')
    .reduce((total, quote) => total + Number(quote.totalWithVat || 0), 0);

export const clientQuotes = (client: Client, quotes: Quote[]): Quote[] =>
  quotes.filter((quote) => quote.clientId === client.id && quote.status !== 'superseded');

export const clientProjects = (client: Client, projects: Project[]): Project[] =>
  projects.filter((project) => project.clientId === client.id);

export const clientActiveProjects = (client: Client, projects: Project[]): Project[] =>
  clientProjects(client, projects).filter(
    (project) => !['paid', 'closed'].includes(project.status),
  );

export type ClientActivityTone = 'danger' | 'warning' | 'info' | 'success' | 'muted';

export interface ClientActivitySignal {
  key: string;
  label: string;
  icon: string;
  tone: ClientActivityTone;
}

export const clientActivityToneClass: Record<ClientActivityTone, string> = {
  danger: 'bg-red-500/10 text-red-700',
  warning: 'bg-amber-500/12 text-amber-700',
  info: 'bg-blue-500/10 text-blue-700',
  success: 'bg-emerald-500/10 text-emerald-700',
  muted: 'bg-surface-dark/6 text-surface-dark/55',
};

const formatActivityMoney = (value: number): string =>
  new Intl.NumberFormat('fr-BE', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value);

/** Signaux opérationnels dérivés : aucun statut projet n'est écrit sur le client. */
export const clientActivitySignals = (
  client: Client,
  quotes: Quote[],
  projects: Project[],
): ClientActivitySignal[] => {
  const relatedQuotes = clientQuotes(client, quotes);
  const relatedProjects = clientProjects(client, projects);
  const activeProjects = clientActiveProjects(client, projects);
  const signals: ClientActivitySignal[] = [];

  const blockedCount = activeProjects.filter(
    (project) => project.status === 'blocked' || project.health === 'blocked',
  ).length;
  if (blockedCount) {
    signals.push({
      key: 'blocked',
      label: `${blockedCount} projet${blockedCount > 1 ? 's' : ''} bloqué${blockedCount > 1 ? 's' : ''}`,
      icon: 'block',
      tone: 'danger',
    });
  }

  const readyToInvoice = relatedProjects
    .filter((project) => project.status === 'ready_to_invoice')
    .reduce(
      (total, project) =>
        total + projectToInvoiceExVat(project, projectActiveQuotes(project, quotes)),
      0,
    );
  if (readyToInvoice > 0) {
    signals.push({
      key: 'invoice',
      label: `${formatActivityMoney(readyToInvoice)} à facturer`,
      icon: 'request_quote',
      tone: 'warning',
    });
  }

  const toReceive = relatedProjects.reduce(
    (total, project) =>
      total + projectToReceiveExVat(project, projectActiveQuotes(project, quotes)),
    0,
  );
  if (toReceive > 0) {
    signals.push({
      key: 'payment',
      label: `${formatActivityMoney(toReceive)} à encaisser`,
      icon: 'payments',
      tone: 'warning',
    });
  }

  const reviewCount = activeProjects.filter((project) => project.status === 'client_review').length;
  if (reviewCount) {
    signals.push({
      key: 'review',
      label: `Validation client attendue${reviewCount > 1 ? ` · ${reviewCount} projets` : ''}`,
      icon: 'rate_review',
      tone: 'info',
    });
  }

  const pendingQuoteCount = relatedQuotes.filter((quote) =>
    ['finalized', 'sent', 'revision_requested'].includes(quote.status),
  ).length;
  if (pendingQuoteCount) {
    signals.push({
      key: 'quotes',
      label: `${pendingQuoteCount} devis en attente`,
      icon: 'schedule_send',
      tone: 'info',
    });
  }

  if (activeProjects.length) {
    signals.push({
      key: 'projects',
      label: `${activeProjects.length} projet${activeProjects.length > 1 ? 's' : ''} actif${activeProjects.length > 1 ? 's' : ''}`,
      icon: 'workspaces',
      tone: 'success',
    });
  }

  if (!signals.length) {
    signals.push({
      key: 'none',
      label: 'Aucune activité en cours',
      icon: 'check_circle',
      tone: 'muted',
    });
  }

  return signals;
};

export type ClientSortField = 'name' | 'stage' | 'quotes' | 'revenue' | 'projects' | 'updatedAt';
export type ClientSortDirection = 'asc' | 'desc';

export interface ClientListState {
  search: string;
  stage: ClientStage | '';
  platform: ClientPlatform | '';
  sortField: ClientSortField;
  sortDirection: ClientSortDirection;
}

const SORT_FIELDS: ClientSortField[] = [
  'name',
  'stage',
  'quotes',
  'revenue',
  'projects',
  'updatedAt',
];

const asString = (value: LocationQuery[string]): string =>
  typeof value === 'string' ? value : '';

export const readClientListQuery = (query: LocationQuery): ClientListState => {
  const stage = asString(query.etape) as ClientStage;
  const sortField = asString(query.tri) as ClientSortField;

  return {
    search: asString(query.q),
    stage: clientStageOptions.some((option) => option.value === stage) ? stage : '',
    platform: (asString(query.plateforme) as ClientPlatform) || '',
    sortField: SORT_FIELDS.includes(sortField) ? sortField : 'updatedAt',
    sortDirection: query.sens === 'asc' ? 'asc' : 'desc',
  };
};

export const writeClientListQuery = (state: ClientListState): LocationQueryRaw => {
  const query: LocationQueryRaw = {};
  if (state.search.trim()) query.q = state.search.trim();
  if (state.stage) query.etape = state.stage;
  if (state.platform) query.plateforme = state.platform;
  if (state.sortField !== 'updatedAt') query.tri = state.sortField;
  if (state.sortDirection !== 'desc') query.sens = state.sortDirection;
  return query;
};

const searchableClientText = (client: Client): string =>
  [
    formatClientFullName(client),
    client.firstName,
    client.lastName,
    client.companyName,
    client.contactEmail,
    client.phone,
    formatClientAddress(client),
    client.website,
    client.country,
    getCountryLabel(client.country),
    client.vatNumber,
    client.notes,
    ...(client.clientNotes || []).map((note) => note.content),
    getQuotePlatformLabel(client.platform),
    clientStageLabel(client.stage),
    client.isVatRegistered ? 'assujetti tva' : 'non assujetti tva',
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

export const filterClients = (clients: Client[], state: ClientListState): Client[] => {
  const search = state.search.trim().toLowerCase();

  return clients.filter((client) => {
    if (state.stage && client.stage !== state.stage) return false;
    if (state.platform && client.platform !== state.platform) return false;
    if (!search) return true;
    return searchableClientText(client).includes(search);
  });
};

export const sortClientList = (
  clients: Client[],
  state: ClientListState,
  helpers: {
    quoteCountOf: (client: Client) => number;
    revenueOf: (client: Client) => number;
    projectCountOf: (client: Client) => number;
  },
): Client[] => {
  const factor = state.sortDirection === 'asc' ? 1 : -1;
  const timestamp = (value: unknown) => toDateObj(value)?.getTime() || 0;

  return [...clients].sort((a, b) => {
    switch (state.sortField) {
      case 'name':
        return factor * clientDisplayName(a).localeCompare(clientDisplayName(b), 'fr');
      case 'stage':
        return factor * clientStageLabel(a.stage).localeCompare(clientStageLabel(b.stage), 'fr');
      case 'quotes':
        return factor * (helpers.quoteCountOf(a) - helpers.quoteCountOf(b));
      case 'revenue':
        return factor * (helpers.revenueOf(a) - helpers.revenueOf(b));
      case 'projects':
        return factor * (helpers.projectCountOf(a) - helpers.projectCountOf(b));
      default:
        return (
          factor *
          (timestamp(a.updatedAt || a.createdAt) - timestamp(b.updatedAt || b.createdAt))
        );
    }
  });
};

/** Liste filtrée puis triée : l'ordre exact affiché dans l'index. */
export const buildClientList = (
  clients: Client[],
  state: ClientListState,
  helpers: {
    quoteCountOf: (client: Client) => number;
    revenueOf: (client: Client) => number;
    projectCountOf: (client: Client) => number;
  },
): Client[] => sortClientList(filterClients(clients, state), state, helpers);
