import { defineStore } from 'pinia';
import type { Project, ProjectInput, Quote, TimesheetInput } from '@client-tracker/contracts';
import { projectsService } from '@/services/projectsService';
import { useQuotesStore } from '@/stores/quotesStore';
import { useTimesheetsStore } from '@/stores/timesheetsStore';
import { toDateObj } from '@/utils/date';
import { calculatePaymentScheduleStepAmounts } from '@/utils/quote';

interface ProjectsState {
  projects: Project[];
  selectedProjectId: string | null;
  loading: boolean;
  error: string | null;
}

const sortProjects = (projects: Project[]): Project[] =>
  [...projects].sort((a, b) => {
    const statusScore = Number(b.status === 'in_progress') - Number(a.status === 'in_progress');
    if (statusScore !== 0) return statusScore;
    const dateA = toDateObj(a.updatedAt || a.createdAt)?.getTime() || 0;
    const dateB = toDateObj(b.updatedAt || b.createdAt)?.getTime() || 0;
    return dateB - dateA;
  });

const paymentLabel = (quote: Quote, index: number, type: 'invoice' | 'received') => {
  const steps = quote.paymentSchedule || [];
  const step = steps[index];
  const stepCount = steps.length;
  const stepLabel = step?.label?.trim() || `paiement ${index + 1}`;
  const amounts = step
    ? calculatePaymentScheduleStepAmounts(step, Number(quote.subtotal || 0), Number(quote.totalWithVat || 0))
    : { percent: 0 };
  const isOnlyPayment = stepCount <= 1 || amounts.percent >= 99.9;
  const isFirstPayment = index === 0;
  const isLastPayment = index === stepCount - 1;
  const isDeposit = isFirstPayment && !isOnlyPayment && /acompte|validation|deposit/i.test(stepLabel);

  if (type === 'invoice') {
    if (isDeposit) return "Facture d'acompte envoyée";
    if (isLastPayment || isOnlyPayment) return 'Facture finale envoyée';
    return `Facture ${stepLabel} envoyée`;
  }

  if (isDeposit) return 'Acompte reçu';
  if (isLastPayment || isOnlyPayment) return 'Paiement final reçu';
  return 'Paiement reçu';
};

const createMilestonesFromQuote = (
  quote: Quote,
  acceptedDate = '',
  options: { label?: string; includeWorkflowSteps?: boolean } = {},
): Project['milestones'] => {
  const { label = 'Devis accepté', includeWorkflowSteps = true } = options;
  // Les jalons d'un avenant (2e devis et suivants) précisent la réf. du devis pour rester distincts.
  const refSuffix = includeWorkflowSteps ? '' : ` — ${quote.quoteRef || quote.title}`;
  const schedule = quote.paymentSchedule?.length
    ? quote.paymentSchedule
    : [{ id: '', label: 'Paiement final', mode: 'percent' as const, value: 100 }];
  const firstPaymentIndexes = schedule.length > 1 ? [0] : [];
  const laterPaymentIndexes = schedule.map((_, index) => index).filter((index) => !firstPaymentIndexes.includes(index));
  const paymentMilestones = (index: number): Project['milestones'] => [
    {
      id: crypto.randomUUID(),
      label: `${paymentLabel(quote, index, 'invoice')}${refSuffix}`,
      status: 'todo',
      date: '',
      kind: 'invoice_sent',
      paymentScheduleStepId: schedule[index]?.id || '',
      paymentScheduleIndex: index,
      quoteId: quote.id,
    },
    {
      id: crypto.randomUUID(),
      label: `${paymentLabel(quote, index, 'received')}${refSuffix}`,
      status: 'todo',
      date: '',
      kind: 'payment_received',
      paymentScheduleStepId: schedule[index]?.id || '',
      paymentScheduleIndex: index,
      quoteId: quote.id,
    },
  ];

  const milestones: Project['milestones'] = [
    { id: crypto.randomUUID(), label, status: 'done', date: acceptedDate, kind: 'quote_accepted', quoteId: quote.id },
    ...firstPaymentIndexes.flatMap(paymentMilestones),
  ];
  if (includeWorkflowSteps) {
    milestones.push(
      { id: crypto.randomUUID(), label: 'Travail en cours', status: 'todo', date: '', kind: 'work' },
      { id: crypto.randomUUID(), label: 'Validation client', status: 'todo', date: '', kind: 'approval' },
      { id: crypto.randomUUID(), label: 'Implémentation des retours', status: 'todo', date: '', kind: 'work' },
      { id: crypto.randomUUID(), label: 'Livraison', status: 'todo', date: '', kind: 'delivery' },
    );
  }
  milestones.push(...laterPaymentIndexes.flatMap(paymentMilestones));
  return milestones;
};

