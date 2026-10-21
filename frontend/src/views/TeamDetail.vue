<template>
  <div class="page" v-if="team">
    <div class="hero card">
      <div class="hero-left">
        <el-avatar :size="60" class="big-avatar">{{ team.name.slice(0, 1) }}</el-avatar>
        <div>
          <div class="title-row">
            <h2 class="team-name">{{ team.name }}</h2>
            <el-tag size="small" :type="statusType" effect="light">{{ statusLabel }}</el-tag>
          </div>
          <div class="text-muted text-sm">{{ team.competition_title }} · {{ team.slogan || '暂无口号' }}</div>
        </div>
      </div>
      <div class="hero-right">
        <el-button v-if="actions.isLeader || actions.isManager" @click="openEdit">编辑信息</el-button>
        <el-button v-if="actions.isLeader" @click="openInviteMember">邀请队友</el-button>
        <el-button v-if="actions.isLeader" @click="openInviteTeacher">邀请老师</el-button>
        <el-button v-if="actions.canAssignAdvisor" @click="openAssignAdvisor">分配老师</el-button>
        <el-button v-if="actions.isManager && team.status !== 'LOCKED'" @click="doLock">锁定队伍</el-button>
        <el-button v-if="actions.isManager && team.status === 'LOCKED'" @click="doUnlock">解锁队伍</el-button>
        <el-button v-if="actions.isMember && !actions.isLeader" type="danger" plain @click="doLeave">退出队伍</el-button>
        <el-button v-if="actions.isAdvisor && !actions.isMember" type="danger" plain @click="doLeave">退出指导</el-button>
        <el-button v-if="!actions.isMember && !actions.isAdvisor && !actions.isManager && auth.role==='STUDENT' && team.status==='RECRUITING'" type="primary" @click="openApply">申请加入</el-button>
        <el-button v-if="actions.canDisband" type="danger" plain @click="doDisband">解散队伍</el-button>
      </div>
    </div>

    <div class="stat-strip">
      <div class="stat-item"><div class="mono">{{ team.member_count }} / {{ team.max_members }}</div><div class="text-muted text-xs">队员</div></div>
      <div class="stat-item"><div class="mono">{{ advisorCount }}</div><div class="text-muted text-xs">指导老师</div></div>
      <div class="stat-item"><div class="mono">{{ trackName }}</div><div class="text-muted text-xs">赛道</div></div>
      <div class="stat-item"><div class="mono">{{ team.college_name || '—' }}</div><div class="text-muted text-xs">归属学院</div></div>
    </div>

    <div class="section-title">队伍成员</div>
    <div class="member-grid">
      <div v-for="m in team.members" :key="m.id" class="card member-card">
        <div class="member-top">
          <el-avatar :size="44" :src="m.avatar_url || undefined">{{ (m.real_name || '?').slice(0, 1) }}</el-avatar>
          <el-tag size="small" :type="roleTagType(m.role)" effect="light">{{ roleLabel(m.role) }}</el-tag>
        </div>
        <div class="member-name">{{ m.real_name || '未填写' }}</div>
        <div class="text-muted text-xs">{{ m.college_name || '—' }}{{ m.degree_level ? ' · ' + degreeLabel(m.degree_level) : '' }}</div>
        <div class="text-muted text-xs" v-if="m.role !== 'ADVISOR'">{{ m.student_no || '' }}</div>
        <div class="text-muted text-xs" v-if="m.role === 'ADVISOR'">{{ m.title ? titleLabel(m.title) : '教师' }}</div>
        <div class="member-actions" v-if="canManageMember(m)">
          <el-button v-if="actions.canTransfer && m.role === 'MEMBER'" size="small" text type="primary" @click="doTransfer(m)">转让队长</el-button>
          <el-button size="small" text type="danger" @click="doRemove(m)">移除</el-button>
        </div>
      </div>
    </div>

    <!-- 入队申请（队长/负责人） -->
    <template v-if="actions.isLeader || actions.isManager">
      <div class="section-title">入队申请</div>
      <div class="card" style="padding:16px">
        <el-table :data="joinRequests" size="default" v-if="joinRequests.length">
          <el-table-column label="申请人"><template #default="{ row }">{{ row.inviter_name }}（{{ row.college_name || '—' }}）</template></el-table-column>
          <el-table-column label="留言" prop="message" show-overflow-tooltip />
          <el-table-column label="申请时间" width="150"><template #default="{ row }">{{ fmt(row.created_at) }}</template></el-table-column>
          <el-table-column label="操作" width="160">
            <template #default="{ row }">
              <el-button size="small" type="primary" @click="approve(row)">通过</el-button>
              <el-button size="small" @click="reject(row)">驳回</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-else description="暂无入队申请" :image-size="60" />
      </div>
    </template>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="editVisible" title="编辑队伍" width="440px">
      <el-form label-position="top">
        <el-form-item label="队伍名称"><el-input v-model="editForm.name" maxlength="64" /></el-form-item>
        <el-form-item label="口号 / 简介"><el-input v-model="editForm.slogan" type="textarea" maxlength="200" /></el-form-item>
        <el-form-item label="是否在广场招募"><el-switch v-model="editForm.recruiting" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="editVisible=false">取消</el-button><el-button type="primary" @click="doEdit">保存</el-button></template>
    </el-dialog>

    <!-- 邀请队友弹窗 -->
    <el-dialog v-model="inviteMemberVisible" title="邀请队友" width="640px">
      <el-input v-model="studentSearch" placeholder="搜索姓名 / 学号" clearable style="margin-bottom:12px" @keyup.enter="searchStudents" />
      <el-table :data="studentResults" size="small" v-loading="searching">
        <el-table-column prop="real_name" label="姓名" />
        <el-table-column prop="college_name" label="学院" />
        <el-table-column prop="degree_level" label="学历" :formatter="(r) => degreeLabel(r.degree_level)" />
        <el-table-column label="操作" width="90"><template #default="{ row }"><el-button size="small" type="primary" @click="inviteMember(row)">邀请</el-button></template></el-table-column>
      </el-table>
    </el-dialog>

    <!-- 邀请/分配老师弹窗 -->
    <el-dialog v-model="teacherVisible" :title="teacherMode === 'assign' ? '分配指导老师' : '邀请指导老师'" width="640px">
      <el-input v-model="teacherSearch" placeholder="搜索姓名 / 研究方向" clearable style="margin-bottom:12px" @keyup.enter="searchTeachers" />
      <el-table :data="teacherResults" size="small" v-loading="searching">
        <el-table-column prop="real_name" label="姓名" />
        <el-table-column prop="college_name" label="学院" />
        <el-table-column prop="title" label="职称" :formatter="(r) => titleLabel(r.title)" />
        <el-table-column prop="research_fields" label="研究方向" show-overflow-tooltip />
        <el-table-column label="操作" width="90"><template #default="{ row }"><el-button size="small" type="primary" @click="chooseTeacher(row)">{{ teacherMode === 'assign' ? '分配' : '邀请' }}</el-button></template></el-table-column>
      </el-table>
    </el-dialog>

    <!-- 申请加入弹窗 -->
    <el-dialog v-model="applyVisible" title="申请加入队伍" width="440px">
      <el-form label-position="top">
        <el-form-item label="申请理由"><el-input v-model="applyMessage" type="textarea" placeholder="介绍一下自己，提高通过率" maxlength="500" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="applyVisible=false">取消</el-button><el-button type="primary" @click="doApply">提交申请</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/api';
