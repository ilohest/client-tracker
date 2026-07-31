<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import type { Project } from "@client-tracker/contracts";
import Button from "primevue/button";
import DatePicker from "primevue/datepicker";
import Dialog from "primevue/dialog";
import InputNumber from "primevue/inputnumber";
import InputText from "primevue/inputtext";
import Select from "primevue/select";
import Textarea from "primevue/textarea";
import type { ProjectFormValue } from "@/components/projects/projectForm";

const props = withDefaults(
  defineProps<{
    visible: boolean;
    mode: "create" | "edit";
    project?: Project | null;
    clientOptions: Array<{ label: string; value: string }>;
    colorOptions: string[];
    defaultHourlyRate?: number;
    defaultColor?: string;
  }>(),
  {
    project: null,
    defaultHourlyRate: 0,
    defaultColor: "#e96a5f",
  },
);

const emit = defineEmits<{
  "update:visible": [value: boolean];
  submit: [value: ProjectFormValue];
}>();

const visibleModel = computed({
  get: () => props.visible,
  set: (value: boolean) => emit("update:visible", value),
});

const form = reactive<ProjectFormValue>({
  title: "",
  clientId: "",
  description: "",
  budgetExVat: 0,
  hourlyRate: 0,
  startedAt: null,
  dueDate: null,
  color: props.defaultColor,
});

const isoToDate = (value?: string): Date | null =>
  value ? new Date(`${value}T00:00:00`) : null;

const hydrate = () => {
  const project = props.mode === "edit" ? props.project : null;
  form.title = project?.title || "";
  form.clientId = project?.clientId || "";
  form.description = project?.description || "";
  form.budgetExVat = Number(project?.budgetExVat || 0);
  form.hourlyRate = Number(project?.hourlyRate ?? props.defaultHourlyRate ?? 0);
  form.startedAt = project ? isoToDate(project.startedAt) : new Date();
  form.dueDate = isoToDate(project?.dueDate);
  form.color = project?.color || props.defaultColor || props.colorOptions[0] || "#e96a5f";
};

watch(
  () => [props.visible, props.project?.id, props.mode] as const,
  ([visible]) => {
    if (visible) hydrate();
  },
  { immediate: true },
);

const submit = () => {
  if (!form.title.trim()) return;
  emit("submit", {
    ...form,
    title: form.title.trim(),
    description: form.description.trim(),
  });
};
</script>

<template>
  <Dialog
    v-model:visible="visibleModel"
    modal
    :draggable="false"
    :header="mode === 'edit' ? 'Modifier le projet' : 'Nouveau projet'"
    :style="{ width: 'min(720px, 94vw)' }"
  >
    <div class="grid gap-5 py-1">
      <section class="grid gap-3">
        <div>
          <h3 class="text-sm font-bold text-surface-dark">Informations générales</h3>
          <p class="mt-0.5 text-xs text-surface-dark/50">Identité du projet et client concerné.</p>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <label class="grid gap-1.5">
            <span class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">Nom du projet</span>
            <InputText v-model="form.title" placeholder="Ex : Refonte Atelier Delvaux" autofocus />
          </label>
          <label class="grid gap-1.5">
            <span class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">Client</span>
            <Select
              v-model="form.clientId"
              :options="clientOptions"
              option-label="label"
              option-value="value"
              placeholder="Choisir un client"
              show-clear
            />
          </label>
        </div>
        <label class="grid gap-1.5">
          <span class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">Description</span>
          <Textarea
            v-model="form.description"
            rows="3"
            auto-resize
            placeholder="Contexte, périmètre ou objectif du projet…"
          />
        </label>
      </section>

      <div class="h-px bg-surface-dark/8"></div>

      <section class="grid gap-3">
        <div>
          <h3 class="text-sm font-bold text-surface-dark">Planification et budget</h3>
          <p class="mt-0.5 text-xs text-surface-dark/50">Repères prévisionnels modifiables à tout moment.</p>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <label class="grid gap-1.5">
            <span class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">Démarrage</span>
            <DatePicker v-model="form.startedAt" date-format="dd/mm/yy" show-icon icon-display="input" />
          </label>
          <label class="grid gap-1.5">
            <span class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">Échéance</span>
            <DatePicker v-model="form.dueDate" date-format="dd/mm/yy" show-icon icon-display="input" show-clear />
          </label>
          <label class="grid gap-1.5">
            <span class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">Budget HT</span>
            <InputNumber v-model="form.budgetExVat" mode="currency" currency="EUR" locale="fr-BE" :min="0" />
          </label>
          <label class="grid gap-1.5">
            <span class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">Taux horaire</span>
            <InputNumber v-model="form.hourlyRate" mode="currency" currency="EUR" locale="fr-BE" :min="0" />
          </label>
        </div>
        <label class="grid gap-1.5">
          <span class="text-xs font-bold uppercase tracking-wide text-surface-dark/45">Couleur du projet</span>
          <Select v-model="form.color" :options="colorOptions" class="w-full">
            <template #value="{ value }">
              <span class="flex items-center gap-2">
                <span class="h-3.5 w-3.5 rounded-full" :style="{ backgroundColor: value }"></span>
                <span class="text-sm">Repère visuel</span>
              </span>
            </template>
            <template #option="{ option }">
              <span class="flex items-center gap-2">
                <span class="h-3.5 w-3.5 rounded-full" :style="{ backgroundColor: option }"></span>
                <span class="font-mono text-xs text-surface-dark/55">{{ option }}</span>
              </span>
            </template>
          </Select>
        </label>
      </section>
    </div>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <Button severity="secondary" outlined label="Annuler" @click="visibleModel = false" />
        <Button
          :label="mode === 'edit' ? 'Enregistrer' : 'Créer le projet'"
          :disabled="!form.title.trim()"
          @click="submit"
        >
          <template #icon>
            <span class="material-symbols-outlined text-lg">{{ mode === "edit" ? "save" : "add" }}</span>
          </template>
        </Button>
      </div>
    </template>
  </Dialog>
</template>