export const useProjectsStore = defineStore('projects', {
  state: (): ProjectsState => ({
    projects: [],
    selectedProjectId: null,
    loading: false,
    error: null,
  }),

  getters: {
    selectedProject(state): Project | null {
      return state.projects.find((project) => project.id === state.selectedProjectId) || null;
    },
    activeProjects(state): Project[] {
      return state.projects.filter((project) => !['paid', 'closed'].includes(project.status));
    },
    closedProjects(state): Project[] {
      return state.projects.filter((project) => ['paid', 'closed'].includes(project.status));
    },
  },

  actions: {
    async fetchProjects() {
      this.loading = true;
      this.error = null;
      try {
        this.projects = await projectsService.fetchAll();
        if (!this.selectedProjectId && this.projects[0]) {
          this.selectedProjectId = this.projects[0].id;
        }
      } catch (error: any) {
        this.error = error.message || 'Impossible de charger les projets.';
      } finally {
        this.loading = false;
      }
    },

    selectProject(id: string | null) {
      this.selectedProjectId = id;
    },

    async createProject(payload: ProjectInput) {
      this.error = null;
      const project = await projectsService.create(payload);
      this.projects.unshift(project);
      this.projects = sortProjects(this.projects);
      this.selectedProjectId = project.id;
      return project;
    },

    async updateProject(id: string, payload: Partial<Project>) {
      this.error = null;
      await projectsService.update(id, payload);
      const index = this.projects.findIndex((project) => project.id === id);
      if (index >= 0) {
        this.projects[index] = {
          ...this.projects[index],
          ...payload,
          updatedAt: new Date().toISOString(),
        };
        this.projects = sortProjects(this.projects);
      }
    },

    async deleteProject(id: string) {
      this.error = null;
      const quotesStore = useQuotesStore();
      const linkedQuotes = quotesStore.quotes.filter((quote) => quote.projectId === id);
      await Promise.all(linkedQuotes.map((quote) => quotesStore.setQuoteProjectId(quote.id, '')));
      await projectsService.delete(id);
      this.projects = this.projects.filter((project) => project.id !== id);
      if (this.selectedProjectId === id) this.selectedProjectId = this.projects[0]?.id || null;
    },

    async createFromQuote(quote: Quote, hourlyRate = 0, color = '#e96a5f') {
      const acceptedDate = new Date().toISOString().slice(0, 10);
      const title = quote.projectName || quote.title || quote.clientName || 'Projet devis accepté';
      const project = await this.createProject({
        title,
        description: quote.projectSummary || '',
        notes: '',
        projectNotes: [],
        projectSupplements: [],
        sourceType: 'quote',
        timesheetId: '',
        clientId: quote.clientId || '',
        clientName: quote.clientName || '',
        color,
        status: 'proposal_accepted',
        health: 'ok',
        budgetExVat: Number(quote.subtotal || 0),
        invoicedExVat: 0,
        paidExVat: 0,
        billingWaivedExVat: 0,
        hourlyRate,
        startedAt: acceptedDate,
        dueDate: '',
        closedAt: '',
        blockedReason: '',
        nextAction: "Envoyer la facture d'acompte",
        milestones: createMilestonesFromQuote(quote, acceptedDate),
      });

      const quotesStore = useQuotesStore();
      await quotesStore.setQuoteProjectId(quote.id, project.id);

      const timesheetsStore = useTimesheetsStore();
      const timesheetPayload: TimesheetInput = {
        projectId: project.id,
        title,
        sourceType: 'quote',
        quoteId: quote.id,
        quoteRef: quote.quoteRef || '',
        clientId: quote.clientId || '',
        clientName: quote.clientName || '',
        color,
        hourlyRate,
        fixedPriceExVat: Number(quote.subtotal || 0),
        projectStartDate: acceptedDate,
        status: 'open',
        activeStartedAt: '',
      };
      const timesheet = await timesheetsStore.createTimesheet(timesheetPayload);
      await this.updateProject(project.id, { timesheetId: timesheet.id });
      return { project: { ...project, timesheetId: timesheet.id }, timesheet };
    },

    // Lie un devis accepté existant (avenant) à un projet déjà en cours : le
    // devis n'est pas dupliqué, seuls ses jalons de paiement s'ajoutent à la roadmap.
    async attachQuoteToProject(project: Project, quote: Quote) {
      await this.attachQuotesToProject(project, [quote]);
    },

    // Liaison groupée : une seule mise à jour du projet évite qu'un ajout
    // successif écrase les jalons créés pour le devis précédent.
    async attachQuotesToProject(project: Project, quotes: Quote[]) {
      const quotesStore = useQuotesStore();
      const quotesWithoutMilestones = quotes.filter(
        (quote) =>
          !project.milestones.some((milestone) => milestone.quoteId === quote.id),
      );
      if (!quotesWithoutMilestones.length) return;
      await Promise.all(
        quotesWithoutMilestones
          .filter((quote) => quote.projectId !== project.id)
          .map((quote) => quotesStore.setQuoteProjectId(quote.id, project.id)),
      );
      const acceptedDate = new Date().toISOString().slice(0, 10);
      const newMilestones = quotesWithoutMilestones.flatMap((quote) =>
        createMilestonesFromQuote(quote, acceptedDate, {
          label: `Devis accepté — ${quote.quoteRef || quote.title}`,
          includeWorkflowSteps: false,
        }),
      );
      await this.updateProject(project.id, {
        milestones: [...project.milestones, ...newMilestones],
      });
    },

    // Détache un devis d'un projet : retire ses jalons associés, laisse le devis intact.
    async detachQuoteFromProject(project: Project, quote: Quote) {
      const quotesStore = useQuotesStore();
      await quotesStore.setQuoteProjectId(quote.id, '');
      await this.updateProject(project.id, {
        milestones: project.milestones.filter((milestone) => milestone.quoteId !== quote.id),
      });
    },
  },
});