import { useAuthStore } from '@/store/auth';

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const team = ref(null);
const joinRequests = ref([]);

const editVisible = ref(false);
const editForm = ref({ name: '', slogan: '', recruiting: true });
const inviteMemberVisible = ref(false);
const studentSearch = ref('');
const studentResults = ref([]);
const teacherVisible = ref(false);
const teacherMode = ref('invite');
const teacherSearch = ref('');
const teacherResults = ref([]);
const searching = ref(false);
const applyVisible = ref(false);
const applyMessage = ref('');

const actions = computed(() => team.value?.actions || {});
const advisorCount = computed(() => team.value?.members.filter((m) => m.role === 'ADVISOR' && m.status === 'ACTIVE').length || 0);
const trackName = computed(() => team.value?.track_id ? `赛道 #${team.value.track_id}` : '未选赛道');
const statusLabel = computed(() => ({ RECRUITING: '招募中', LOCKED: '已锁定', DISBANDED: '已解散' }[team.value?.status] || team.value?.status));
const statusType = computed(() => ({ RECRUITING: 'success', LOCKED: 'warning', DISBANDED: 'info' }[team.value?.status] || 'info'));

function roleLabel(r) { return { LEADER: '队长', MEMBER: '队员', ADVISOR: '指导老师' }[r] || r; }
function roleTagType(r) { return { LEADER: 'danger', MEMBER: 'primary', ADVISOR: 'success' }[r] || 'info'; }
function degreeLabel(d) { return { BACHELOR: '本科', MASTER: '硕士', DOCTOR: '博士' }[d] || d || '—'; }
function titleLabel(t) { return { PROF: '教授', APROF: '副教授', LECT: '讲师', ASST: '助教' }[t] || t || '—'; }
function fmt(d) { return d ? String(d).slice(0, 16).replace('T', ' ') : '—'; }

function canManageMember(m) {
  if (m.role === 'LEADER') return false;
  return actions.value.isLeader || actions.value.isManager;
}

async function reload() { team.value = await api.getTeam(route.params.id); }
async function loadJoinRequests() {
  if (actions.value.isLeader || actions.value.isManager) {
    try { joinRequests.value = (await api.listJoinRequests()).items; } catch (e) { /* ignore */ }
  }
}

