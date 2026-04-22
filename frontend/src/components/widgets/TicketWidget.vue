<!-- TicketWidget.vue -->

<script setup lang="ts">
  import { ref } from "vue";
  import { submitTicket } from "../../services/ticketService";
  import { useToast } from "primevue/usetoast";

  // Components
  import InputText from "primevue/inputtext";
  import Textarea from "primevue/textarea";
  import Select from "primevue/select";
  import Button from "primevue/button";
  import Tag from "primevue/tag";
  import Message from "primevue/message";

  const toast = useToast();
  const loading = ref(false);

  const subject = ref("");
  const message = ref("");
  const priority = ref("normal");

  const priorities = [
    { label: "Basse", value: "low" },
    { label: "Normale", value: "normal" },
    { label: "Haute", value: "high" },
  ];

  const handleSubmit = async () => {
    if (!subject.value || !message.value) return;

    loading.value = true;
    try {
      await submitTicket({
        subject: subject.value,
        message: message.value,
        priority: priority.value as any,
      });

      toast.add({
        severity: "success",
        summary: "Envoyé au Backend",
        detail: "Ticket créé via API Node.js",
        life: 3000,
      });

      // Reset
      subject.value = "";
      message.value = "";
      priority.value = "normal";
    } catch (e) {
      toast.add({
        severity: "error",
        summary: "Erreur API",
        detail: "Le backend a rejeté la demande.",
      });
      console.error(e);
    } finally {
      loading.value = false;
    }
  };
</script>

<template>
  <div
    class="h-full bg-white rounded-3xl p-6 shadow-sm border border-slate-100 flex flex-col relative overflow-hidden"
  >
    <div class="flex justify-between items-start mb-4 z-10">
      <div>
        <h3 class="font-bold text-slate-700 flex items-center gap-2">
          <span class="material-symbols-outlined text-blue-500">api</span>
          API Support
        </h3>
        <p class="text-xs text-slate-400 mt-1">Démonstration Backend Node.js</p>
      </div>
      <Tag value="API POC" severity="warn" class="!text-[10px]" />
    </div>

    <Message severity="secondary" size="small" class="mb-4 z-10">
      Ce formulaire envoie une requête POST sécurisée vers
      <code>/api/tickets</code>.
    </Message>

    <div class="flex flex-col gap-3 z-10 flex-1">
      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-slate-500">Sujet</label>
        <InputText
          v-model="subject"
          placeholder="Bug sur le dashboard..."
          class="!text-sm"
        />
      </div>

      <div class="flex flex-col gap-1">
        <label class="text-xs font-semibold text-slate-500">Priorité</label>
        <Select
          v-model="priority"
          :options="priorities"
          optionLabel="label"
          optionValue="value"
          class="w-full !text-sm"
        />
      </div>

      <div class="flex flex-col gap-1 flex-1">
        <label class="text-xs font-semibold text-slate-500">Message</label>
        <Textarea v-model="message" rows="3" class="w-full !text-sm flex-1" />
      </div>

      <Button
        label="Envoyer via API"
        @click="handleSubmit"
        :loading="loading"
        :disabled="!subject || !message"
        severity="info"
        class="w-full mt-2"
      >
        <template #icon><span class="material-symbols-outlined text-lg">send</span></template>
      </Button>
    </div>

    <div
      class="absolute -bottom-10 -left-10 w-32 h-32 bg-blue-50 rounded-full blur-3xl pointer-events-none"
    ></div>
  </div>
</template>
