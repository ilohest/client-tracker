import { defineStore } from 'pinia';
import type { Client, ClientDocument, ClientInput, ClientProject, OnboardingTaskStatus } from '@client-tracker/contracts';
import { clientDocumentsService } from '@/services/clientDocumentsService';
import { clientsService } from '@/services/clientsService';
import { createClientProject } from '@/lib/clientPresets';
import { toDateObj } from '@/utils/date';

interface ClientsState {
  clients: Client[];
  selectedClientId: string | null;
  loading: boolean;
  error: string | null;
}

const sortClients = (clients: Client[]): Client[] =>
  [...clients].sort((a, b) => {
    const dateA = toDateObj(a.updatedAt || a.createdAt)?.getTime() || 0;
    const dateB = toDateObj(b.updatedAt || b.createdAt)?.getTime() || 0;
    return dateB - dateA;
  });

export const useClientsStore = defineStore('clients', {
  state: (): ClientsState => ({
    clients: [],
    selectedClientId: null,
    loading: false,
    error: null,
  }),

  getters: {
    selectedClient(state): Client | null {
      return state.clients.find((client) => client.id === state.selectedClientId) || null;
    },
  },

  actions: {
    async fetchClients() {
      this.loading = true;
      this.error = null;
      try {
        this.clients = await clientsService.fetchAll();
        if (!this.selectedClientId && this.clients[0]) {
          this.selectedClientId = this.clients[0].id;
        }
      } catch (error: any) {
        this.error = error.message || 'Impossible de charger les clients.';
      } finally {
        this.loading = false;
      }
    },

    selectClient(id: string | null) {
      this.selectedClientId = id;
    },

    async saveClient(id: string | null, payload: ClientInput) {
      this.error = null;
      try {
        const client = id
          ? await clientsService.update(id, payload)
          : await clientsService.create(payload);

        const index = this.clients.findIndex((entry) => entry.id === client.id);
        if (index >= 0) {
          this.clients[index] = {
            ...this.clients[index],
            ...client,
            createdAt: this.clients[index].createdAt || client.createdAt,
          };
        } else {
          this.clients.unshift(client);
        }
        this.clients = sortClients(this.clients);
        this.selectedClientId = client.id;
        return client;
      } catch (error: any) {
        this.error = error.message || 'Impossible de sauvegarder le client.';
        throw error;
      }
    },

    async deleteClient(id: string) {
      this.error = null;
      await clientsService.delete(id);
      this.clients = this.clients.filter((client) => client.id !== id);
      if (this.selectedClientId === id) {
        this.selectedClientId = this.clients[0]?.id || null;
      }
    },

    async updateClientStage(id: string, stage: Client['stage']) {
      await clientsService.updateStage(id, stage);
      const client = this.clients.find((item) => item.id === id);
      if (client) {
        client.stage = stage;
        client.updatedAt = new Date().toISOString();
        this.clients = sortClients(this.clients);
      }
    },

    async updateTaskStatus(id: string, projectId: string, taskId: string, status: OnboardingTaskStatus) {
      const client = this.clients.find((item) => item.id === id);
      if (!client) return;

      const currentProjects = client.projects?.length
        ? client.projects
        : [
            {
              id: projectId,
              name: 'Projet principal',
              description: '',
              onboardingTasks: client.onboardingTasks || [],
            },
          ];

      const nextProjects = await clientsService.updateProjectOnboardingTaskStatus(
        id,
        currentProjects,
        projectId,
        taskId,
        status,
      );
      client.projects = nextProjects;
    },

    async addProject(id: string) {
      const client = this.clients.find((item) => item.id === id);
      if (!client) return;

      const nextProjectName = `Projet ${((client.projects || []).length || 0) + 1}`;
      const nextProjects = await clientsService.addProject(
        id,
        client.projects || [],
        createClientProject(nextProjectName),
      );
      client.projects = nextProjects;
    },

    async uploadClientDocument(id: string, file: File) {
      const client = this.clients.find((item) => item.id === id);
      if (!client) return;

      this.error = null;
      const nextDocuments = await clientDocumentsService.upload(id, client.documents || [], file);
      client.documents = nextDocuments;
    },

    async removeClientDocument(id: string, documentId: string) {
      const client = this.clients.find((item) => item.id === id);
      if (!client) return;

      this.error = null;
      const nextDocuments = await clientDocumentsService.remove(id, client.documents || [], documentId);
      client.documents = nextDocuments;
    },
  },
});
