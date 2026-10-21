<template>
  <div class="page">
    <div class="head-row">
      <div><h2 class="page-title" style="margin:0">字典管理</h2><p class="page-sub" style="margin:4px 0 0">管理学院、专业、技能标签、职称等字典数据</p></div>
      <el-button type="primary" @click="openCreate"><el-icon><Plus /></el-icon>&nbsp;新增项</el-button>
    </div>

    <div class="card" style="padding:16px">
      <el-tabs v-model="activeType" @tab-change="load">
        <el-tab-pane v-for="t in dictTypes" :key="t.code" :label="t.label" :name="t.code" />
      </el-tabs>
      <el-table :data="list" v-loading="loading">
        <el-table-column prop="code" label="编码" width="160" />
        <el-table-column prop="label" label="名称" />
        <el-table-column prop="sort" label="排序" width="80" />
        <el-table-column label="启用" width="80"><template #default="{ row }"><el-tag size="small" :type="row.enabled ? 'success' : 'info'">{{ row.enabled ? '启用' : '停用' }}</el-tag></template></el-table-column>
        <el-table-column label="操作" width="140">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" text @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <el-dialog v-model="dialogVisible" :title="editing ? '编辑字典项' : '新增字典项'" width="440px">
      <el-form :model="form" label-width="70px">
        <el-form-item label="编码"><el-input v-model="form.code" /></el-form-item>
        <el-form-item label="名称"><el-input v-model="form.label" /></el-form-item>
        <el-form-item label="排序"><el-input-number v-model="form.sort" :min="0" /></el-form-item>
        <el-form-item label="父编码"><el-input v-model="form.parentCode" placeholder="专业归属学院时填写" /></el-form-item>
        <el-form-item label="启用"><el-switch v-model="form.enabled" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" @click="save">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/api';

const dictTypes = [
  { code: 'COLLEGE', label: '学院' }, { code: 'MAJOR', label: '专业' }, { code: 'SKILL_TAG', label: '技能标签' }, { code: 'TITLE', label: '职称' }, { code: 'CATEGORY', label: '赛事类别' },
];
const activeType = ref('COLLEGE');
const loading = ref(false);
const list = ref([]);
const dialogVisible = ref(false);
const editing = ref(null);
const form = ref({ code: '', label: '', sort: 0, parentCode: '', enabled: true });

async function load() {
  loading.value = true;
  try { list.value = await api.listDicts(activeType.value); } finally { loading.value = false; }
}
function openCreate() { editing.value = null; form.value = { code: '', label: '', sort: 0, parentCode: '', enabled: true }; dialogVisible.value = true; }
function openEdit(row) { editing.value = row; form.value = { code: row.code, label: row.label, sort: row.sort, parentCode: row.parent_code || '', enabled: !!row.enabled }; dialogVisible.value = true; }

async function save() {
  if (!form.value.code || !form.value.label) return ElMessage.warning('请填写编码和名称');
  await api.saveDict({ id: editing.value?.id, type: activeType.value, code: form.value.code, label: form.value.label, sort: form.value.sort, parentCode: form.value.parentCode, enabled: form.value.enabled });
  ElMessage.success('已保存'); dialogVisible.value = false; load();
}
async function remove(row) {
  await ElMessageBox.confirm(`确定删除「${row.label}」？`, '警告', { type: 'warning' });
  await api.deleteDict(row.id); ElMessage.success('已删除'); load();
}

onMounted(load);
</script>

<style scoped>
.head-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
</style>
