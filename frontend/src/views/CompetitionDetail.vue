<template>
  <div class="page" v-if="comp">
    <div class="detail-hero" :style="comp.cover_url ? { backgroundImage: `linear-gradient(120deg, rgba(23,26,43,.9), rgba(79,70,229,.75)), url(${comp.cover_url})` } : {}">
      <div class="hero-inner">
        <div class="hero-tags">
          <el-tag size="small" effect="dark" :type="comp.level === 'SCHOOL' ? 'danger' : 'warning'">{{ comp.level === 'SCHOOL' ? '校赛' : '院赛' }}</el-tag>
          <el-tag size="small" effect="dark" type="info">{{ statusLabel }}</el-tag>
        </div>
        <h1 class="hero-title">{{ comp.title }}</h1>
        <div class="hero-sub">{{ comp.subtitle || '—' }}</div>
        <div class="hero-meta">
          <span>主办：{{ comp.organizer || '待定' }}</span>
          <span>届次：{{ comp.year }} 年</span>
          <span>组队：{{ fmt(comp.register_start_at) }} ~ {{ fmt(comp.register_end_at) }}</span>
        </div>
        <div class="hero-actions">
          <el-button v-if="canCreateTeam" type="warning" size="large" round @click="openCreate"><el-icon><Plus /></el-icon>&nbsp;创建队伍</el-button>
          <el-button v-if="['MANAGER','ADMIN'].includes(auth.role)" size="large" round @click="openBehalf"><el-icon><Plus /></el-icon>&nbsp;代建队伍</el-button>
          <el-button v-if="['MANAGER','ADMIN'].includes(auth.role)" size="large" round @click="loadStat"><el-icon><DataAnalysis /></el-icon>&nbsp;查看统计</el-button>
        </div>
      </div>
    </div>

    <el-row :gutter="20" style="margin-top:20px">
      <el-col :span="16">
        <div class="card block">
          <div class="block-title">赛道设置</div>
          <div class="tracks">
            <div v-for="t in comp.tracks" :key="t.id" class="track-item">
              <div class="track-name">{{ t.name }}</div>
              <el-tag size="small" :type="t.enabled ? 'success' : 'info'">{{ t.enabled ? `名额 ${t.quota}` : '已停用' }}</el-tag>
            </div>
          </div>
        </div>

        <div class="card block">
          <div class="block-title">赛事介绍</div>
          <div class="md-body" v-html="renderMd(comp.description_md || '暂无介绍')"></div>
        </div>
      </el-col>

      <el-col :span="8">
        <div class="card block">
          <div class="block-title">组队规则</div>
          <div class="rule-list">
            <div class="rule-item"><span>队伍人数</span><b>{{ comp.min_team_size }} - {{ comp.max_team_size }} 人</b></div>
            <div class="rule-item"><span>指导老师</span><b>{{ comp.teacher_required ? `需要（≤${comp.max_teacher_count} 名）` : '不强制' }}</b></div>
            <div class="rule-item"><span>老师带队上限</span><b>{{ comp.max_teams_per_teacher }} 队/人</b></div>
            <div class="rule-item"><span>跨学院组队</span><b>{{ comp.allow_cross_college ? '允许' : '不允许' }}</b></div>
            <div class="rule-item"><span>已组建队伍</span><b class="grad-text">{{ comp.teamCount }} 支</b></div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 统计弹窗 -->
    <el-dialog v-model="statVisible" title="赛事统计" width="560px">
      <div v-if="stat" class="stat-box">
        <div class="stat-line">总队伍数：<b>{{ stat.teamCount }}</b>（已锁定 {{ stat.lockedCount }}）</div>
        <div class="stat-sub">赛道分布</div>
        <el-table :data="stat.trackDistribution" size="small">
          <el-table-column prop="trackName" label="赛道" />
          <el-table-column prop="count" label="队伍数" width="100" />
        </el-table>
      </div>
    </el-dialog>

    <!-- 建队弹窗 -->
    <el-dialog v-model="createVisible" title="创建队伍" width="480px">
      <el-form :model="createForm" label-position="top">
        <el-form-item label="队伍名称" required>
          <el-input v-model="createForm.name" placeholder="同赛事内唯一" maxlength="64" />
        </el-form-item>
        <el-form-item label="队伍口号 / 简介">
          <el-input v-model="createForm.slogan" placeholder="用于找队友广场展示" maxlength="200" />
        </el-form-item>
        <el-form-item label="选择赛道">
          <el-select v-model="createForm.trackId" placeholder="请选择" style="width:100%">
            <el-option v-for="t in comp.tracks" :key="t.id" :label="t.name" :value="t.id" :disabled="!t.enabled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="doCreate">创建</el-button>
      </template>
    </el-dialog>

    <!-- 代建弹窗（负责人/管理员） -->
    <el-dialog v-model="behalfVisible" title="代学生创建队伍" width="520px">
      <el-form :model="behalfForm" label-position="top">
        <el-form-item label="队长（学生）" required>
          <el-select v-model="behalfForm.leaderId" filterable remote :remote-method="searchLeader" :loading="leaderSearching" placeholder="输入姓名/学号搜索" style="width:100%">
            <el-option v-for="s in leaderResults" :key="s.account_id" :label="`${s.real_name}（${s.college_name || '—'}）`" :value="s.account_id" />
          </el-select>
        </el-form-item>
        <el-form-item label="队伍名称" required>
          <el-input v-model="behalfForm.name" maxlength="64" />
        </el-form-item>
        <el-form-item label="队伍口号 / 简介">
          <el-input v-model="behalfForm.slogan" maxlength="200" />
        </el-form-item>
        <el-form-item label="赛道">
          <el-select v-model="behalfForm.trackId" placeholder="请选择" style="width:100%">
            <el-option v-for="t in comp.tracks" :key="t.id" :label="t.name" :value="t.id" :disabled="!t.enabled" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="behalfVisible = false">取消</el-button>
        <el-button type="primary" :loading="creating" @click="doBehalf">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '@/api';
