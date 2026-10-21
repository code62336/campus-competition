<template>
  <el-container class="layout">
    <el-aside :width="collapsed ? '64px' : '224px'" class="aside">
      <div class="logo" @click="$router.push('/')">
        <div class="logo-badge">🏆</div>
        <transition name="fade">
          <div v-if="!collapsed" class="logo-text">
            <div class="logo-title">赛事通</div>
            <div class="logo-sub">高校赛事管理平台</div>
          </div>
        </transition>
      </div>

      <el-menu :default-active="activeMenu" :collapse="collapsed" :collapse-transition="false" router class="menu">
        <el-menu-item index="/"><el-icon><Odometer /></el-icon><span>首页</span></el-menu-item>
        <el-menu-item index="/competitions"><el-icon><Trophy /></el-icon><span>赛事广场</span></el-menu-item>
        <el-menu-item index="/teams"><el-icon><Connection /></el-icon><span>找队友</span></el-menu-item>

        <template v-if="role === 'STUDENT'">
          <el-menu-item index="/my-teams"><el-icon><Flag /></el-icon><span>我的队伍</span></el-menu-item>
          <el-menu-item index="/teachers"><el-icon><User /></el-icon><span>找老师</span></el-menu-item>
          <el-menu-item index="/invitations"><el-icon><Message /></el-icon><span>我的邀请</span></el-menu-item>
        </template>

        <template v-if="role === 'TEACHER'">
          <el-menu-item index="/students"><el-icon><Search /></el-icon><span>挑选学生</span></el-menu-item>
          <el-menu-item index="/my-teams"><el-icon><Flag /></el-icon><span>指导队伍</span></el-menu-item>
          <el-menu-item index="/invitations"><el-icon><Message /></el-icon><span>我的邀请</span></el-menu-item>
        </template>

        <template v-if="role === 'MANAGER' || role === 'ADMIN'">
          <div v-if="!collapsed" class="menu-group">管理</div>
          <el-menu-item index="/manage/competitions"><el-icon><Management /></el-icon><span>赛事管理</span></el-menu-item>
          <el-menu-item index="/manage/verifications"><el-icon><Checked /></el-icon><span>认证审核</span></el-menu-item>
          <template v-if="role === 'ADMIN'">
            <el-menu-item index="/admin/users"><el-icon><UserFilled /></el-icon><span>用户管理</span></el-menu-item>
            <el-menu-item index="/admin/dicts"><el-icon><Collection /></el-icon><span>字典管理</span></el-menu-item>
            <el-menu-item index="/admin/audit"><el-icon><Document /></el-icon><span>审计日志</span></el-menu-item>
          </template>
        </template>

        <el-menu-item index="/notifications"><el-icon><Bell /></el-icon><span>通知中心</span></el-menu-item>
        <el-menu-item index="/profile"><el-icon><Setting /></el-icon><span>个人中心</span></el-menu-item>
      </el-menu>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-icon class="collapse-btn" @click="collapsed = !collapsed"><Fold v-if="!collapsed" /><Expand v-else /></el-icon>
          <el-breadcrumb separator="/">
            <el-breadcrumb-item>首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="currentTitle">{{ currentTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <div class="header-right">
          <el-badge :value="auth.unreadCount" :hidden="!auth.unreadCount" :max="99">
            <el-icon class="bell" @click="$router.push('/notifications')"><Bell /></el-icon>
          </el-badge>
          <el-dropdown trigger="click" @command="onCommand">
            <span class="user-chip">
              <el-avatar :size="30" :src="avatarUrl || undefined">{{ avatarText }}</el-avatar>
              <span class="uname">{{ auth.displayName }}</span>
              <el-tag size="small" :type="roleTagType" effect="light">{{ auth.roleLabel }}</el-tag>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">个人中心</el-dropdown-item>
                <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessageBox } from 'element-plus';
import { useAuthStore } from '@/store/auth';
import api from '@/api';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const collapsed = ref(false);

const role = computed(() => auth.role);
const activeMenu = computed(() => {
  const p = route.path;
  if (p.startsWith('/manage/competitions')) return '/manage/competitions';
  if (p.startsWith('/manage/verifications')) return '/manage/verifications';
  if (p.startsWith('/admin/users')) return '/admin/users';
  if (p.startsWith('/admin/dicts')) return '/admin/dicts';
  if (p.startsWith('/admin/audit')) return '/admin/audit';
  if (p.startsWith('/competitions')) return '/competitions';
  if (p.startsWith('/teams')) return '/teams';
  if (p.startsWith('/my-teams')) return '/my-teams';
  if (p.startsWith('/teachers')) return '/teachers';
  if (p.startsWith('/students')) return '/students';
  if (p.startsWith('/invitations')) return '/invitations';
  if (p.startsWith('/notifications')) return '/notifications';
  if (p.startsWith('/profile')) return '/profile';
  return '/';
});

const currentTitle = computed(() => {
  const map = {
    '/competitions': '赛事广场', '/teams': '找队友', '/my-teams': '我的队伍', '/teachers': '找老师',
    '/students': '挑选学生', '/invitations': '我的邀请', '/notifications': '通知中心', '/profile': '个人中心',
    '/manage/competitions': '赛事管理', '/manage/verifications': '认证审核', '/admin/users': '用户管理',
    '/admin/dicts': '字典管理', '/admin/audit': '审计日志',
  };
  if (map[activeMenu.value]) return map[activeMenu.value];
  if (route.path.startsWith('/competitions/')) return '赛事详情';
  if (route.path.startsWith('/teams/')) return '队伍详情';
  return '';
});

const roleTagType = computed(() => ({ STUDENT: 'primary', TEACHER: 'success', MANAGER: 'warning', ADMIN: 'danger' }[role.value] || 'info'));
const avatarText = computed(() => (auth.displayName || '?').slice(0, 1));
const avatarUrl = computed(() => auth.profile?.avatar_url || null);

async function onCommand(cmd) {
  if (cmd === 'profile') router.push('/profile');
  else if (cmd === 'logout') {
    await ElMessageBox.confirm('确定要退出登录吗？', '提示', { type: 'warning' });
    try { await api.logout(localStorage.getItem('refreshToken') || ''); } catch (e) { /* ignore */ }
    auth.clear();
    router.push('/login');
  }
}

onMounted(async () => {
  try {
    const c = await api.unreadCount();
    auth.setUnread(c.total);
  } catch (e) { /* ignore */ }
});
</script>

<style scoped>
.layout { height: 100vh; }
.aside {
  background: linear-gradient(180deg, #171a2b 0%, #1e2240 100%);
  color: #fff;
  transition: width .2s;
  overflow-x: hidden;
}
.logo { display: flex; align-items: center; gap: 10px; padding: 18px 18px 14px; cursor: pointer; }
.logo-badge { width: 36px; height: 36px; border-radius: 10px; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.logo-title { font-size: 17px; font-weight: 700; color: #fff; line-height: 1.2; }
.logo-sub { font-size: 11px; color: #8b90b3; }
.menu { border-right: none; background: transparent; }
.menu :deep(.el-menu-item) { color: #b9bdd6; height: 46px; }
.menu :deep(.el-menu-item:hover) { background: rgba(255,255,255,.06); color: #fff; }
.menu :deep(.el-menu-item.is-active) { background: linear-gradient(90deg, rgba(79,70,229,.35), rgba(124,58,237,.2)); color: #fff; border-radius: 8px; margin: 0 8px; width: calc(100% - 16px); }
.menu-group { font-size: 11px; color: #6b7090; padding: 12px 18px 4px; letter-spacing: 1px; }

.header { display: flex; align-items: center; justify-content: space-between; background: #fff; border-bottom: 1px solid #eef0f5; height: 60px; padding: 0 20px; }
.header-left { display: flex; align-items: center; gap: 16px; }
.collapse-btn { font-size: 18px; cursor: pointer; color: #555; }
.header-right { display: flex; align-items: center; gap: 20px; }
.bell { font-size: 19px; cursor: pointer; color: #555; }
.user-chip { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.uname { font-size: 14px; font-weight: 600; }

.main { background: #f5f6fa; padding: 0; }
.fade-enter-active, .fade-leave-active { transition: opacity .15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
