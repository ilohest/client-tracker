// frontend/src/stores/usersStore.ts
import { defineStore } from "pinia";
import type { AppUser } from "@client-tracker/contracts";
import { userService } from "@/services/userService";

interface UsersState {
  users: AppUser[];
  loading: boolean;
}

export const useUsersStore = defineStore("users", {
  state: (): UsersState => ({
    users: [],
    loading: false,
  }),

  actions: {
    async fetchUsers() {
      this.loading = true;
      try {
        this.users = await userService.fetchAll();
      } catch (error) {
        console.error("Erreur fetchUsers:", error);
      } finally {
        this.loading = false;
      }
    },
  },
});
