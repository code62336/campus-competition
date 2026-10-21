<template>
  <div class="page">
    <h2 class="page-title">找队友广场</h2>
    <p class="page-sub">找到志同道合的伙伴，一起组队参赛</p>

    <div class="card filter-bar">
      <el-select v-model="query.competition_id" placeholder="选择赛事" clearable style="width:300px" @change="load(1)">
        <el-option v-for="c in competitions" :key="c.id" :label="c.title" :value="c.id" />
      </el-select>
      <el-input v-model="query.keyword" placeholder="搜索队名 / 口号" clearable style="width:220px" :prefix-icon="Search" @keyup.enter="load(1)" />
      <el-button type="primary" :icon="Search" @click="load(1)">搜索</el-button>
    </div>

    <div v-loading="loading" class="team-grid">
      <div v-for="t in list" :key="t.id" class="card team-card hoverable" @click="$router.push(`/teams/${t.id}`)">
        <div class="team-head">
          <el-avatar :size="46" class="team-avatar">{{ t.name.slice(0, 1) }}</el-avatar>
          <div class="team-info">
            <div class="team-name">{{ t.name }}</div>
            <div class="text-muted text-xs">{{ t.competition_title }}</div>
          </div>
          <el-tag size="small" type="success" effect="light">招募中</el-tag>
        </div>
        <div class="team-slogan">{{ t.slogan || '这个队伍很低调，还没有留下口号～' }}</div>
        <div class="team-meta">
          <el-tag size="small" effect="plain">{{ t.college_name || '未填学院' }}</el-tag>
          <span class="text-xs text-muted">👥 {{ t.member_count }}/{{ t.max_members }}</span>
        </div>
        <div class="team-foot">
          <span class="text-xs text-muted">队长：{{ t.leader_name }}</span>
          <el-button size="small" type="primary" text>查看详情</el-button>
        </div>
      </div>
    </div>
    <el-empty v-if="!loading && !list.length" description="暂无招募中的队伍" />

    <div class="pager" v-if="total > query.size">
      <el-pagination background layout="prev, pager, next, total" :total="total" :page-size="query.size" :current-page="query.page" @current-change="load" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Search } from '@element-plus/icons-vue';
import api from '@/api';

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const competitions = ref([]);
const query = ref({ competition_id: '', keyword: '', page: 1, size: 12 });

async function load(page) {
  query.value.page = page || 1;
  loading.value = true;
  try {
    const data = await api.listRecruiting(query.value);
    list.value = data.items;
    total.value = data.total;
  } finally { loading.value = false; }
}

onMounted(async () => {
  try { competitions.value = (await api.listCompetitions({ size: 100 })).items; } catch (e) { /* ignore */ }
  load(1);
});
</script>

<style scoped>
.filter-bar { display: flex; gap: 12px; padding: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.team-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.team-card { padding: 18px; cursor: pointer; display: flex; flex-direction: column; gap: 12px; }
.team-head { display: flex; align-items: center; gap: 12px; }
.team-avatar { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; font-weight: 700; }
.team-info { flex: 1; }
.team-name { font-weight: 700; font-size: 16px; }
.team-slogan { color: #6b7280; font-size: 13px; min-height: 20px; }
.team-meta { display: flex; justify-content: space-between; align-items: center; }
.team-foot { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f0f1f5; padding-top: 12px; }
.pager { display: flex; justify-content: center; margin-top: 24px; }
@media (max-width: 960px) { .team-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