import { useAuthStore } from '@/store/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const comp = ref(null);
const stat = ref(null);
const statVisible = ref(false);
const createVisible = ref(false);
const creating = ref(false);
const createForm = ref({ name: '', slogan: '', trackId: null });

const statusLabel = computed(() => ({ PUBLISHED: '报名中', DRAFT: '草稿', OFFLINE: '已下架', ARCHIVED: '已归档' }[comp.value?.status] || comp.value?.status));
const canCreateTeam = computed(() => auth.role === 'STUDENT' && comp.value?.status === 'PUBLISHED' && comp.value?.register_open);

function fmt(d) { return d ? String(d).slice(0, 10) : '—'; }

function escapeHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function renderMd(md) {
  let s = escapeHtml(md);
  s = s.replace(/^### (.*)$/gm, '<h4>$1</h4>');
  s = s.replace(/^## (.*)$/gm, '<h3>$1</h3>');
  s = s.replace(/^# (.*)$/gm, '<h2>$1</h2>');
  s = s.replace(/^- (.*)$/gm, '<li>$1</li>');
  s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\n\n/g, '<br/><br/>');
  return s;
}

function openCreate() { createForm.value = { name: '', slogan: '', trackId: null }; createVisible.value = true; }

const behalfVisible = ref(false);
const behalfForm = ref({ leaderId: null, name: '', slogan: '', trackId: null });
const leaderResults = ref([]);
const leaderSearching = ref(false);

function openBehalf() { behalfForm.value = { leaderId: null, name: '', slogan: '', trackId: null }; leaderResults.value = []; behalfVisible.value = true; searchLeader(''); }
async function searchLeader(kw) {
  leaderSearching.value = true;
  try { leaderResults.value = (await api.searchStudents({ keyword: kw || '', size: 20 })).items; } finally { leaderSearching.value = false; }
}
async function doBehalf() {
  if (!behalfForm.value.leaderId) return ElMessage.warning('请选择队长');
  if (!behalfForm.value.name) return ElMessage.warning('请填写队伍名称');
  creating.value = true;
  try {
    const team = await api.createTeam({ competitionId: comp.value.id, leaderId: behalfForm.value.leaderId, name: behalfForm.value.name, slogan: behalfForm.value.slogan, trackId: behalfForm.value.trackId });
    ElMessage.success('代建队伍成功');
    behalfVisible.value = false;
    router.push(`/teams/${team.id}`);
  } catch (e) { /* ignore */ } finally { creating.value = false; }
}

async function doCreate() {
  if (!createForm.value.name) return ElMessage.warning('请填写队伍名称');
  creating.value = true;
  try {
    const team = await api.createTeam({ competitionId: comp.value.id, ...createForm.value });
    ElMessage.success('队伍创建成功');
    createVisible.value = false;
    router.push(`/teams/${team.id}`);
  } catch (e) { /* ignore */ } finally { creating.value = false; }
}

async function loadStat() { stat.value = await api.getCompetitionStat(comp.value.id); statVisible.value = true; }

onMounted(async () => { comp.value = await api.getCompetition(route.params.id); });
</script>

<style scoped>
.detail-hero { border-radius: 18px; padding: 40px; background-size: cover; background-position: center; color: #fff; }
.hero-inner { max-width: 760px; }
.hero-tags { display: flex; gap: 8px; margin-bottom: 14px; }
.hero-title { margin: 0 0 8px; font-size: 30px; }
.hero-sub { opacity: .9; margin-bottom: 16px; }
.hero-meta { display: flex; gap: 22px; flex-wrap: wrap; opacity: .85; font-size: 14px; margin-bottom: 20px; }
.block { padding: 22px; margin-bottom: 20px; }
.block-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; padding-left: 10px; border-left: 4px solid #4f46e5; }
.tracks { display: flex; flex-direction: column; gap: 12px; }
.track-item { display: flex; justify-content: space-between; align-items: center; padding: 14px 16px; background: #f8f9fc; border-radius: 10px; }
.track-name { font-weight: 600; }
.md-body { line-height: 1.8; color: #3a3f4e; font-size: 14px; }
.md-body :deep(h2), .md-body :deep(h3), .md-body :deep(h4) { margin: 12px 0 8px; }
.md-body :deep(li) { margin: 4px 0; }
.rule-list { display: flex; flex-direction: column; }
.rule-item { display: flex; justify-content: space-between; padding: 11px 0; border-bottom: 1px dashed #eef0f5; font-size: 14px; }
.rule-item:last-child { border-bottom: none; }
.rule-item span { color: #8a8f9e; }
.stat-box .stat-line { font-size: 15px; margin-bottom: 12px; }
.stat-sub { font-weight: 700; margin: 12px 0 8px; }
</style>
