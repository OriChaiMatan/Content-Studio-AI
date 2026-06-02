import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { mockUser } from '../data/mockUser';

interface SettingsState {
  user: User;
  updateUser: (partial: Partial<User>) => void;
  updateNotification: (key: keyof User['notifications'], value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      user: mockUser,

      updateUser: (partial) =>
        set(state => ({ user: { ...state.user, ...partial } })),

      updateNotification: (key, value) =>
        set(state => ({
          user: {
            ...state.user,
            notifications: { ...state.user.notifications, [key]: value },
          },
        })),
    }),
    { name: 'content-studio-settings' },
  ),
);
