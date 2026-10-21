<template>
  <div class="page">
    <h2 class="page-title">审计日志</h2>
    <p class="page-sub">关键操作留痕，可追溯</p>

    <div class="card filter-bar">
      <el-input v-model="query.operator_id" placeholder="操作人 ID" clearable style="width:160px" @keyup.enter="load" />
      <el-select v-model="query.action" placeholder="操作类型" clearable filterable style="width:220px" @change="load">
        <el-option v-for="a in actions" :key="a" :label="a" :value="a" />
      </el-select>
      <el-button type="primary" @click="load">查询</el-button>
    </div>

    <div class="card" style="padding:16px">
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="created_at" label="时间" width="160" />
        <el-table-column prop="operator_name" label="操作人" width="110" />
        <el-table-column prop="action" label="动作" width="190">
          <template #default="{ row }"><el-tag size="small" effect="plain">{{ row.action }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="module" label="模块" width="90" />
        <el-table-column prop="resource_type" label="资源" width="110" />
        <el-table-column prop="resource_id" label="资源 ID" width="110" />
        <el-table-column prop="ip" label="IP" width="120" />
        <el-table-column label="明细" min-width="200">
          <template #default="{ row }"><span class="text-muted text-xs">{{ JSON.stringify(row.detail_json || {}) }}</span></template>
        </el-table-column>
      </el-table>
      <div class="pager" v-if="total > query.size">
        <el-pagination background layout="prev, pager, next, total" :total="total" :page-size="query.size" :current-page="query.page" @current-change="onPage" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import api from '@/api';

const actions = ['REGISTER', 'LOGIN', 'PASSWORD_CHANGE', 'ACCOUNT_CREATE', 'ACCOUNT_STATUS', 'ACCOUNT_RESET_PASSWORD', 'VERIFICATION_SUBMIT', 'VERIFICATION_REVIEW', 'COMPETITION_CREATE', 'COMPETITION_UPDATE', 'COMPETITION_PUBLISH', 'COMPETITION_OFFLINE', 'COMPETITION_ARCHIVE', 'COMPETITION_DELETE', 'TEAM_CREATE', 'TEAM_DISBAND', 'TEAM_LOCK', 'TEAM_UNLOCK', 'TEAM_TRANSFER_LEADER', 'TEAM_LEAVE', 'TEAM_REMOVE_MEMBER', 'TEAM_ASSIGN_ADVISOR', 'INVITATION_ACCEPT', 'DICT_SAVE', 'DICT_DELETE'];
const loading = ref(false);
const list = ref([]);
const total = ref(0);
const query = ref({ operator_id: '', action: '', page: 1, size: 10 });

async function load(p) {
  query.value.page = p || 1;
  loading.value = true;
  try { const data = await api.listAuditLogs(query.value); list.value = data.items; total.value = data.total; } finally { loading.value = false; }
}
function onPage(p) { load(p); }

onMounted(() => load());
</script>

<style scoped>
.filter-bar { display: flex; gap: 12px; padding: 16px; margin-bottom: 16px; }
.pager { display: flex; justify-content: center; margin-top: 16px; }
</style>
