import type { User } from '../types';

export const mockUser: User = {
  id: 'user-1',
  name: 'Alex Rivera',
  email: 'alex.rivera@alexandria-os.edu',
  role: 'Lead Researcher',
  avatarUrl: null,
  language: 'en',
  defaultOutputLanguage: 'he',
  notifications: {
    generationComplete: true,
    factCheckConflict: true,
    draftReady: false,
  },
  lastActiveAt: new Date(Date.now() - 14 * 60 * 1000).toISOString(),
  createdAt: '2024-01-15T09:00:00.000Z',
};
