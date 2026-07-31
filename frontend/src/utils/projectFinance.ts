import type { Project, Quote } from '@client-tracker/contracts';
import { toDateObj } from '@/utils/date';
import { calculatePaymentScheduleStepAmounts } from '@/utils/quote';

/**
 * Calculs financiers d'un projet. Les devis liés sont passés en argument plutôt
 * que lus dans un store : index et page détail partagent ainsi exactement la
 * même arithmétique, sans dépendance à un composant.
 */

export const projectQuotes = (project: Project, quotes: Quote[]): Quote[] =>
  quotes
    .filter((quote) => quote.projectId === project.id)
    .sort(
      (a, b) =>
        (toDateObj(a.createdAt)?.getTime() || 0) - (toDateObj(b.createdAt)?.getTime() || 0),
    );

/** Devis liés dont le montant compte réellement (exclut les versions remplacées et les refus). */
export const projectActiveQuotes = (project: Project, quotes: Quote[]): Quote[] =>
  projectQuotes(project, quotes).filter(
    (quote) => !['superseded', 'refused'].includes(quote.status),
  );

const quotePaymentSchedule = (quote: Quote): NonNullable<Quote['paymentSchedule']> =>
  quote.paymentSchedule?.length
    ? quote.paymentSchedule
    : [{ id: '', label: 'Paiement final', mode: 'percent', value: 100 }];

export const projectSupplementTotal = (project: Project): number =>
  (project.projectSupplements || []).reduce(
    (total, supplement) => total + Number(supplement.amountExVat || 0),
    0,
  );

export const projectBudgetBase = (project: Project, activeQuotes: Quote[]): number => {
  if (!activeQuotes.length) return Number(project.budgetExVat || 0);
  return activeQuotes.reduce((total, quote) => total + Number(quote.subtotal || 0), 0);
};

export const projectTotalBudget = (project: Project, activeQuotes: Quote[]): number =>
  projectBudgetBase(project, activeQuotes) + projectSupplementTotal(project);

const linkedAddOnIds = (project: Project): Set<string> =>
  new Set(
    (project.milestones || [])
      .map((milestone) => milestone.addOnId || '')
      .filter(Boolean),
  );

const legacySupplementTotal = (project: Project): number => {
  const linkedIds = linkedAddOnIds(project);
  return (project.projectSupplements || []).reduce(
    (total, supplement) =>
      linkedIds.has(supplement.id)
        ? total
        : total + Number(supplement.amountExVat || 0),
    0,
  );
};

export const isDateOnOrAfter = (value: string | undefined, startDate = ''): boolean => {
  if (!startDate) return true;
  if (!value) return false;
  return value >= startDate;
};

export const findPaymentReceivedMilestoneDone = (
  project: Project,
  quoteId: string,
  index: number,
  stepId = '',
): Project['milestones'][number] | null =>
  project.milestones?.find((milestone) => {
    if (milestone.status !== 'done') return false;
    if (milestone.kind === 'payment_received' && milestone.quoteId === quoteId) {
      if (stepId && milestone.paymentScheduleStepId === stepId) return true;
      return milestone.paymentScheduleIndex === index;
    }
    return false;
  }) || null;

export const isPaymentReceivedMilestoneDone = (
  project: Project,
  quoteId: string,
  index: number,
  stepId = '',
): boolean => Boolean(findPaymentReceivedMilestoneDone(project, quoteId, index, stepId));

export const legacyFinalPaymentMilestone = (
  project: Project,
): Project['milestones'][number] | null =>
  project.milestones?.find(
    (milestone) =>
      milestone.status === 'done' &&
      milestone.label === 'Paiement final reçu' &&
      (!milestone.kind || milestone.paymentScheduleIndex === -1),
  ) || null;

export const hasLegacyFinalPaymentDone = (project: Project): boolean =>
  Boolean(legacyFinalPaymentMilestone(project));

const findQuoteFinancialMilestoneDone = (
  project: Project,
  kind: 'invoice_sent' | 'payment_received',
  quoteId: string,
  index: number,
  stepId = '',
): Project['milestones'][number] | null =>
  project.milestones?.find((milestone) => {
    if (milestone.status !== 'done' || milestone.kind !== kind || milestone.quoteId !== quoteId) {
      return false;
    }
    if (stepId && milestone.paymentScheduleStepId === stepId) return true;
    return milestone.paymentScheduleIndex === index;
  }) || null;

