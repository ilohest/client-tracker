<!-- Dashboard.vue -->
<script setup lang="ts">
  import WelcomeCard from "../components/dashboard/WelcomeCard.vue";
  import NotesWidget from "../components/widgets/NotesWidget.vue";
  import PatchNotesBento from "../components/patchnotes/PatchNotesBento.vue";

  
  import AiGeneratorWidget from "../components/widgets/AiGeneratorWidget.vue";
  

  
</script>

<template>
  <div class="flex flex-col gap-6 p-2">
    <div
      class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[minmax(180px,auto)]"
    >
      <div class="col-span-1 md:col-span-2">
        <WelcomeCard />
      </div>

      <div class="col-span-1 md:col-span-1">
        <PatchNotesBento />
      </div>

      <div
        class="col-span-1 lg:row-span-2 min-h-[400px]"
      >
        <NotesWidget />
      </div>

       
      <div class="col-span-1 md:col-span-1 min-h-[250px]">
        <AiGeneratorWidget />
      </div>
      
    </div>
  </div>
</template>