function openEdit() { editForm.value = { name: team.value.name, slogan: team.value.slogan, recruiting: !!team.value.recruiting }; editVisible.value = true; }
async function doEdit() { await api.updateTeam(team.value.id, editForm.value); ElMessage.success('已保存'); editVisible.value = false; reload(); }

async function doDisband() {
  await ElMessageBox.confirm('解散后队伍不可恢复，确定解散？', '警告', { type: 'warning' });
  await api.disbandTeam(team.value.id); ElMessage.success('已解散'); router.push('/my-teams');
}
async function doLock() { await ElMessageBox.confirm('锁定后成员不可变更，确定锁定？', '提示', { type: 'warning' }); await api.lockTeam(team.value.id); ElMessage.success('已锁定'); reload(); }
async function doUnlock() { await api.unlockTeam(team.value.id); ElMessage.success('已解锁'); reload(); }
async function doLeave() {
  await ElMessageBox.confirm('确定退出该队伍？', '提示', { type: 'warning' });
  await api.leaveTeam(team.value.id); ElMessage.success('已退出'); reload();
}
async function doTransfer(m) {
  await ElMessageBox.confirm(`确定将队长转让给 ${m.real_name}？`, '提示', { type: 'warning' });
  await api.transferLeader(team.value.id, m.account_id); ElMessage.success('已转让'); reload();
}
async function doRemove(m) {
  await ElMessageBox.confirm(`确定移除 ${m.real_name}？`, '提示', { type: 'warning' });
  await api.removeMember(team.value.id, m.account_id); ElMessage.success('已移除'); reload();
}

function openInviteMember() { studentSearch.value = ''; studentResults.value = []; inviteMemberVisible.value = true; searchStudents(); }
async function searchStudents() {
  searching.value = true;
  try { studentResults.value = (await api.searchStudents({ keyword: studentSearch.value, size: 20 })).items; } finally { searching.value = false; }
}
async function inviteMember(row) {
  await api.createInvitation({ type: 'TEAM_INVITE_MEMBER', teamId: team.value.id, competitionId: team.value.competition_id, inviteeId: row.account_id, message: '欢迎加入我们的队伍！' });
  ElMessage.success('邀请已发出'); inviteMemberVisible.value = false;
}

function openInviteTeacher() { teacherMode.value = 'invite'; teacherSearch.value = ''; teacherResults.value = []; teacherVisible.value = true; searchTeachers(); }
function openAssignAdvisor() { teacherMode.value = 'assign'; teacherSearch.value = ''; teacherResults.value = []; teacherVisible.value = true; searchTeachers(); }
async function searchTeachers() {
  searching.value = true;
  try { teacherResults.value = (await api.listTeachers({ keyword: teacherSearch.value, size: 20 })).items; } finally { searching.value = false; }
}
async function chooseTeacher(row) {
  if (teacherMode.value === 'assign') await api.assignAdvisor(team.value.id, row.account_id);
  else await api.createInvitation({ type: 'STUDENT_INVITE_TEACHER', teamId: team.value.id, competitionId: team.value.competition_id, inviteeId: row.account_id, message: '诚邀您担任指导老师' });
  ElMessage.success(teacherMode.value === 'assign' ? '已分配' : '邀请已发出'); teacherVisible.value = false; reload();
}

function openApply() { applyMessage.value = ''; applyVisible.value = true; }
async function doApply() { await api.createJoinRequest({ teamId: team.value.id, message: applyMessage.value }); ElMessage.success('申请已提交'); applyVisible.value = false; }

async function approve(row) { await api.approveJoinRequest(row.id); ElMessage.success('已通过'); loadJoinRequests(); reload(); }
async function reject(row) {
  await api.rejectJoinRequest(row.id, ''); ElMessage.success('已驳回'); loadJoinRequests();
}

onMounted(async () => { await reload(); loadJoinRequests(); });
</script>

<style scoped>
.hero { display: flex; align-items: center; justify-content: space-between; padding: 24px; flex-wrap: wrap; gap: 16px; }
.hero-left { display: flex; align-items: center; gap: 16px; }
.big-avatar { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #fff; font-weight: 800; font-size: 24px; }
.title-row { display: flex; align-items: center; gap: 10px; }
.team-name { margin: 0; font-size: 24px; }
.hero-right { display: flex; flex-wrap: wrap; gap: 8px; }

.stat-strip { display: flex; gap: 24px; background: #fff; border-radius: 14px; padding: 18px 24px; margin: 20px 0; box-shadow: 0 1px 3px rgba(16,24,40,.06); }
.stat-item .mono { font-weight: 800; font-size: 16px; }

.section-title { font-size: 16px; font-weight: 700; margin: 22px 0 14px; }
.member-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; }
.member-card { padding: 18px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
.member-top { display: flex; align-items: center; gap: 8px; width: 100%; justify-content: center; }
.member-name { font-weight: 700; }
.member-actions { display: flex; gap: 4px; margin-top: 4px; }
@media (max-width: 960px) { .member-grid { grid-template-columns: repeat(2, 1fr); } }
</style>
