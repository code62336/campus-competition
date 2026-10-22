<template>
  <div class="page">
    <div class="head-row">
      <div><h2 class="page-title" style="margin:0">用户管理</h2><p class="page-sub" style="margin:4px 0 0">管理平台全部账号</p></div>
      <el-button type="primary" @click="openCreate"><el-icon><Plus /></el-icon>&nbsp;新增用户</el-button>
    </div>

    <div class="card filter-bar">
      <el-input v-model="query.keyword" placeholder="搜索用户名/姓名/学号" clearable style="width:240px" :prefix-icon="Search" @keyup.enter="load" />
      <el-select v-model="query.user_type" placeholder="类型" clearable style="width:140px" @change="load">
        <el-option label="学生" value="STUDENT" /><el-option label="教师" value="TEACHER" /><el-option label="负责人" value="MANAGER" /><el-option label="管理员" value="ADMIN" />
      </el-select>
      <el-select v-model="query.status" placeholder="状态" clearable style="width:120px" @change="load">
        <el-option label="正常" value="ACTIVE" /><el-option label="禁用" value="DISABLED" /><el-option label="锁定" value="LOCKED" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="load">搜索</el-button>
    </div>

    <div class="card" style="padding:16px">
      <el-table :data="list" v-loading="loading">
        <el-table-column label="用户" min-width="180">
          <template #default="{ row }">
            <div class="cell-user"><el-avatar :size="32" :src="row.avatar_url || undefined">{{ (row.display_name || '?').slice(0, 1) }}</el-avatar>
              <div><div>{{ row.display_name }}</div><div class="text-xs text-muted">{{ row.username }}</div></div></div>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100"><template #default="{ row }"><el-tag size="small" effect="plain">{{ roleLabel(row.user_type) }}</el-tag></template></el-table-column>
        <el-table-column label="学院" prop="college_name" width="170" />
        <el-table-column label="认证" width="90"><template #default="{ row }"><el-tag size="small" :type="row.verify_status === 'VERIFIED' ? 'success' : 'info'">{{ row.verify_status === 'VERIFIED' ? '已认证' : '未认证' }}</el-tag></template></el-table-column>
        <el-table-column label="状态" width="90"><template #default="{ row }"><el-tag size="small" :type="statusType(row.status)">{{ statusLabel(row.status) }}</el-tag></template></el-table-column>
        <el-table-column label="最近登录" width="150"><template #default="{ row }">{{ fmt(row.last_login_at) }}</template></el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button v-if="row.status === 'ACTIVE'" size="small" type="danger" @click="setStatus(row, 'DISABLED')">禁用</el-button>
            <el-button v-else size="small" type="success" @click="setStatus(row, 'ACTIVE')">启用</el-button>
            <el-button size="small" @click="resetPwd(row)">重置密码</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager" v-if="total > query.size">
        <el-pagination background layout="prev, pager, next, total" :total="total" :page-size="query.size" :current-page="query.page" @current-change="onPage" />
      </div>
    </div>

    <el-dialog v-model="dialogVisible" title="新增用户" width="480px">
      <el-form :model="form" label-width="80px">
        <el-form-item label="类型"><el-radio-group v-model="form.userType"><el-radio-button value="STUDENT">学生</el-radio-button><el-radio-button value="TEACHER">教师</el-radio-button><el-radio-button value="MANAGER">负责人</el-radio-button><el-radio-button value="ADMIN">管理员</el-radio-button></el-radio-group></el-form-item>
        <el-form-item label="用户名"><el-input v-model="form.username" /></el-form-item>
        <el-form-item label="密码"><el-input v-model="form.password" type="password" show-password placeholder="至少 6 位" /></el-form-item>
        <el-form-item label="姓名"><el-input v-model="form.realName" /></el-form-item>
        <el-form-item v-if="['STUDENT','TEACHER'].includes(form.userType)" label="学号/工号"><el-input v-model="form.no" /></el-form-item>
        <el-form-item v-if="['STUDENT','TEACHER'].includes(form.userType)" label="学院">
          <el-select v-model="form.collegeCode" style="width:100%"><el-option v-for="c in colleges" :key="c.code" :label="c.label" :value="c.code" /></el-select>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" @click="create">创建</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Search } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/api';

const loading = ref(false);
const list = ref([]);
const total = ref(0);
const colleges = ref([]);
const query = ref({ keyword: '', user_type: '', status: '', page: 1, size: 10 });
const dialogVisible = ref(false);
const form = ref({ userType: 'STUDENT', username: '', password: '', realName: '', no: '', collegeCode: '' });

function roleLabel(t) { return { STUDENT: '学生', TEACHER: '教师', MANAGER: '负责人', ADMIN: '管理员' }[t] || t; }
function statusLabel(s) { return { ACTIVE: '正常', DISABLED: '禁用', LOCKED: '锁定' }[s] || s; }
function statusType(s) { return { ACTIVE: 'success', DISABLED: 'danger', LOCKED: 'warning' }[s] || 'info'; }
function fmt(d) { return d ? String(d).slice(0, 16).replace('T', ' ') : '—'; }

async function load(p) {
  query.value.page = p || 1;
  loading.value = true;
  try { const data = await api.listUsers(query.value); list.value = data.items; total.value = data.total; } finally { loading.value = false; }
}
function onPage(p) { load(p); }

async function setStatus(row, status) {
  await ElMessageBox.confirm(`确定${status === 'DISABLED' ? '禁用' : '启用'}用户 ${row.display_name}？`, '提示', { type: 'warning' });
  await api.setUserStatus(row.id, status); ElMessage.success('已更新'); load();
}
async function resetPwd(row) {
  const { value } = await ElMessageBox.prompt('请输入新密码（至少 6 位）', '重置密码', { inputValue: '', inputPattern: /^.{6,}$/, inputErrorMessage: '至少 6 位' });
  await api.resetUserPassword(row.id, value); ElMessage.success('密码已重置');
}

function openCreate() { form.value = { userType: 'STUDENT', username: '', password: '', realName: '', no: '', collegeCode: '' }; dialogVisible.value = true; }
async function create() {
  if (!form.value.username || !form.value.password || !form.value.realName) return ElMessage.warning('请填写用户名、密码、姓名');
  const payload = { username: form.value.username, password: form.value.password, userType: form.value.userType, realName: form.value.realName, collegeCode: form.value.collegeCode };
  if (form.value.userType === 'STUDENT') payload.studentNo = form.value.no;
  else if (form.value.userType === 'TEACHER') payload.teacherNo = form.value.no;
  await api.createUser(payload);
  ElMessage.success('已创建'); dialogVisible.value = false; load();
}

onMounted(async () => { colleges.value = await api.getDict('COLLEGE'); load(); });
</script>

<style scoped>
.head-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.filter-bar { display: flex; gap: 12px; padding: 16px; margin-bottom: 16px; flex-wrap: wrap; }
.cell-user { display: flex; align-items: center; gap: 10px; }
.pager { display: flex; justify-content: center; margin-top: 16px; }
</style>
