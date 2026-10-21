<template>
  <div class="page">
    <!-- 欢迎横幅 -->
    <div class="hero">
      <div>
        <h2 class="hero-title">{{ greeting }}，{{ auth.displayName }} 👋</h2>
        <p class="hero-sub">
          当前身份：<b>{{ auth.roleLabel }}</b>
          <template v-if="auth.profile?.verify_status === 'VERIFIED'"> · 已认证 ✓</template>
          <template v-else> · <el-link type="warning" @click="$router.push('/profile')">未认证，去完善</el-link></template>
        </p>
      </div>
      <div class="hero-actions">
        <el-button type="primary" round @click="$router.push('/competitions')"><el-icon><Trophy /></el-icon>&nbsp;浏览赛事</el-button>
        <el-button v-if="auth.role === 'STUDENT'" round @click="$router.push('/teams')">找队友组队</el-button>
        <el-button v-if="['MANAGER','ADMIN'].includes(auth.role)" type="primary" round @click="$router.push('/manage/competitions')"><el-icon><Plus /></el-icon>&nbsp;发布赛事</el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stats">
      <div v-for="s in statCards" :key="s.label" class="card stat-card">
        <div class="stat-icon" :style="{ background: s.bg }">{{ s.icon }}</div>
        <div>
          <div class="stat-num mono">{{ s.value }}</div>
          <div class="stat-label">{{ s.label }}</div>
        </div>
      </div>
    </div>

    <!-- 管理端统计 -->
    <template v-if="['MANAGER','ADMIN'].includes(auth.role)">
      <div class="section-title">运营概览</div>
      <div class="card" style="padding:20px">
        <el-row :gutter="20">
          <el-col :span="8" v-for="r in adminOverview" :key="r.label">
            <div class="overview-item">
              <div class="text-muted text-sm">{{ r.label }}</div>
              <div class="overview-val grad-text">{{ r.value }}</div>
            </div>
          </el-col>
        </el-row>
      </div>
    </template>

    <!-- 最新赛事 -->
    <div class="section-title">最新赛事</div>
    <div class="comp-grid" v-if="competitions.length">
      <div v-for="c in competitions" :key="c.id" class="card comp-card hoverable" @click="$router.push(`/competitions/${c.id}`)">
        <div class="comp-cover" :style="c.cover_url ? { backgroundImage: `url(${c.cover_url})` } : {}">
          <el-tag size="small" effect="dark" :type="c.level === 'SCHOOL' ? 'danger' : 'warning'">{{ c.level === 'SCHOOL' ? '校赛' : '院赛' }}</el-tag>
        </div>
        <div class="comp-body">
          <div class="comp-title">{{ c.title }}</div>
          <div class="text-muted text-xs mt-8">{{ c.organizer || '—' }} · {{ c.year }}</div>
          <div class="comp-foot">
            <span class="text-xs text-muted">截止 {{ fmtDate(c.register_end_at) }}</span>
            <el-button size="small" text type="primary">查看详情</el-button>
          </div>
        </div>
      </div>
    </div>
    <el-empty v-else description="暂无已发布赛事" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useAuthStore } from '@/store/auth';
import api from '@/api';

const auth = useAuthStore();
const competitions = ref([]);
const myTeams = ref([]);
const pendingInvites = ref(0);
const adminStats = ref(null);

const greeting = computed(() => {
  const h = new Date().getHours();
  if (h < 6) return '夜深了';
  if (h < 12) return '早上好';
  if (h < 14) return '中午好';
  if (h < 18) return '下午好';
  return '晚上好';
});

const statCards = computed(() => {
  if (['MANAGER', 'ADMIN'].includes(auth.role)) {
    const s = adminStats.value || {};
    const users = (s.userByType || []).reduce((a, b) => a + b.c, 0);
    return [
      { label: '用户总数', value: users, icon: '👥', bg: '#eef2ff' },
      { label: '赛事总数', value: (s.competitionByStatus || []).reduce((a, b) => a + b.c, 0), icon: '🏆', bg: '#fef3c7' },
      { label: '有效队伍', value: s.teamCount || 0, icon: '🚩', bg: '#ecfdf5' },
      { label: '待审核认证', value: s.pendingVerification || 0, icon: '📋', bg: '#fdf2f8' },
    ];
  }
  return [
    { label: '我的队伍', value: myTeams.value.length, icon: '🚩', bg: '#eef2ff' },
    { label: '待处理邀请', value: pendingInvites.value, icon: '✉️', bg: '#fef3c7' },
    { label: '未读通知', value: auth.unreadCount, icon: '🔔', bg: '#ecfdf5' },
    { label: '已发布赛事', value: competitions.value.length, icon: '🏆', bg: '#fdf2f8' },
  ];
});

const adminOverview = computed(() => {
  const s = adminStats.value || {};
  const byStatus = {};
  (s.competitionByStatus || []).forEach((x) => { byStatus[x.status] = x.c; });
  return [
    { label: '已发布赛事', value: byStatus.PUBLISHED || 0 },
    { label: '草稿赛事', value: byStatus.DRAFT || 0 },
    { label: '待审核认证', value: s.pendingVerification || 0 },
  ];
});

function fmtDate(d) { return d ? String(d).slice(0, 10) : '—'; }

onMounted(async () => {
  try {
    const list = await api.listCompetitions({ size: 4 });
    competitions.value = list.items;
  } catch (e) { /* ignore */ }
  if (['STUDENT', 'TEACHER'].includes(auth.role)) {
    try { myTeams.value = await api.myTeams(); } catch (e) { /* ignore */ }
    try { const inv = await api.listInvitations({ direction: 'in', status: 'PENDING', size: 100 }); pendingInvites.value = inv.total; } catch (e) { /* ignore */ }
  }
  if (['MANAGER', 'ADMIN'].includes(auth.role)) {
    try { adminStats.value = await api.getStats(); } catch (e) { /* ignore */ }
  }
});
</script>

<style scoped>
.hero { display: flex; align-items: center; justify-content: space-between; padding: 28px 32px; border-radius: 18px; background: linear-gradient(120deg, #4f46e5 0%, #7c3aed 100%); color: #fff; margin-bottom: 20px; }
.hero-title { margin: 0 0 8px; font-size: 24px; }
.hero-sub { margin: 0; opacity: .92; font-size: 14px; }
.hero-sub :deep(.el-link) { color: #ffd54f; }
.hero-actions { display: flex; gap: 10px; }

.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card { display: flex; align-items: center; gap: 14px; padding: 18px 20px; }
.stat-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 22px; }
.stat-num { font-size: 26px; font-weight: 800; }
.stat-label { color: #8a8f9e; font-size: 13px; }

.section-title { font-size: 16px; font-weight: 700; margin: 8px 0 14px; }
.overview-item { text-align: center; padding: 8px 0; }
.overview-val { font-size: 28px; font-weight: 800; }

.comp-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.comp-card { overflow: hidden; cursor: pointer; }
.comp-cover { height: 120px; background: linear-gradient(135deg, #c7d2fe, #e0e7ff); background-size: cover; background-position: center; padding: 10px; }
.comp-body { padding: 14px 16px; }
.comp-title { font-weight: 700; font-size: 15px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 42px; }
.comp-foot { display: flex; justify-content: space-between; align-items: center; margin-top: 10px; }

@media (max-width: 960px) { .stats { grid-template-columns: repeat(2, 1fr); } .comp-grid { grid-template-columns: repeat(2, 1fr); } .hero { flex-direction: column; align-items: flex-start; gap: 14px; } }
</style>
