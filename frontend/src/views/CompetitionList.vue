<template>
  <div class="page">
    <h2 class="page-title">赛事广场</h2>
    <p class="page-sub">发现正在组队报名的高校赛事</p>

    <div class="card filter-bar">
      <el-input v-model="query.keyword" placeholder="搜索赛事名称 / 主办方" clearable style="width:240px" :prefix-icon="Search" @keyup.enter="load(1)" />
      <el-select v-model="query.level" placeholder="赛事级别" clearable style="width:140px" @change="load(1)">
        <el-option label="校级" value="SCHOOL" />
        <el-option label="院级" value="COLLEGE" />
      </el-select>
      <el-select v-model="query.category" placeholder="赛事类别" clearable style="width:180px" @change="load(1)">
        <el-option v-for="c in categories" :key="c.code" :label="c.label" :value="c.code" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="load(1)">搜索</el-button>
    </div>

    <div v-loading="loading" class="comp-grid">
      <div v-for="c in list" :key="c.id" class="card comp-card hoverable" @click="$router.push(`/competitions/${c.id}`)">
        <div class="comp-cover" :style="c.cover_url ? { backgroundImage: `url(${c.cover_url})` } : {}">
          <el-tag size="small" effect="dark" :type="c.level === 'SCHOOL' ? 'danger' : 'warning'">{{ c.level === 'SCHOOL' ? '校赛' : '院赛' }}</el-tag>
        </div>
        <div class="comp-body">
          <div class="comp-title">{{ c.title }}</div>
          <div class="text-muted text-xs mt-8">{{ c.organizer || '主办方待定' }} · {{ c.year }}</div>
          <div class="comp-meta">
            <span class="text-xs text-muted">📅 {{ fmtDate(c.register_end_at) }} 截止</span>
            <span class="text-xs text-muted">👥 {{ c.min_team_size }}-{{ c.max_team_size }} 人/队</span>
          </div>
        </div>
      </div>
    </div>
    <el-empty v-if="!loading && !list.length" description="暂无符合条件的赛事" />

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
const categories = ref([]);
const query = ref({ keyword: '', level: '', category: '', page: 1, size: 12 });

function fmtDate(d) { return d ? String(d).slice(0, 10) : '—'; }

async function load(page) {
  query.value.page = page || 1;
  loading.value = true;
  try {
    const data = await api.listCompetitions(query.value);
    list.value = data.items;
    total.value = data.total;
  } finally {
    loading.value = false;
  }
}

onMounted(async () => {
  categories.value = await api.getDict('CATEGORY');
  load(1);
});
</script>

<style scoped>
.filter-bar { display: flex; gap: 12px; padding: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.comp-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.comp-card { overflow: hidden; cursor: pointer; }
.comp-cover { height: 150px; background: linear-gradient(135deg, #c7d2fe, #e0e7ff); background-size: cover; background-position: center; padding: 12px; }
.comp-body { padding: 16px; }
.comp-title { font-weight: 700; font-size: 16px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 46px; }
.comp-meta { display: flex; justify-content: space-between; margin-top: 12px; }
.pager { display: flex; justify-content: center; margin-top: 24px; }
@media (max-width: 960px) { .comp-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
