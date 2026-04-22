<!-- DesignComponents.vue -->
<script setup lang="ts">
import Button from "primevue/button";
import InputText from "primevue/inputtext";
import Message from "primevue/message";
import Tag from "primevue/tag";
import Badge from "primevue/badge";
import Card from "primevue/card";
import Avatar from "primevue/avatar";
import ToggleSwitch from "primevue/toggleswitch";
import { ref } from "vue";

const switchVal = ref(true);
const textVal = ref("");
</script>

<template>
  <div class="space-y-8">
    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <h3
        class="font-bold text-slate-400 uppercase text-xs tracking-wider mb-6"
      >
        Boutons & Actions
      </h3>

      <div class="flex flex-col gap-6">
        <div class="flex flex-wrap gap-3 items-center">
          <Button label="Primary" />
          <Button label="Secondary" severity="secondary" />
          <Button label="Success" severity="success" />
          <Button label="Info" severity="info" />
          <Button label="Warn" severity="warn" />
          <Button label="Danger" severity="danger" />
          <Button label="Contrast" severity="contrast" />
        </div>

        <div
          class="flex flex-wrap gap-3 items-center border-t border-slate-50 pt-4"
        >
          <Button label="Outlined" outlined />
          <Button label="Text" text />
          <Button label="Rounded" rounded />
          <Button aria-label="Filter">
            <template #icon><span class="material-symbols-outlined text-lg">check</span></template>
          </Button>
          <Button
            rounded
            outlined
            severity="info"
            aria-label="User"
          >
            <template #icon><span class="material-symbols-outlined text-lg">person</span></template>
          </Button>
          <Button
            label="Badged"
            severity="secondary"
            outlined
            badge="2"
          >
            <template #icon><span class="material-symbols-outlined text-lg">notifications</span></template>
          </Button>
        </div>
      </div>
    </div>

    <div class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <h3
        class="font-bold text-slate-400 uppercase text-xs tracking-wider mb-6"
      >
        Formulaires & Entrées
      </h3>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-bold text-slate-700">Input Standard</label>
          <InputText v-model="textVal" placeholder="Tapez quelque chose..." />
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-bold text-slate-700">Input Invalid</label>
          <InputText
            class="p-invalid"
            placeholder="Erreur..."
            :invalid="true"
          />
          <small class="text-red-500">Ce champ est requis.</small>
        </div>

        <div class="flex flex-col gap-2">
          <label class="text-sm font-bold text-slate-700">Switch Toggle</label>
          <div class="flex items-center gap-3">
            <ToggleSwitch v-model="switchVal" />
            <span class="text-sm text-slate-600">{{
              switchVal ? "Activé" : "Désactivé"
            }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <Card class="border border-slate-100 shadow-sm !bg-surface-card">
        <template #title>Composant Card</template>
        <template #subtitle>Surface et Élévation</template>
        <template #content>
          <p class="m-0 text-slate-600">
            Cette carte utilise la variable
            <code>--color-surface-card</code> pour son fond. Elle s'adapte
            automatiquement si vous changez les neutres.
          </p>
          <div class="flex gap-2 mt-4">
            <Tag value="New" severity="primary" />
            <Tag value="Verified" severity="success">
              <template #icon><span class="material-symbols-outlined text-sm">check</span></template>
            </Tag>
          </div>
        </template>
      </Card>

      <div
        class="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-6"
      >
        <div>
          <h3
            class="font-bold text-slate-400 uppercase text-xs tracking-wider mb-3"
          >
            Messages
          </h3>
          <div class="flex flex-col gap-2">
            <Message severity="info">
              <template #icon><span class="material-symbols-outlined text-lg">info</span></template>
              Ceci est un message d'information.
            </Message>
            <Message severity="success">
              <template #icon><span class="material-symbols-outlined text-lg">check</span></template>
              Opération réussie avec succès.
            </Message>
          </div>
        </div>

        <div>
          <h3
            class="font-bold text-slate-400 uppercase text-xs tracking-wider mb-3"
          >
            Avatars
          </h3>
          <div class="flex gap-3">
            <Avatar
              label="P"
              class="mr-2"
              size="large"
              style="background-color: var(--color-primary); color: #ffffff"
            />
            <Avatar
              label="S"
              class="mr-2"
              size="large"
              style="background-color: var(--color-secondary); color: #ffffff"
            />
            <Avatar
              class="mr-2"
              size="large"
              style="background-color: #ece9fc; color: #2a1261"
            >
              <template #default><span class="material-symbols-outlined">person</span></template>
            </Avatar>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
