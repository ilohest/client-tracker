import { defineStore } from 'pinia';
import type { Timesheet, TimesheetInput, TimesheetSession } from '@client-tracker/contracts';
import { timesheetsService } from '@/services/timesheetsService';
import { toDateObj } from '@/utils/date';

interface TimesheetsState {
  timesheets: Timesheet[];
  selectedTimesheetId: string | null;
  loading: boolean;
  error: string | null;
}

const sortTimesheets = (timesheets: Timesheet[]): Timesheet[] =>
  [...timesheets].sort((a, b) => {
    const activeScore = Number(Boolean(b.activeStartedAt)) - Number(Boolean(a.activeStartedAt));
    if (activeScore !== 0) return activeScore;
    const dateA = toDateObj(a.updatedAt || a.createdAt)?.getTime() || 0;
    const dateB = toDateObj(b.updatedAt || b.createdAt)?.getTime() || 0;
    return dateB - dateA;
  });

const toDateInputValue = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const useTimesheetsStore = defineStore('timesheets', {
  state: (): TimesheetsState => ({
    timesheets: [],
    selectedTimesheetId: null,
    loading: false,
    error: null,
  }),

  getters: {
    selectedTimesheet(state): Timesheet | null {
      return state.timesheets.find((timesheet) => timesheet.id === state.selectedTimesheetId) || null;
    },
    openTimesheets(state): Timesheet[] {
      return state.timesheets.filter((timesheet) => timesheet.status === 'open');
    },
    closedTimesheets(state): Timesheet[] {
      return state.timesheets.filter((timesheet) => timesheet.status === 'closed');
    },
  },

  actions: {
    async fetchTimesheets() {
      this.loading = true;
      this.error = null;
      try {
        this.timesheets = await timesheetsService.fetchAll();
        if (!this.selectedTimesheetId && this.timesheets[0]) {
          this.selectedTimesheetId = this.timesheets[0].id;
        }
      } catch (error: any) {
        this.error = error.message || 'Impossible de charger les timesheets.';
      } finally {
        this.loading = false;
      }
    },

    selectTimesheet(id: string | null) {
      this.selectedTimesheetId = id;
    },

    async createTimesheet(payload: TimesheetInput) {
      this.error = null;
      try {
        const timesheet = await timesheetsService.create(payload);
        this.timesheets.unshift(timesheet);
        this.timesheets = sortTimesheets(this.timesheets);
        this.selectedTimesheetId = timesheet.id;
        return timesheet;
      } catch (error: any) {
        this.error = error.message || 'Impossible de créer la timesheet.';
        throw error;
      }
    },

    async updateTimesheet(id: string, payload: Partial<Timesheet>) {
      this.error = null;
      await timesheetsService.update(id, payload);
      const index = this.timesheets.findIndex((entry) => entry.id === id);
      if (index >= 0) {
        this.timesheets[index] = {
          ...this.timesheets[index],
          ...payload,
          updatedAt: new Date().toISOString(),
        };
        this.timesheets = sortTimesheets(this.timesheets);
      }
    },

    async startTimer(id: string) {
      const active = this.timesheets.find((entry) => entry.activeStartedAt && entry.id !== id);
      if (active) {
        await this.stopTimer(active.id);
      }

      const startedAt = new Date().toISOString();
      const timesheet = this.timesheets.find((entry) => entry.id === id);
      const projectStartDate = timesheet?.projectStartDate ? undefined : toDateInputValue(new Date());
      await timesheetsService.startTimer(id, startedAt, projectStartDate);
      if (timesheet) {
        timesheet.activeStartedAt = startedAt;
        if (projectStartDate) timesheet.projectStartDate = projectStartDate;
        timesheet.updatedAt = startedAt;
        this.timesheets = sortTimesheets(this.timesheets);
        this.selectedTimesheetId = id;
      }
    },

    async stopTimer(id: string, title = '') {
      const timesheet = this.timesheets.find((entry) => entry.id === id);
      if (!timesheet?.activeStartedAt) return;

      const endedAt = new Date().toISOString();
      const startedAtMs = new Date(timesheet.activeStartedAt).getTime();
      const endedAtMs = new Date(endedAt).getTime();
      const durationSeconds = Math.max(0, Math.round((endedAtMs - startedAtMs) / 1000));
      const session: TimesheetSession = {
        id: crypto.randomUUID(),
        title: title.trim(),
        startedAt: timesheet.activeStartedAt,
        endedAt,
        durationSeconds,
      };
      const sessions = [session, ...(timesheet.sessions || [])];
      const totalTrackedSeconds = Number(timesheet.totalTrackedSeconds || 0) + durationSeconds;

      await timesheetsService.stopTimer(id, sessions, totalTrackedSeconds);
      timesheet.activeStartedAt = '';
      timesheet.sessions = sessions;
      timesheet.totalTrackedSeconds = totalTrackedSeconds;
      timesheet.updatedAt = endedAt;
      this.timesheets = sortTimesheets(this.timesheets);
    },

    async updateSessionTitle(id: string, sessionId: string, title: string) {
      const timesheet = this.timesheets.find((entry) => entry.id === id);
      if (!timesheet) return;

      const sessions = (timesheet.sessions || []).map((session) =>
        session.id === sessionId ? { ...session, title } : session,
      );
      await this.updateTimesheet(id, { sessions });
    },

    async deleteTimesheet(id: string) {
      this.error = null;
      await timesheetsService.delete(id);
      this.timesheets = this.timesheets.filter((timesheet) => timesheet.id !== id);
      if (this.selectedTimesheetId === id) {
        this.selectedTimesheetId = this.timesheets.find((timesheet) => timesheet.status === 'open')?.id || this.timesheets[0]?.id || null;
      }
    },
  },
});
