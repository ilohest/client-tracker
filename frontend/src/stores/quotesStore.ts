import { defineStore } from 'pinia';
import type { Quote, QuoteInput } from '@client-tracker/contracts';
import { quotesService } from '@/services/quotesService';
import { toDateObj } from '@/utils/date';

interface QuotesState {
  quotes: Quote[];
  selectedQuoteId: string | null;
  loading: boolean;
  error: string | null;
}

type PersistedQuotePayload = QuoteInput & Pick<Quote, 'subtotal' | 'totalWithVat'>;

const sortQuotes = (quotes: Quote[]): Quote[] =>
  [...quotes].sort((a, b) => {
    const dateA = toDateObj(a.updatedAt || a.createdAt)?.getTime() || 0;
    const dateB = toDateObj(b.updatedAt || b.createdAt)?.getTime() || 0;
    return dateB - dateA;
  });

export const useQuotesStore = defineStore('quotes', {
  state: (): QuotesState => ({
    quotes: [],
    selectedQuoteId: null,
    loading: false,
    error: null,
  }),

  getters: {
    selectedQuote(state): Quote | null {
      return state.quotes.find((quote) => quote.id === state.selectedQuoteId) || null;
    },
  },

  actions: {
    async fetchQuotes() {
      this.loading = true;
      this.error = null;
      try {
        this.quotes = await quotesService.fetchAll();
        if (!this.selectedQuoteId && this.quotes[0]) {
          this.selectedQuoteId = this.quotes[0].id;
        }
      } catch (error: any) {
        this.error = error.message || 'Impossible de charger les devis.';
      } finally {
        this.loading = false;
      }
    },

    selectQuote(id: string | null) {
      this.selectedQuoteId = id;
    },

    async saveQuote(id: string | null, payload: PersistedQuotePayload) {
      this.error = null;
      try {
        const quote = id
          ? await quotesService.update(id, payload)
          : await quotesService.create(payload);

        const index = this.quotes.findIndex((entry) => entry.id === quote.id);
        if (index >= 0) {
          this.quotes[index] = {
            ...this.quotes[index],
            ...quote,
            createdAt: this.quotes[index].createdAt || quote.createdAt,
          };
        } else {
          this.quotes.unshift(quote);
        }
        this.quotes = sortQuotes(this.quotes);
        this.selectedQuoteId = quote.id;
        return quote;
      } catch (error: any) {
        this.error = error.message || 'Impossible de sauvegarder le devis.';
        throw error;
      }
    },

    async setQuoteStatus(id: string, status: Quote['status']) {
      this.error = null;
      await quotesService.setStatus(id, status);
      const index = this.quotes.findIndex((entry) => entry.id === id);
      if (index >= 0) {
        this.quotes[index] = {
          ...this.quotes[index],
          status,
          updatedAt: new Date().toISOString(),
        };
        this.quotes = sortQuotes(this.quotes);
      }
    },

    async setQuoteProjectId(id: string, projectId: string) {
      this.error = null;
      await quotesService.setProjectId(id, projectId);
      const index = this.quotes.findIndex((entry) => entry.id === id);
      if (index >= 0) {
        this.quotes[index] = {
          ...this.quotes[index],
          projectId,
          updatedAt: new Date().toISOString(),
        };
      }
    },

    async deleteQuote(id: string) {
      this.error = null;
      await quotesService.delete(id);
      this.quotes = this.quotes.filter((quote) => quote.id !== id);
      if (this.selectedQuoteId === id) {
        this.selectedQuoteId = this.quotes[0]?.id || null;
      }
    },
  },
});
