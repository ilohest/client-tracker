export interface ProjectFormValue {
  title: string;
  clientId: string;
  description: string;
  budgetExVat: number;
  hourlyRate: number;
  startedAt: Date | null;
  dueDate: Date | null;
  color: string;
}

