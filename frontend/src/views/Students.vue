<template>
  <div class="page">
    <h2 class="page-title">挑选学生</h2>
    <p class="page-sub">按技能、学院、学历检索学生，邀请优秀学生加入你的队伍</p>

    <div class="card filter-bar">
      <el-input v-model="query.keyword" placeholder="搜索姓名 / 学号" clearable style="width:220px" :prefix-icon="Search" @keyup.enter="load(1)" />
      <el-select v-model="query.college_code" placeholder="学院" clearable style="width:200px" @change="load(1)">
        <el-option v-for="c in colleges" :key="c.code" :label="c.label" :value="c.code" />
      </el-select>
      <el-select v-model="query.degree_level" placeholder="学历" clearable style="width:120px" @change="load(1)">
        <el-option label="本科" value="BACHELOR" />
        <el-option label="硕士" value="MASTER" />
        <el-option label="博士" value="DOCTOR" />
      </el-select>
      <el-select v-model="query.skill" placeholder="技能标签" clearable style="width:150px" @change="load(1)">
        <el-option v-for="s in skillTags" :key="s.code" :label="s.label" :value="s.code" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="load(1)">搜索</el-button>
    </div>

    <div class="card" style="padding:16px">
      <el-table :data="list" v-loading="loading">
        <el-table-column label="姓名" width="140">
          <template #default="{ row }">
            <div class="cell-user">
              <el-avatar :size="32" :src="row.avatar_url || undefined">{{ row.real_name.slice(0, 1) }}</el-avatar>
              <span>{{ row.real_name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="college_name" label="学院" width="180" />
        <el-table-column prop="major_name" label="专业" width="160" />
        <el-table-column label="学历" width="90"><template #default="{ row }">{{ degreeLabel(row.degree_level) }}</template></el-table-column>
        <el-table-column label="技能">
          <template #default="{ row }">
            <el-tag v-for="s in (row.skills || [])" :key="s" size="small" effect="plain" style="margin-right:4px">{{ skillName(s) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <el-tag size="small" :type="row.looking_for_team ? 'success' : 'info'" effect="light">{{ row.looking_for_team ? '在找队伍' : '未公开' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button size="small" type="primary" :disabled="!row.allow_teacher_invite" @click="openInvite(row)">邀请</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager" v-if="total > query.size">
        <el-pagination background layout="prev, pager, next, total" :total="total" :page-size="query.size" :current-page="query.page" @current-change="load" />
      </div>
    </div>

    <!-- 邀请弹窗 -->
    <el-dialog v-model="inviteVisible" title="邀请学生入队" width="440px">
      <p class="text-muted text-sm" style="margin-top:0">邀请 <b>{{ inviteTarget?.real_name }}</b> 加入你指导的队伍：</p>
      <el-select v-model="selectedTeamId" placeholder="选择你指导的队伍" style="width:100%">
        <el-option v-for="t in myTeams" :key="t.id" :label="`${t.name}（${t.competition_title}）`" :value="t.id" />
      </el-select>
      <el-input v-model="inviteMessage" type="textarea" placeholder="留言（可选）" maxlength="500" style="margin-top:12px" />
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

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const colleges = ref([]);
const skillTags = ref([]);
const myTeams = ref([]);
const query = ref({ keyword: '', college_code: '', degree_level: '', skill: '', page: 1, size: 10 });

const inviteVisible = ref(false);
const inviteTarget = ref(null);
const selectedTeamId = ref(null);
const inviteMessage = ref('');

function degreeLabel(d) { return { BACHELOR: '本科', MASTER: '硕士', DOCTOR: '博士' }[d] || d || '—'; }
const skillNameMap = {};
function skillName(code) { return skillNameMap[code] || code; }

async function load(page) {
  query.value.page = page || 1;
  loading.value = true;
  try { const data = await api.searchStudents(query.value); list.value = data.items; total.value = data.total; } finally { loading.value = false; }
}

function openInvite(row) {
  inviteTarget.value = row;
  inviteMessage.value = '';
  if (!myTeams.value.length) return ElMessage.warning('你还没有指导队伍，请先让队伍邀请你担任指导老师');
  selectedTeamId.value = myTeams.value[0].id;
  inviteVisible.value = true;
}
async function doInvite() {
  const team = myTeams.value.find((x) => x.id === selectedTeamId.value);
  await api.createInvitation({ type: 'TEACHER_INVITE_STUDENT', competitionId: team.competition_id, teamId: team.id, inviteeId: inviteTarget.value.account_id, message: inviteMessage.value });
  ElMessage.success('邀请已发出'); inviteVisible.value = false;
}

onMounted(async () => {
  colleges.value = await api.getDict('COLLEGE');
  skillTags.value = await api.getDict('SKILL_TAG');
  skillTags.value.forEach((s) => { skillNameMap[s.code] = s.label; });
  try { myTeams.value = await api.myTeams(); } catch (e) { /* ignore */ }
  load(1);
});
</script>

<style scoped>
.filter-bar { display: flex; gap: 12px; padding: 16px; margin-bottom: 20px; flex-wrap: wrap; }
.cell-user { display: flex; align-items: center; gap: 8px; font-weight: 600; }
.pager { display: flex; justify-content: center; margin-top: 16px; }
</style>
