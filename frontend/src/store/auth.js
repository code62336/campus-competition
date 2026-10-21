import { defineStore } from 'pinia';
import api from '@/api';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null,
    permissions: [],
    profile: null,
    unreadCount: 0,
  }),
  getters: {
    isLoggedIn: (s) => !!s.user,
    role: (s) => s.user?.userType || null,
    displayName: (s) => s.user?.displayName || '',
    hasPerm: (s) => (p) => s.permissions.includes('*') || s.permissions.includes(p),
    roleLabel: (s) => ({ STUDENT: '学生', TEACHER: '教师', MANAGER: '赛事负责人', ADMIN: '超级管理员' }[s.user?.userType] || ''),
  },
  actions: {
    async fetchMe() {
      const data = await api.getMe();
      this.user = data;
      this.permissions = data.permissions || [];
      this.profile = data.profile;
      this.unreadCount = data.unreadCount || 0;
      return data;
    },
    setUnread(n) { this.unreadCount = n; },
    clear() {
      this.user = null;
      this.permissions = [];
      this.profile = null;
      this.unreadCount = 0;
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    },
  },
});
