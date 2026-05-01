import { create } from 'zustand';
import type { User } from '../types';

interface DMHubState {
  isOpen: boolean;
  initialUser: User | null;
  openWith: (user: User) => void;
  open: () => void;
  close: () => void;
}

export const useDMHubStore = create<DMHubState>((set) => ({
  isOpen: false,
  initialUser: null,
  openWith: (user) => set({ isOpen: true, initialUser: user }),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, initialUser: null }),
}));
