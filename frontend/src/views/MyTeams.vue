<template>
  <div class="page">
    <h2 class="page-title">我的队伍</h2>
    <p class="page-sub">{{ auth.role === 'TEACHER' ? '你指导的队伍' : '你加入的队伍' }}</p>

    <div v-loading="loading" class="team-grid">
      <div v-for="t in list" :key="t.id" class="card team-card hoverable" @click="$router.push(`/teams/${t.id}`)">
        <div class="team-head">
          <el-avatar :size="44" class="team-avatar">{{ t.name.slice(0, 1) }}</el-avatar>
          <div class="flex-1">
            <div class="team-name">{{ t.name }}</div>
            <div class="text-muted text-xs">{{ t.competition_title }}</div>
          </div>
          <el-tag size="small" :type="t.status === 'RECRUITING' ? 'success' : t.status === 'LOCKED' ? 'warning' : 'info'" effect="light">
            {{ { RECRUITING: '招募中', LOCKED: '已锁定', DISBANDED: '已解散' }[t.status] }}
          </el-tag>
        </div>
        <div class="team-meta">
          <span class="text-xs text-muted">👥 {{ t.member_count }}/{{ t.max_members }} 人</span>
          <span class="text-xs text-muted">{{ t.advisor_id ? '已有指导老师' : '暂无指导老师' }}</span>
        </div>
      </div>
    </div>
    <el-empty v-if="!loading && !list.length" description="还没有加入任何队伍" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useAuthStore } from '@/store/auth';
import api from '@/api';

const auth = useAuthStore();
const loading = ref(false);
const list = ref([]);

onMounted(async () => {
  loading.value = true;
  try { list.value = await api.myTeams(); } finally { loading.value = false; }
});
</script>

<style scoped>
.team-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.team-card { padding: 18px; cursor: pointer; }
.team-head { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
.team-avatar { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; font-weight: 700; }
.flex-1 { flex: 1; }
.team-name { font-weight: 700; font-size: 16px; }
.team-meta { display: flex; justify-content: space-between; }
@media (max-width: 960px) { .team-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
