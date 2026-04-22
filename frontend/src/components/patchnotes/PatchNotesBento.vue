<!-- PatchNotesBento.vue -->
<template>
  <div
    class="relative flex flex-col rounded-xl shadow-sm border border-gray-200 bg-white h-[26rem] overflow-hidden group"
  >
    <div
      class="flex justify-between items-center p-5 border-b border-gray-100 bg-white z-20 shrink-0"
    >
      <div>
        <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
          <div class="p-1.5 bg-indigo-50 rounded-lg text-indigo-600">
            <span class="material-symbols-outlined text-sm">notifications</span>
          </div>
          Patch Notes
        </h2>
      </div>

      <Button
        v-if="isAdmin"
        rounded
        text
        size="small"
        @click="openEditor"
        v-tooltip.left="'Nouvelle annonce'"
        class="!w-8 !h-8 !text-gray-400 hover:!text-indigo-600 hover:!bg-indigo-50 transition-colors"
      >
        <template #icon><span class="material-symbols-outlined text-lg">add</span></template>
      </Button>
    </div>

    <div
      v-if="!isLoading && items.length > 0"
      class="flex-1 overflow-y-auto p-0 pretty-scrollbar relative z-10"
    >
      <div class="flex flex-col py-2">
        <div
          v-for="(item, index) in items"
          :key="item.id"
          class="relative pl-8 pr-6 py-4 hover:bg-slate-50 transition-colors group/item"
        >
          <div
            class="absolute left-[1.2rem] top-8 bottom-[-2rem] w-px bg-gray-200 group-last/item:hidden"
          ></div>

          <div class="flex flex-col gap-2">
            <div class="flex items-center gap-3">
              <div
                class="absolute left-[0.95rem] top-[1.25rem] w-2.5 h-2.5 rounded-full bg-white border-2 border-indigo-500 z-10"
              ></div>
              <span
                class="text-xs font-bold text-gray-700 bg-gray-100 px-2 py-0.5 rounded border border-gray-200"
              >
                {{ formatDateFull(item.date) }}
              </span>
              <span
                class="text-[10px] text-gray-400 uppercase font-bold tracking-wide"
              >
                PAR {{ item.author }}
              </span>
            </div>

            <div
              class="pl-1 text-sm text-gray-600 leading-relaxed break-words whitespace-normal quill-content"
              v-html="item.content"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="!isLoading"
      class="flex-grow flex flex-col items-center justify-center text-gray-400 bg-gray-50/50"
    >
      <div
        class="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3"
      >
        <span class="material-symbols-outlined text-xl text-gray-400">auto_awesome</span>
      </div>
      <p class="text-sm font-medium">Tout est calme...</p>
    </div>
    <div v-else class="flex-1 p-5 space-y-6">
      <div
        v-for="i in 3"
        :key="i"
        class="flex flex-col gap-2 pl-4 border-l border-gray-100 ml-4"
      >
        <div class="w-24 h-4 bg-gray-100 rounded animate-pulse"></div>
        <div class="w-full h-16 bg-gray-100 rounded animate-pulse"></div>
      </div>
    </div>

    <div
      class="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white to-transparent pointer-events-none z-20"
    ></div>

    <Dialog
      v-model:visible="isEditorOpen"
      modal
      header="Nouvelle Annonce"
      class="w-full md:w-[600px]"
    >
      <div class="flex flex-col gap-4">
        <Editor v-model="newContent" editorStyle="height: 250px" />
        <div class="flex justify-end gap-2">
          <Button
            label="Annuler"
            text
            severity="secondary"
            @click="isEditorOpen = false"
          />
          <Button
            label="Publier"
            @click="submitNote"
            :loading="isLoading"
          >
            <template #icon><span class="material-symbols-outlined text-lg">send</span></template>
          </Button>
        </div>
      </div>
    </Dialog>
  </div>
</template>

<script lang="ts" setup>
  import { ref, onMounted } from "vue";
  import { useAnnouncementsStore } from "@/stores/announcementsStore";
  import { useAuthStore } from "@/stores/authStore";
  import { storeToRefs } from "pinia";
  import Button from "primevue/button";
  import Dialog from "primevue/dialog";
  import Editor from "primevue/editor";

  const store = useAnnouncementsStore();
  const authStore = useAuthStore();
  const { items, isLoading } = storeToRefs(store);
  const { isAdmin } = storeToRefs(authStore);

  const isEditorOpen = ref(false);
  const newContent = ref("");

  const openEditor = () => {
    newContent.value = "";
    isEditorOpen.value = true;
  };

  const submitNote = async () => {
    if (!newContent.value) return;
    await store.postAnnouncement(newContent.value);
    isEditorOpen.value = false;
  };

  const formatDateFull = (dateStr: string) => {
    if (!dateStr) return "";
    return new Date(dateStr).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  onMounted(() => {
    store.fetchLatest();
  });
</script>

<style scoped>
  /* SCROLLBAR */
  .pretty-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: #e2e8f0 transparent;
  }
  .pretty-scrollbar::-webkit-scrollbar {
    width: 5px;
  }
  .pretty-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .pretty-scrollbar::-webkit-scrollbar-thumb {
    background-color: #cbd5e1;
    border-radius: 20px;
    border: 1px solid transparent;
    background-clip: content-box;
  }
  .pretty-scrollbar::-webkit-scrollbar-thumb:hover {
    background-color: #94a3b8;
  }

  /* --- RESTAURATION DU STYLE QUILL --- */
  /* On utilise :deep() car v-html injecte du contenu non scopé */

  :deep(.quill-content h1) {
    font-size: 1.5em;
    font-weight: 700;
    margin-bottom: 0.5em;
    color: #1e293b; /* slate-800 */
  }

  :deep(.quill-content h2) {
    font-size: 1.25em;
    font-weight: 600;
    margin-top: 1em;
    margin-bottom: 0.5em;
    color: #334155; /* slate-700 */
  }

  :deep(.quill-content p) {
    margin-bottom: 0.5em;
    line-height: 1.6;
  }

  /* Listes à puces (Crucial pour Quill) */
  :deep(.quill-content ul),
  :deep(.quill-content ol) {
    padding-left: 1.5em;
    margin-bottom: 0.5em;
  }

  :deep(.quill-content ul) {
    list-style-type: disc;
  }

  :deep(.quill-content ol) {
    list-style-type: decimal;
  }

  :deep(.quill-content li) {
    margin-bottom: 0.25em;
    padding-left: 0.25em; /* Petit espacement entre la puce et le texte */
  }

  /* Styles de texte basiques */
  :deep(.quill-content strong) {
    font-weight: 700;
    color: #0f172a; /* slate-900 */
  }

  :deep(.quill-content em) {
    font-style: italic;
  }

  :deep(.quill-content u) {
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  :deep(.quill-content blockquote) {
    border-left: 4px solid #e2e8f0;
    padding-left: 1em;
    margin-left: 0;
    color: #64748b; /* slate-500 */
    font-style: italic;
  }

  :deep(.quill-content a) {
    color: #6366f1; /* indigo-500 */
    text-decoration: underline;
  }

  :deep(.quill-content pre) {
    background-color: #f1f5f9; /* slate-100 */
    padding: 0.5em;
    border-radius: 4px;
    font-family: monospace;
    overflow-x: auto;
    font-size: 0.9em;
    color: #ef4444; /* red-500 like code style */
  }

  /* Alignement Quill */
  :deep(.ql-align-center) {
    text-align: center;
  }
  :deep(.ql-align-right) {
    text-align: right;
  }
  :deep(.ql-align-justify) {
    text-align: justify;
  }
</style>
