<template>
  <div class="page">
    <h2 class="page-title">认证审核</h2>
    <p class="page-sub">审核学生与教师的身份资质认证</p>

    <div class="card filter-bar">
      <el-radio-group v-model="query.status" @change="load">
        <el-radio-button value="">全部</el-radio-button>
        <el-radio-button value="PENDING_REVIEW">待审核</el-radio-button>
        <el-radio-button value="VERIFIED">已通过</el-radio-button>
        <el-radio-button value="REJECTED">已驳回</el-radio-button>
      </el-radio-group>
    </div>

    <div class="card" style="padding:16px">
      <el-table :data="list" v-loading="loading">
        <el-table-column label="用户" width="200">
          <template #default="{ row }">
            <div class="cell-user"><el-avatar :size="30" :src="row.avatar_url || undefined">{{ (row.display_name || '?').slice(0, 1) }}</el-avatar>
              <div><div>{{ row.display_name }}</div><div class="text-xs text-muted">{{ row.username }}</div></div></div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="90"><template #default="{ row }">{{ row.user_type === 'STUDENT' ? '学生' : '教师' }}</template></el-table-column>
        <el-table-column label="学院" prop="college_name" width="180" />
        <el-table-column label="学号/工号" width="130"><template #default="{ row }">{{ row.student_no || row.teacher_no || '—' }}</template></el-table-column>
        <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag></template></el-table-column>
        <el-table-column label="提交时间" width="150"><template #default="{ row }">{{ fmt(row.created_at) }}</template></el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <template v-if="row.status === 'PENDING_REVIEW'">
              <el-button size="small" type="success" @click="review(row, 'VERIFIED')">通过</el-button>
              <el-button size="small" type="danger" @click="review(row, 'REJECTED')">驳回</el-button>
            </template>
            <span v-else class="text-xs text-muted">{{ row.reason || '—' }}</span>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager" v-if="total > size">
        <el-pagination background layout="prev, pager, next, total" :total="total" :page-size="size" :current-page="page" @current-change="onPage" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/api';

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const page = ref(1);
const size = 10;
const query = ref({ status: '' });

function statusLabel(s) { return { UNVERIFIED: '未提交', PENDING_REVIEW: '待审核', VERIFIED: '已通过', REJECTED: '已驳回' }[s] || s; }
function statusType(s) { return { PENDING_REVIEW: 'warning', VERIFIED: 'success', REJECTED: 'danger' }[s] || 'info'; }
function fmt(d) { return d ? String(d).slice(0, 16).replace('T', ' ') : '—'; }

async function load(p) {
  page.value = p || 1;
  loading.value = true;
  try { const data = await api.listVerifications({ status: query.value.status, page: page.value, size }); list.value = data.items; total.value = data.total; } finally { loading.value = false; }
}
function onPage(p) { load(p); }

async function review(row, status) {
  let reason = '';
  if (status === 'REJECTED') {
    const { value } = await ElMessageBox.prompt('请输入驳回原因', '驳回认证', { inputValue: '', confirmButtonText: '驳回', cancelButtonText: '取消' });
    if (!value) return; reason = value;
  } else {
    await ElMessageBox.confirm(`确认通过 ${row.display_name} 的认证？`, '提示', { type: 'info' });
  }
  await api.reviewVerification(row.id, { status, reason });
  ElMessage.success('已处理'); load();
}

onMounted(() => load());
</script>

<style scoped>
.filter-bar { padding: 16px; margin-bottom: 16px; }
.cell-user { display: flex; align-items: center; gap: 10px; }
.pager { display: flex; justify-content: center; margin-top: 16px; }
</style>
