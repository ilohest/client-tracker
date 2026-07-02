import { defineStore } from 'pinia';
import type { QuoteTemplate, QuoteTemplateInput } from '@client-tracker/contracts';
import { quoteTemplatesService } from '@/services/quoteTemplatesService';

interface QuoteTemplatesState {
  templates: QuoteTemplate[];
  selectedTemplateId: string | null;
  loading: boolean;
  error: string | null;
}

export const useQuoteTemplatesStore = defineStore('quoteTemplates', {
  state: (): QuoteTemplatesState => ({
    templates: [],
    selectedTemplateId: null,
    loading: false,
    error: null,
  }),

  getters: {
    selectedTemplate(state): QuoteTemplate | null {
      return state.templates.find((template) => template.id === state.selectedTemplateId) || null;
    },
    defaultTemplate(state): QuoteTemplate | null {
      return state.templates.find((template) => template.isDefault) || null;
    },
  },

  actions: {
    async fetchTemplates() {
      this.loading = true;
      this.error = null;
      try {
        this.templates = await quoteTemplatesService.fetchAll();
        if (!this.selectedTemplateId && this.templates[0]) {
          this.selectedTemplateId = this.templates[0].id;
        }
      } catch (error: any) {
        this.error = error.message || 'Impossible de charger les templates de devis.';
      } finally {
        this.loading = false;
      }
    },

    selectTemplate(id: string | null) {
      this.selectedTemplateId = id;
    },

    async saveTemplate(id: string | null, payload: QuoteTemplateInput) {
      this.error = null;
      try {
        const template = id
          ? await quoteTemplatesService.update(id, payload)
          : await quoteTemplatesService.create(payload);

        const index = this.templates.findIndex((entry) => entry.id === template.id);
        if (index >= 0) {
          this.templates[index] = { ...this.templates[index], ...template };
        } else {
          this.templates.unshift(template);
        }
        this.selectedTemplateId = template.id;
        return template;
      } catch (error: any) {
        this.error = error.message || 'Impossible de sauvegarder le template de devis.';
        throw error;
      }
    },

    /** Marque un template comme défaut (et retire le flag de l'ancien). */
    async setDefaultTemplate(id: string) {
      this.error = null;
      const previous = this.templates.find(
        (template) => template.isDefault && template.id !== id,
      );
      try {
        await quoteTemplatesService.setDefault(id, true);
        if (previous) await quoteTemplatesService.setDefault(previous.id, false);
        this.templates = this.templates.map((template) => ({
          ...template,
          isDefault: template.id === id,
        }));
      } catch (error: any) {
        this.error = error.message || 'Impossible de définir le template par défaut.';
        throw error;
      }
    },

    async deleteTemplate(id: string) {
      this.error = null;
      await quoteTemplatesService.delete(id);
      this.templates = this.templates.filter((template) => template.id !== id);
      if (this.selectedTemplateId === id) {
        this.selectedTemplateId = this.templates[0]?.id || null;
      }
    },
  },
});
