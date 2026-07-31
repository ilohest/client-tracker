import type { LocationQuery, LocationQueryRaw } from 'vue-router';
import type { Quote, QuoteStatus } from '@client-tracker/contracts';
import { quoteStatusMeta, quoteStatusOptions } from '@/lib/clientPresets';
import { toDateObj } from '@/utils/date';
import { getQuotePlatformLabel } from '@/utils/quote';

export type QuoteSortField = 'client' | 'status' | 'total' | 'quoteDate' | 'updatedAt';
export type QuoteSortDirection = 'asc' | 'desc';

export interface QuoteVersionGroup {
  /** Identifiant stable partagé par toutes les versions du devis. */
  id: string;
  /** Version affichée dans la ligne principale (numéro de version le plus élevé). */
  latest: Quote;
  /** Historique complet, de la version la plus récente à la plus ancienne. */
  versions: Quote[];
}

/**
 * État de la liste de devis. Il vit dans l'URL : le retour depuis le détail
 * restaure filtres et tri, la page détail navigue dans le même ordre filtré,
 * et une vue filtrée reste partageable et rechargeable.
 */
export interface QuoteListState {
  search: string;
  status: QuoteStatus | '';
  clientId: string;
  dateRange: Date[] | null;
  sortField: QuoteSortField;
  sortDirection: QuoteSortDirection;
}

const SORT_FIELDS: QuoteSortField[] = ['client', 'status', 'total', 'quoteDate', 'updatedAt'];

export const toIsoDay = (date: Date): string =>
  `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;

const parseIsoDay = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};

const asString = (value: LocationQuery[string]): string =>
  typeof value === 'string' ? value : '';

export const createQuoteListState = (): QuoteListState => ({
  search: '',
  status: '',
  clientId: '',
  dateRange: null,
  sortField: 'updatedAt',
  sortDirection: 'desc',
});

export const readQuoteListQuery = (query: LocationQuery): QuoteListState => {
  const status = asString(query.statut);
  const start = parseIsoDay(asString(query.du));
  const end = parseIsoDay(asString(query.au));
  const sortField = asString(query.tri) as QuoteSortField;

  return {
    search: asString(query.q),
    status: quoteStatusOptions.some((option) => option.value === status)
      ? (status as QuoteStatus)
      : '',
    clientId: asString(query.client),
    dateRange: start ? (end ? [start, end] : [start]) : null,
    sortField: SORT_FIELDS.includes(sortField) ? sortField : 'updatedAt',
    sortDirection: query.sens === 'asc' ? 'asc' : 'desc',
  };
};

export const writeQuoteListQuery = (state: QuoteListState): LocationQueryRaw => {
  const query: LocationQueryRaw = {};
  if (state.search.trim()) query.q = state.search.trim();
  if (state.status) query.statut = state.status;
  if (state.clientId) query.client = state.clientId;

  const [start, end] = state.dateRange || [];
  if (start) query.du = toIsoDay(start);
  if (end) query.au = toIsoDay(end);

  if (state.sortField !== 'updatedAt') query.tri = state.sortField;
  if (state.sortDirection !== 'desc') query.sens = state.sortDirection;
  return query;
};

export const filterQuotes = (quotes: Quote[], state: QuoteListState): Quote[] => {
  const search = state.search.trim().toLowerCase();
  const [filterStart, filterEnd] = state.dateRange || [];
  const startDate = filterStart ? toIsoDay(filterStart) : '';
  const endDate = filterEnd ? toIsoDay(filterEnd) : startDate;

  return quotes.filter((quote) => {
    if (state.clientId && quote.clientId !== state.clientId) return false;
    if (state.status && quote.status !== state.status) return false;
    if (startDate && (!quote.quoteDate || quote.quoteDate < startDate || quote.quoteDate > endDate)) {
      return false;
    }
    if (!search) return true;

    return [
      quote.title,
      quote.quoteRef,
      quote.clientName,
      quote.projectName,
      getQuotePlatformLabel(quote.platform, quote.customPlatformLabel),
      quote.projectSummary,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(search);
  });
};

export const sortQuoteList = (quotes: Quote[], state: QuoteListState): Quote[] => {
  const factor = state.sortDirection === 'asc' ? 1 : -1;
  const timestamp = (value: unknown) => toDateObj(value)?.getTime() || 0;

  return [...quotes].sort((a, b) => {
    switch (state.sortField) {
      case 'client':
        return factor * a.clientName.localeCompare(b.clientName, 'fr');
      case 'status':
        return (
          factor *
          quoteStatusMeta[a.status].label.localeCompare(quoteStatusMeta[b.status].label, 'fr')
        );
      case 'total':
        return factor * (a.totalWithVat - b.totalWithVat);
      case 'quoteDate':
        return factor * (a.quoteDate || '').localeCompare(b.quoteDate || '');
      default:
        return (
          factor *
          (timestamp(a.updatedAt || a.createdAt) - timestamp(b.updatedAt || b.createdAt))
        );
    }
  });
};

const quoteTimestamp = (quote: Quote): number =>
  toDateObj(quote.updatedAt || quote.createdAt)?.getTime() || 0;

const compareQuoteVersions = (a: Quote, b: Quote): number => {
  const versionDifference = Number(b.version || 1) - Number(a.version || 1);
  return versionDifference || quoteTimestamp(b) - quoteTimestamp(a);
};

/**
 * Regroupe les révisions d'un même devis. Le numéro de version prime sur la
 * date de modification : lorsqu'une v2 est créée, la v1 est marquée remplacée
 * juste après et peut donc avoir une date de modification artificiellement
 * plus récente.
 */
export const groupQuoteVersions = (quotes: Quote[]): QuoteVersionGroup[] => {
  const groups = new Map<string, Quote[]>();

  quotes.forEach((quote) => {
    const groupId = quote.versionGroupId || quote.id;
    groups.set(groupId, [...(groups.get(groupId) || []), quote]);
  });

  return [...groups.entries()].map(([id, entries]) => {
    const versions = [...entries].sort(compareQuoteVersions);
    return { id, latest: versions[0], versions };
  });
};

/** Une ligne par devis, avec la version la plus récente comme représentante. */
export const buildQuoteGroups = (
  quotes: Quote[],
  state: QuoteListState,
): QuoteVersionGroup[] => {
  const groups = groupQuoteVersions(quotes);
  const visibleLatestVersions = sortQuoteList(
    filterQuotes(
      groups.map((group) => group.latest),
      state,
    ),
    state,
  );
  const groupByLatestId = new Map(groups.map((group) => [group.latest.id, group]));
  return visibleLatestVersions
    .map((quote) => groupByLatestId.get(quote.id))
    .filter((group): group is QuoteVersionGroup => Boolean(group));
};

/**
 * Représentants filtrés puis triés : la navigation précédent/suivant suit les
 * lignes de l'index, et non les versions historiques masquées.
 */
export const buildQuoteList = (quotes: Quote[], state: QuoteListState): Quote[] =>
  buildQuoteGroups(quotes, state).map((group) => group.latest);
