import { createRouter, createWebHistory } from 'vue-router';
import { useAuthStore } from '@/store/auth';
import MainLayout from '@/layouts/MainLayout.vue';

const routes = [
  { path: '/login', name: 'login', component: () => import('@/views/Login.vue'), meta: { public: true } },
  { path: '/register', name: 'register', component: () => import('@/views/Register.vue'), meta: { public: true } },
  {
    path: '/',
    component: MainLayout,
    meta: { requiresAuth: true },
    children: [
      { path: '', name: 'home', component: () => import('@/views/Dashboard.vue') },
      { path: 'competitions', name: 'competitions', component: () => import('@/views/CompetitionList.vue') },
      { path: 'competitions/:id', name: 'competitionDetail', component: () => import('@/views/CompetitionDetail.vue') },
      { path: 'teams', name: 'teamSquare', component: () => import('@/views/TeamSquare.vue') },
      { path: 'teams/:id', name: 'teamDetail', component: () => import('@/views/TeamDetail.vue') },
      { path: 'my-teams', name: 'myTeams', component: () => import('@/views/MyTeams.vue') },
      { path: 'teachers', name: 'teachers', component: () => import('@/views/Teachers.vue'), meta: { roles: ['STUDENT'] } },
      { path: 'students', name: 'students', component: () => import('@/views/Students.vue'), meta: { roles: ['TEACHER', 'MANAGER', 'ADMIN'] } },
      { path: 'invitations', name: 'invitations', component: () => import('@/views/Invitations.vue') },
      { path: 'notifications', name: 'notifications', component: () => import('@/views/Notifications.vue') },
      { path: 'profile', name: 'profile', component: () => import('@/views/Profile.vue') },
      { path: 'manage/competitions', name: 'manageCompetitions', component: () => import('@/views/ManageCompetitions.vue'), meta: { roles: ['MANAGER', 'ADMIN'] } },
      { path: 'manage/verifications', name: 'verifications', component: () => import('@/views/Verifications.vue'), meta: { roles: ['MANAGER', 'ADMIN'] } },
      { path: 'admin/users', name: 'adminUsers', component: () => import('@/views/AdminUsers.vue'), meta: { roles: ['ADMIN'] } },
      { path: 'admin/dicts', name: 'adminDicts', component: () => import('@/views/AdminDicts.vue'), meta: { roles: ['ADMIN'] } },
      { path: 'admin/audit', name: 'adminAudit', component: () => import('@/views/AdminAudit.vue'), meta: { roles: ['ADMIN'] } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
];

const router = createRouter({ history: createWebHistory(), routes });

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  const hasToken = !!localStorage.getItem('accessToken');
  if (to.meta.public) {
    if ((to.path === '/login' || to.path === '/register') && hasToken && auth.user) return { path: '/' };
    return true;
  }
  if (!hasToken) return { path: '/login', query: { redirect: to.fullPath } };
  if (!auth.user) {
    try {
      await auth.fetchMe();
    } catch (e) {
      auth.clear();
      return { path: '/login' };
    }
  }
  if (to.meta.roles && !to.meta.roles.includes(auth.role)) return { path: '/' };
  return true;
});

export default router;
