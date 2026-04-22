// frontend/src/stores/notesStore.ts

import { defineStore } from "pinia";
import type { Note } from "@client-tracker/contracts";
import { notesService } from "../services/notesService";

export type { Note };

interface NotesState {
  notes: Note[];
  loading: boolean;
  error: string | null;
}

export const useNotesStore = defineStore("notes", {
  state: (): NotesState => ({
    notes: [],
    loading: false,
    error: null,
  }),

  actions: {
    async fetchNotes() {
      this.loading = true;
      this.error = null;
      try {
        this.notes = await notesService.fetchAll();
      } catch (error: any) {
        this.error = error.message || "Impossible de charger les notes.";
        console.error(error);
      } finally {
        this.loading = false;
      }
    },

    async addNote(content: string) {
      if (!content.trim()) return;
      this.error = null;
      try {
        const newNote = await notesService.create(content);
        // Ajout optimiste ou retour réel du service
        this.notes.unshift(newNote);
        return true;
      } catch (error: any) {
        this.error = error.message || "Erreur création note.";
        return false;
      }
    },

    async deleteNote(id: string) {
      this.error = null;
      // Optimistic UI : On supprime visuellement avant
      const previousNotes = [...this.notes];
      this.notes = this.notes.filter((n) => n.id !== id);

      try {
        await notesService.delete(id);
      } catch (error: any) {
        // Rollback en cas d'erreur
        this.notes = previousNotes;
        this.error = error.message || "Impossible de supprimer.";
      }
    },

    async updateNote(id: string, newContent: string) {
      this.error = null;
      try {
        const updatedNote = await notesService.update(id, newContent);
        
        const index = this.notes.findIndex(n => n.id === id);
        if (index !== -1) {
          // On merge pour garder les champs qu'on n'a pas touchés (ex: createdAt)
          this.notes[index] = { ...this.notes[index], ...updatedNote };
        }
        return true;
      } catch (error: any) {
        this.error = error.message || "Erreur modification.";
        return false;
      }
    }
  },
});