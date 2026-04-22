<!-- components/widgets/NotesWidget.vue -->
<script setup lang="ts">
  import { ref, onMounted } from "vue";
  import { useNotesStore, Note } from "../../stores/notesStore";
  import { storeToRefs } from "pinia"; // Important pour la réactivité
  import { useConfirm } from "primevue/useconfirm";
  import { useToast } from "primevue/usetoast";

  // PrimeVue Components
  import Button from "primevue/button";
  import InputText from "primevue/inputtext";
  import Textarea from "primevue/textarea";
  import Dialog from "primevue/dialog";
  import ConfirmDialog from "primevue/confirmdialog";

  const store = useNotesStore();
  const { notes, loading } = storeToRefs(store); // Récupération réactive
  const confirm = useConfirm();
  const toast = useToast();

  const newNote = ref("");

  // État Édition
  const isEditDialogVisible = ref(false);
  const editingNote = ref<Note | null>(null);
  const editContent = ref("");

  // --- INITIALISATION ---
  onMounted(async () => {
    await store.fetchNotes();
  });

  // --- CREATE ---
  const addNote = async () => {
    if (!newNote.value.trim()) return;

    const success = await store.addNote(newNote.value);

    if (success) {
      newNote.value = "";
      toast.add({ severity: "success", summary: "Note ajoutée", life: 2000 });
    } else {
      toast.add({
        severity: "error",
        summary: "Erreur",
        detail: store.error || "Erreur inconnue",
        life: 3000,
      });
    }
  };

  // --- DELETE ---
  const confirmDelete = (noteId: string) => {
    confirm.require({
      message: "Voulez-vous vraiment supprimer cette note ?",
      header: "Confirmation",
      icon: "info",
      rejectLabel: "Annuler",
      acceptLabel: "Supprimer",
      acceptProps: {
        label: "Supprimer",
        severity: "danger",
      },
      accept: async () => {
        await store.deleteNote(noteId);
        toast.add({ severity: "info", summary: "Note supprimée", life: 2000 });
      },
    });
  };

  // --- UPDATE ---
  const openEditDialog = (note: Note) => {
    editingNote.value = note;
    editContent.value = note.content;
    isEditDialogVisible.value = true;
  };

  const saveEdit = async () => {
    if (!editingNote.value) return;

    // Appel au store (voir point ci-dessous)
    const success = await store.updateNote(
      editingNote.value.id,
      editContent.value,
    );

    if (success) {
      isEditDialogVisible.value = false;
      toast.add({
        severity: "success",
        summary: "Note mise à jour",
        life: 2000,
      });
    } else {
      toast.add({
        severity: "error",
        summary: "Erreur",
        detail: "Impossible de modifier",
        life: 3000,
      });
    }
  };
</script>

<template>
  <div
    class="h-full bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col relative overflow-hidden"
  >
    <div class="flex justify-between items-center mb-4 z-10">
      <h3 class="font-bold text-slate-700 flex items-center gap-2">
        <span class="material-symbols-outlined text-yellow-500"
          >sticky_note_2</span
        >
        Notes Privées
      </h3>
      <span class="text-xs text-slate-400 font-mono">{{ notes.length }}</span>
    </div>

    <ConfirmDialog />

    <div class="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar z-10">
      <div
        v-if="loading && notes.length === 0"
        class="flex justify-center py-10"
      >
        <span class="material-symbols-outlined animate-spin text-yellow-500">progress_activity</span>
      </div>

      <div
        v-else
        v-for="note in notes"
        :key="note.id"
        class="group p-3 bg-yellow-50/50 hover:bg-yellow-50 rounded-xl border border-yellow-100/50 hover:border-yellow-200 transition-all text-sm text-slate-600 flex justify-between items-start gap-2"
      >
        <p
          class="whitespace-pre-wrap flex-1 leading-relaxed cursor-pointer"
          @click="openEditDialog(note)"
        >
          {{ note.content }}
        </p>

        <div
          class="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <button
            @click.stop="openEditDialog(note)"
            class="p-1 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
          >
            <span class="material-symbols-outlined text-xs">edit</span>
          </button>
          <button
            @click.stop="confirmDelete(note.id)"
            class="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
          >
            <span class="material-symbols-outlined text-xs">delete</span>
          </button>
        </div>
      </div>

      <div
        v-if="notes.length === 0 && !loading"
        class="text-center text-slate-400 py-10 text-xs italic"
      >
        Aucune note pour l'instant.
      </div>
    </div>

    <div class="mt-4 pt-4 border-t border-slate-100 flex gap-2 z-10">
      <InputText
        v-model="newNote"
        placeholder="Une idée ?"
        class="flex-1 !text-sm !rounded-xl"
        @keydown.enter="addNote"
      />
      <Button
        rounded
        aria-label="Ajouter"
        @click="addNote"
        :disabled="!newNote"
        :loading="loading"
        class="!w-10 !h-10 !rounded-xl shadow-lg shadow-primary-100"
      >
        <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
      </Button>
    </div>

    <Dialog
      v-model:visible="isEditDialogVisible"
      header="Modifier la note"
      :modal="true"
      class="w-[90vw] max-w-md"
    >
      <div class="flex flex-col gap-4 pt-2">
        <Textarea
          v-model="editContent"
          rows="5"
          class="w-full !text-sm"
          autoResize
        />
        <div class="flex justify-end gap-2">
          <Button
            label="Annuler"
            text
            severity="secondary"
            @click="isEditDialogVisible = false"
          />
          <Button label="Enregistrer" @click="saveEdit">
            <template #icon><span class="material-symbols-outlined text-lg">check</span></template>
          </Button>
        </div>
      </div>
    </Dialog>

    <div
      class="absolute top-0 right-0 w-32 h-32 bg-yellow-100/20 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2 pointer-events-none"
    ></div>
  </div>
</template>

<style scoped>
  .custom-scrollbar::-webkit-scrollbar {
    width: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: #e2e8f0;
    border-radius: 4px;
  }
  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: #cbd5e1;
  }
</style>
