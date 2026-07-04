import { defineStore } from 'pinia';
import type { QuoteTemplate, QuoteTemplateInput } from '@client-tracker/contracts';
import { createDefaultQuoteTemplate } from '@/lib/clientPresets';
import { quoteTemplatesService } from '@/services/quoteTemplatesService';
import { toDateObj } from '@/utils/date';

export const BASE_TEMPLATE_NAME = 'Base commune';

interface QuoteTemplatesState {
  templates: QuoteTemplate[];
  selectedTemplateId: string | null;
  loading: boolean;
  error: string | null;
}

/** Base commune épinglée en tête, puis les templates du plus récent au plus ancien. */
const sortTemplates = (templates: QuoteTemplate[]): QuoteTemplate[] =>
  [...templates].sort((a, b) => {
    if (a.kind === 'base') return -1;
    if (b.kind === 'base') return 1;
    const dateA = toDateObj(a.updatedAt || a.createdAt)?.getTime() || 0;
    const dateB = toDateObj(b.updatedAt || b.createdAt)?.getTime() || 0;
    return dateB - dateA;
  });

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
    /** Base commune : template protégé qui préremplit les nouveaux devis. */
    baseTemplate(state): QuoteTemplate | null {
      return state.templates.find((template) => template.kind === 'base') || null;
    },
  },

  actions: {
    async fetchTemplates() {
      this.loading = true;
      this.error = null;
      try {
        const templates = await quoteTemplatesService.fetchAll();
        this.templates = sortTemplates(templates);
        await this.ensureBaseTemplate();
        if (!this.selectedTemplateId && this.templates[0]) {
          this.selectedTemplateId = this.templates[0].id;
        }
      } catch (error: any) {
        this.error = error.message || 'Impossible de charger les templates de devis.';
      } finally {
        this.loading = false;
      }
    },

    /**
     * Garantit l'existence de la base commune : promeut l'ancien template
     * marqué « par défaut » (migration) ou en crée une neuve.
     */
    async ensureBaseTemplate() {
      if (this.templates.some((template) => template.kind === 'base')) return;

      const legacyDefault = this.templates.find(
        (template) => (template as { isDefault?: boolean }).isDefault,
      );

      if (legacyDefault) {
        await quoteTemplatesService.promoteToBase(legacyDefault.id, BASE_TEMPLATE_NAME);
        legacyDefault.kind = 'base';
        legacyDefault.name = BASE_TEMPLATE_NAME;
      } else {
        const created = await quoteTemplatesService.create({
          ...createDefaultQuoteTemplate(BASE_TEMPLATE_NAME),
          kind: 'base',
        });
        this.templates.push(created);
      }

      this.templates = sortTemplates(this.templates);
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
          this.templates[index] = {
            ...this.templates[index],
            ...template,
            createdAt: this.templates[index].createdAt || template.createdAt,
          };
        } else {
          this.templates.unshift(template);
        }
        this.templates = sortTemplates(this.templates);
        this.selectedTemplateId = template.id;
        return template;
      } catch (error: any) {
        this.error = error.message || 'Impossible de sauvegarder le template de devis.';
        throw error;
      }
    },

    async deleteTemplate(id: string) {
      this.error = null;
      const target = this.templates.find((template) => template.id === id);
      if (target?.kind === 'base') {
        this.error = 'La base commune ne peut pas être supprimée.';
        throw new Error(this.error);
      }
      await quoteTemplatesService.delete(id);
      this.templates = this.templates.filter((template) => template.id !== id);
      if (this.selectedTemplateId === id) {
        this.selectedTemplateId = this.templates[0]?.id || null;
      }
    },
  },
});