const addOnFinancialTotal = (
  project: Project,
  kind: 'invoice_sent' | 'payment_received',
  sinceDate = '',
): number =>
  (project.projectSupplements || []).reduce((total, addOn) => {
    const milestone = project.milestones?.find(
      (item) =>
        item.addOnId === addOn.id &&
        item.kind === kind &&
        item.status === 'done' &&
        isDateOnOrAfter(item.date, sinceDate),
    );
    return milestone ? total + Number(addOn.amountExVat || 0) : total;
  }, 0);

const projectScheduledFinancialExVat = (
  project: Project,
  activeQuotes: Quote[],
  kind: 'invoice_sent' | 'payment_received',
  sinceDate = '',
): number => {
  if (!activeQuotes.length) {
    const completedBaseMilestone = project.milestones?.find(
      (milestone) =>
        milestone.kind === kind &&
        !milestone.addOnId &&
        milestone.status === 'done' &&
        isDateOnOrAfter(milestone.date, sinceDate),
    );
    const baseAmount =
      kind === 'invoice_sent'
        ? Number(project.invoicedExVat || 0)
        : Number(project.paidExVat || 0);
    const datedBaseAmount =
      completedBaseMilestone
        ? projectBudgetBase(project, activeQuotes)
        : sinceDate && !isDateOnOrAfter(project.startedAt || '', sinceDate)
          ? 0
          : Math.min(projectBudgetBase(project, activeQuotes), baseAmount);
    return datedBaseAmount + addOnFinancialTotal(project, kind, sinceDate);
  }

  const legacyFinal = legacyFinalPaymentMilestone(project);
  if (
    kind === 'payment_received' &&
    legacyFinal &&
    isDateOnOrAfter(legacyFinal.date, sinceDate)
  ) {
    return projectTotalBudget(project, activeQuotes);
  }

  const lastQuoteId = activeQuotes[activeQuotes.length - 1].id;
  const quoteTotal = activeQuotes.reduce((allQuotesTotal, quote) => {
    const paymentSchedule = quotePaymentSchedule(quote);
    return (
      allQuotesTotal +
      paymentSchedule.reduce((total, step, index) => {
        const milestone = findQuoteFinancialMilestoneDone(
          project,
          kind,
          quote.id,
          index,
          step.id,
        );
        if (!milestone || !isDateOnOrAfter(milestone.date, sinceDate)) return total;
        const isFinalPayment =
          quote.id === lastQuoteId && index === paymentSchedule.length - 1;
        return (
          total +
          calculatePaymentScheduleStepAmounts(
            step,
            Number(quote.subtotal || 0),
            Number(quote.totalWithVat || 0),
          ).amountExcl +
          (isFinalPayment ? legacySupplementTotal(project) : 0)
        );
      }, 0)
    );
  }, 0);

  return quoteTotal + addOnFinancialTotal(project, kind, sinceDate);
};

export const projectScheduledInvoicedExVat = (
  project: Project,
  activeQuotes: Quote[],
  sinceDate = '',
): number =>
  projectScheduledFinancialExVat(project, activeQuotes, 'invoice_sent', sinceDate);

export const projectScheduledReceivedExVat = (
  project: Project,
  activeQuotes: Quote[],
  sinceDate = '',
): number => {
  return projectScheduledFinancialExVat(
    project,
    activeQuotes,
    'payment_received',
    sinceDate,
  );
};

export const projectToInvoiceExVat = (project: Project, activeQuotes: Quote[]): number =>
  Math.max(
    0,
    projectTotalBudget(project, activeQuotes) -
      projectScheduledInvoicedExVat(project, activeQuotes) -
      Number(project.billingWaivedExVat || 0),
  );

export const projectToReceiveExVat = (project: Project, activeQuotes: Quote[]): number =>
  Math.max(
    0,
    projectScheduledInvoicedExVat(project, activeQuotes) -
      projectScheduledReceivedExVat(project, activeQuotes),
  );
