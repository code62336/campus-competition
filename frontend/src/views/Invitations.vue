<template>
  <div class="page">
    <h2 class="page-title">我的邀请</h2>
    <p class="page-sub">处理收到的邀请与入队申请，管理发出的邀请</p>

    <el-tabs v-model="tab" @tab-change="load">
      <el-tab-pane label="收到的" name="in" />
      <el-tab-pane label="发出的" name="out" />
    </el-tabs>

    <div class="card" style="padding:8px 16px">
      <div v-for="i in list" :key="i.id" class="inv-item">
        <div class="inv-main">
          <el-avatar :size="40" :style="{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }">
            <el-icon><Message /></el-icon>
          </el-avatar>
          <div class="flex-1">
            <div class="inv-title">
              <b>{{ typeLabel(i.type) }}</b>
              <el-tag size="small" :type="statusType(i.status)" effect="light">{{ statusLabel(i.status) }}</el-tag>
            </div>
            <div class="text-muted text-sm">
              <template v-if="tab === 'in'">{{ i.inviter_name }} → 你</template>
              <template v-else>你 → {{ i.invitee_name }}</template>
              <span v-if="i.team_name"> · {{ i.team_name }}</span>
              <span v-if="i.competition_title"> · {{ i.competition_title }}</span>
            </div>
            <div v-if="i.message" class="inv-msg">"{{ i.message }}"</div>
          </div>
        </div>
        <div class="inv-actions">
          <template v-if="i.status === 'PENDING' && tab === 'in'">
            <el-button size="small" type="primary" @click="accept(i)">接受</el-button>
            <el-button size="small" @click="reject(i)">拒绝</el-button>
          </template>
          <template v-if="i.status === 'PENDING' && tab === 'out'">
            <el-button size="small" text type="danger" @click="cancel(i)">撤回</el-button>
          </template>
        </div>
      </div>
      <el-empty v-if="!list.length" description="暂无邀请" :image-size="70" />
    </div>

    <div class="pager" v-if="total > size">
      <el-pagination background layout="prev, pager, next, total" :total="total" :page-size="size" :current-page="page" @current-change="onPage" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/api';

const tab = ref('in');
const list = ref([]);
const total = ref(0);
const page = ref(1);
const size = 10;

function typeLabel(t) {
  return { TEAM_INVITE_MEMBER: '邀请入队', STUDENT_INVITE_TEACHER: '邀请指导老师', TEACHER_INVITE_STUDENT: '邀请加入队伍', STUDENT_APPLY_JOIN: '入队申请' }[t] || t;
}
const statusMap = { PENDING: '待处理', ACCEPTED: '已接受', REJECTED: '已拒绝', EXPIRED: '已过期', CANCELLED: '已撤回' };
function statusLabel(s) { return statusMap[s] || s; }
function statusType(s) { return { PENDING: 'warning', ACCEPTED: 'success', REJECTED: 'danger', EXPIRED: 'info', CANCELLED: 'info' }[s] || 'info'; }

async function load() {
  const data = await api.listInvitations({ direction: tab.value, page: page.value, size });
  list.value = data.items;
  total.value = data.total;
}
function onPage(p) { page.value = p; load(); }

async function accept(i) {
  await api.acceptInvitation(i.id);
  ElMessage.success('已接受'); load();
}
async function reject(i) {
  const { value } = await ElMessageBox.prompt('请输入拒绝原因（可选）', '拒绝邀请', { inputValue: '', confirmButtonText: '拒绝', cancelButtonText: '取消' });
  await api.rejectInvitation(i.id, value || ''); ElMessage.success('已拒绝'); load();
}
async function cancel(i) {
  await ElMessageBox.confirm('确定撤回该邀请？', '提示', { type: 'warning' });
  await api.cancelInvitation(i.id); ElMessage.success('已撤回'); load();
}

onMounted(load);
</script>

<style scoped>
.inv-item { display: flex; align-items: center; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid #f0f1f5; gap: 16px; }
.inv-item:last-child { border-bottom: none; }
.inv-main { display: flex; gap: 14px; flex: 1; }
.flex-1 { flex: 1; }
.inv-title { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.inv-msg { color: #6b7280; font-size: 13px; font-style: italic; margin-top: 4px; }
.inv-actions { display: flex; gap: 6px; }
.pager { display: flex; justify-content: center; margin-top: 20px; }
</style>
