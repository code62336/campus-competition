<template>
  <div class="page">
    <h2 class="page-title">找老师</h2>
    <p class="page-sub">寻找合适的指导老师，向心仪的老师发出邀请</p>

    <div class="card filter-bar">
      <el-input v-model="query.keyword" placeholder="搜索姓名 / 研究方向" clearable style="width:240px" :prefix-icon="Search" @keyup.enter="load(1)" />
      <el-select v-model="query.college_code" placeholder="学院" clearable style="width:220px" @change="load(1)">
        <el-option v-for="c in colleges" :key="c.code" :label="c.label" :value="c.code" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="load(1)">搜索</el-button>
    </div>

    <div v-loading="loading" class="teacher-grid">
      <div v-for="t in list" :key="t.account_id" class="card teacher-card hoverable">
        <div class="teacher-head">
          <el-avatar :size="56" :src="t.avatar_url || undefined">{{ t.real_name.slice(0, 1) }}</el-avatar>
          <div>
            <div class="teacher-name">{{ t.real_name }} <el-tag size="small" type="success" effect="light">{{ titleLabel(t.title) }}</el-tag></div>
            <div class="text-muted text-xs">{{ t.college_name }} · {{ t.research_fields || '研究方向待完善' }}</div>
          </div>
        </div>
        <div class="teacher-bio">{{ t.bio || '暂无简介' }}</div>
        <div class="teacher-foot">
          <el-tag v-if="t.accept_students" size="small" type="success" effect="plain">接受学生邀请</el-tag>
          <el-tag v-else size="small" type="info" effect="plain">暂不接受邀请</el-tag>
          <div>
            <el-button size="small" @click="viewDetail(t)">主页</el-button>
            <el-button size="small" type="primary" :disabled="!t.accept_students" @click="openInvite(t)">邀请带队</el-button>
          </div>
        </div>
      </div>
    </div>
    <el-empty v-if="!loading && !list.length" description="暂无符合条件的老师" />

    <div class="pager" v-if="total > query.size">
      <el-pagination background layout="prev, pager, next, total" :total="total" :page-size="query.size" :current-page="query.page" @current-change="load" />
    </div>

    <!-- 老师主页 -->
    <el-dialog v-model="detailVisible" :title="detail?.real_name + ' 的主页'" width="520px">
      <div v-if="detail" class="teacher-profile">
        <div class="tp-head">
          <el-avatar :size="64" :src="detail.avatar_url || undefined">{{ detail.real_name.slice(0, 1) }}</el-avatar>
          <div>
            <div class="tp-name">{{ detail.real_name }} · {{ titleLabel(detail.title) }}</div>
            <div class="text-muted text-sm">{{ detail.college_name }}</div>
          </div>
        </div>
        <div class="tp-item"><b>研究方向</b><span>{{ detail.research_fields || '—' }}</span></div>
        <div class="tp-item"><b>带队上限</b><span>{{ detail.max_teams }} 队</span></div>
        <div class="tp-item"><b>可公开邮箱</b><span>{{ detail.email_public || '—' }}</span></div>
        <div class="tp-item"><b>个人简介</b><p class="tp-bio">{{ detail.bio || '—' }}</p></div>
      </div>
    </el-dialog>

    <!-- 邀请弹窗 -->
    <el-dialog v-model="inviteVisible" title="邀请老师带队" width="440px">
      <p class="text-muted text-sm" style="margin-top:0">选择要邀请 {{ inviteTarget?.real_name }} 老师的队伍：</p>
      <el-radio-group v-model="selectedTeamId" class="team-radio">
        <el-radio v-for="t in myLeaderTeams" :key="t.id" :value="t.id" border style="margin-bottom:8px;width:100%">{{ t.name }}（{{ t.competition_title }}）</el-radio>
      </el-radio-group>
      <template #footer>
        <el-button @click="inviteVisible=false">取消</el-button>
        <el-button type="primary" :disabled="!selectedTeamId" @click="doInvite">发送邀请</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Search } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import api from '@/api';
import { useAuthStore } from '@/store/auth';

const auth = useAuthStore();

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const colleges = ref([]);
const query = ref({ keyword: '', college_code: '', page: 1, size: 9 });
const detailVisible = ref(false);
const detail = ref(null);
const inviteVisible = ref(false);
const inviteTarget = ref(null);
const selectedTeamId = ref(null);
const myLeaderTeams = ref([]);

function titleLabel(t) { return { PROF: '教授', APROF: '副教授', LECT: '讲师', ASST: '助教' }[t] || t || '—'; }

async function load(page) {
  query.value.page = page || 1;
  loading.value = true;
  try { const data = await api.listTeachers(query.value); list.value = data.items; total.value = data.total; } finally { loading.value = false; }
}

async function viewDetail(t) { detail.value = t; detailVisible.value = true; }

async function openInvite(t) {
  const teams = await api.myTeams();
  myLeaderTeams.value = teams.filter((x) => x.leader_id === auth.user.id);
  if (!myLeaderTeams.value.length) {
    return ElMessage.warning('你还没有担任队长的队伍，请先建队或成为队长');
  }
  selectedTeamId.value = myLeaderTeams.value[0].id;
  inviteTarget.value = t;
  inviteVisible.value = true;
}

async function doInvite() {
  const team = myLeaderTeams.value.find((x) => x.id === selectedTeamId.value);
  await api.createInvitation({ type: 'STUDENT_INVITE_TEACHER', teamId: team.id, competitionId: team.competition_id, inviteeId: inviteTarget.value.account_id, message: '诚邀您担任我们队伍的指导老师' });
  ElMessage.success('邀请已发出'); inviteVisible.value = false;
}

onMounted(async () => { colleges.value = await api.getDict('COLLEGE'); load(1); });
</script>

<style scoped>
.filter-bar { display: flex; gap: 12px; padding: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.teacher-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
.teacher-card { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.teacher-head { display: flex; align-items: center; gap: 14px; }
.teacher-name { font-weight: 700; font-size: 16px; }
.teacher-bio { color: #6b7280; font-size: 13px; min-height: 40px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.teacher-foot { display: flex; justify-content: space-between; align-items: center; }
.pager { display: flex; justify-content: center; margin-top: 24px; }
.teacher-profile .tp-head { display: flex; gap: 14px; align-items: center; margin-bottom: 16px; }
.tp-name { font-weight: 700; font-size: 17px; }
.tp-item { margin-bottom: 12px; font-size: 14px; }
.tp-item b { display: inline-block; width: 80px; color: #8a8f9e; font-weight: 600; }
.tp-bio { margin: 6px 0 0; color: #3a3f4e; line-height: 1.7; }
.team-radio { display: flex; flex-direction: column; }
@media (max-width: 960px) { .teacher-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
