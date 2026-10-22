<template>
  <div class="page">
    <div class="head-row">
      <div>
        <h2 class="page-title" style="margin:0">赛事管理</h2>
        <p class="page-sub" style="margin:4px 0 0">{{ auth.role === 'ADMIN' ? '管理全校赛事' : '管理我发布的赛事' }}</p>
      </div>
      <el-button type="primary" @click="openCreate"><el-icon><Plus /></el-icon>&nbsp;新建赛事</el-button>
    </div>

    <div class="card filter-bar">
      <el-input v-model="query.keyword" placeholder="搜索名称 / 编码" clearable style="width:220px" :prefix-icon="Search" @keyup.enter="load" />
      <el-select v-model="query.status" placeholder="状态" clearable style="width:140px" @change="load">
        <el-option label="草稿" value="DRAFT" /><el-option label="已发布" value="PUBLISHED" /><el-option label="已下架" value="OFFLINE" /><el-option label="已归档" value="ARCHIVED" />
      </el-select>
      <el-button type="primary" :icon="Search" @click="load">搜索</el-button>
    </div>

    <div class="card" style="padding:16px">
      <el-table :data="list" v-loading="loading">
        <el-table-column label="赛事" min-width="240">
          <template #default="{ row }">
            <div class="cell-title">
              <div class="comp-cover-mini" :style="row.cover_url ? { backgroundImage: `url(${row.cover_url})` } : {}"></div>
              <div>
                <div class="comp-name">{{ row.title }}</div>
                <div class="text-xs text-muted">{{ row.code }}</div>
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="级别" width="90"><template #default="{ row }">{{ row.level === 'SCHOOL' ? '校赛' : '院赛' }}</template></el-table-column>
        <el-table-column label="届次" prop="year" width="80" />
        <el-table-column label="状态" width="100"><template #default="{ row }"><el-tag :type="statusType(row.status)" size="small">{{ statusLabel(row.status) }}</el-tag></template></el-table-column>
        <el-table-column label="组队截止" width="120"><template #default="{ row }">{{ fmt(row.register_end_at) }}</template></el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="openEdit(row)">编辑</el-button>
            <el-button v-if="row.status === 'DRAFT'" size="small" type="success" @click="publish(row)">发布</el-button>
            <el-button v-if="row.status === 'PUBLISHED'" size="small" type="warning" @click="offline(row)">下架</el-button>
            <el-button v-if="row.status !== 'ARCHIVED' && row.status !== 'DRAFT'" size="small" type="info" @click="archive(row)">归档</el-button>
            <el-button v-if="row.status === 'DRAFT'" size="small" type="danger" text @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="pager" v-if="total > query.size">
        <el-pagination background layout="prev, pager, next, total" :total="total" :page-size="query.size" :current-page="query.page" @current-change="onPage" />
      </div>
    </div>

    <!-- 新建/编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="editing ? '编辑赛事' : '新建赛事'" width="720px" top="4vh">
      <el-form :model="form" label-width="100px">
        <el-form-item label="赛事名称" required><el-input v-model="form.title" /></el-form-item>
        <div class="grid-2">
          <el-form-item label="副标题"><el-input v-model="form.subtitle" /></el-form-item>
          <el-form-item label="赛事编码"><el-input v-model="form.code" placeholder="留空自动生成" /></el-form-item>
        </div>
        <div class="grid-3">
          <el-form-item label="级别" required>
            <el-select v-model="form.level" style="width:100%"><el-option label="校赛" value="SCHOOL" /><el-option label="院赛" value="COLLEGE" /></el-select>
          </el-form-item>
          <el-form-item label="所属学院" v-if="form.level === 'COLLEGE'">
            <el-select v-model="form.college_code" style="width:100%"><el-option v-for="c in colleges" :key="c.code" :label="c.label" :value="c.code" /></el-select>
          </el-form-item>
          <el-form-item label="届次年份" required><el-input-number v-model="form.year" :min="2000" :max="2100" style="width:100%" /></el-form-item>
          <el-form-item label="赛事类别">
            <el-select v-model="form.category" style="width:100%"><el-option v-for="c in categories" :key="c.code" :label="c.label" :value="c.code" /></el-select>
          </el-form-item>
        </div>
        <div class="grid-2">
          <el-form-item label="主办单位"><el-input v-model="form.organizer" /></el-form-item>
          <el-form-item label="官网链接"><el-input v-model="form.official_url" /></el-form-item>
        </div>
        <div class="grid-2">
          <el-form-item label="组队开始" required>
            <el-date-picker v-model="form.register_start_at" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width:100%" />
          </el-form-item>
          <el-form-item label="组队截止" required>
            <el-date-picker v-model="form.register_end_at" type="datetime" value-format="YYYY-MM-DD HH:mm:ss" style="width:100%" />
          </el-form-item>
        </div>
        <div class="grid-3">
          <el-form-item label="人数下限"><el-input-number v-model="form.min_team_size" :min="1" :max="20" style="width:100%" /></el-form-item>
          <el-form-item label="人数上限"><el-input-number v-model="form.max_team_size" :min="1" :max="50" style="width:100%" /></el-form-item>
          <el-form-item label="老师上限"><el-input-number v-model="form.max_teacher_count" :min="0" :max="10" style="width:100%" /></el-form-item>
        </div>
        <div class="grid-3">
          <el-form-item label="老师带队上限"><el-input-number v-model="form.max_teams_per_teacher" :min="1" :max="20" style="width:100%" /></el-form-item>
          <el-form-item label="必须指导老师"><el-switch v-model="form.teacher_required" /></el-form-item>
          <el-form-item label="允许跨学院"><el-switch v-model="form.allow_cross_college" /></el-form-item>
        </div>
        <el-form-item label="封面图 URL"><el-input v-model="form.cover_url" placeholder="可填图片链接" /></el-form-item>
        <el-form-item label="赛道设置">
          <div class="track-editor">
            <div v-for="(t, idx) in form.tracks" :key="idx" class="track-row">
              <el-input v-model="t.name" placeholder="赛道名称" style="width:200px" />
              <el-input-number v-model="t.quota" :min="1" placeholder="名额" style="width:110px" />
              <el-switch v-model="t.enabled" active-text="启用" />
              <el-button text type="danger" @click="form.tracks.splice(idx, 1)">删除</el-button>
            </div>
            <el-button size="small" @click="addTrack">+ 添加赛道</el-button>
          </div>
        </el-form-item>
        <el-form-item label="赛事介绍">
          <el-input v-model="form.description_md" type="textarea" :rows="5" placeholder="支持 Markdown" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible=false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { Search } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import api from '@/api';
import { useAuthStore } from '@/store/auth';

const auth = useAuthStore();
const loading = ref(false);
const list = ref([]);
const total = ref(0);
const colleges = ref([]);
const categories = ref([]);
const query = ref({ keyword: '', status: '', page: 1, size: 10 });

const dialogVisible = ref(false);
const editing = ref(null);
const saving = ref(false);
const form = ref({});

function statusLabel(s) { return { DRAFT: '草稿', PUBLISHED: '已发布', OFFLINE: '已下架', ARCHIVED: '已归档' }[s] || s; }
function statusType(s) { return { DRAFT: 'info', PUBLISHED: 'success', OFFLINE: 'warning', ARCHIVED: 'danger' }[s] || 'info'; }
function fmt(d) { return d ? String(d).slice(0, 10) : '—'; }

function emptyForm() {
  return { title: '', subtitle: '', code: '', level: 'SCHOOL', college_code: '', year: new Date().getFullYear(), category: '', organizer: '', official_url: '', register_start_at: '', register_end_at: '', min_team_size: 3, max_team_size: 8, teacher_required: true, max_teacher_count: 2, max_teams_per_teacher: 3, allow_cross_college: true, cover_url: '', description_md: '', tracks: [] };
}
function addTrack() { form.value.tracks.push({ id: Date.now(), name: '', quota: 30, enabled: true }); }

function openCreate() { editing.value = null; form.value = emptyForm(); dialogVisible.value = true; }
function openEdit(row) {
  editing.value = row;
  form.value = {
    ...emptyForm(),
    ...row,
    teacher_required: !!row.teacher_required,
    allow_cross_college: !!row.allow_cross_college,
    tracks: (row.tracks || []).map((t) => ({ ...t, enabled: !!t.enabled })),
  };
  dialogVisible.value = true;
}

async function load(page) {
  query.value.page = page || 1;
  loading.value = true;
  try { const data = await api.listCompetitionsAdmin(query.value); list.value = data.items; total.value = data.total; } finally { loading.value = false; }
}
function onPage(p) { load(p); }

function toPayload(f) {
  return {
    title: f.title, subtitle: f.subtitle, code: f.code, level: f.level, year: f.year,
    collegeCode: f.college_code || null, category: f.category || null, organizer: f.organizer || null,
    officialUrl: f.official_url || null, descriptionMd: f.description_md || null, coverUrl: f.cover_url || null,
    registerStartAt: f.register_start_at, registerEndAt: f.register_end_at,
    minTeamSize: f.min_team_size, maxTeamSize: f.max_team_size,
    teacherRequired: f.teacher_required, maxTeacherCount: f.max_teacher_count,
    maxTeamsPerTeacher: f.max_teams_per_teacher, allowCrossCollege: f.allow_cross_college,
    tracks: f.tracks,
  };
}

async function save() {
  if (!form.value.title || !form.value.level || !form.value.year || !form.value.register_start_at || !form.value.register_end_at) return ElMessage.warning('请完善必填项');
  saving.value = true;
  try {
    const payload = toPayload(form.value);
    if (editing.value) await api.updateCompetition(editing.value.id, payload);
    else await api.createCompetition(payload);
    ElMessage.success('已保存'); dialogVisible.value = false; load();
  } finally { saving.value = false; }
}

async function publish(row) { await ElMessageBox.confirm('发布后学生即可组队，确定发布？', '提示', { type: 'info' }); await api.publishCompetition(row.id); ElMessage.success('已发布'); load(); }
async function offline(row) { await api.offlineCompetition(row.id); ElMessage.success('已下架'); load(); }
async function archive(row) { await api.archiveCompetition(row.id); ElMessage.success('已归档'); load(); }
async function remove(row) { await ElMessageBox.confirm('确定删除该草稿赛事？', '警告', { type: 'warning' }); await api.deleteCompetition(row.id); ElMessage.success('已删除'); load(); }

onMounted(async () => {
  colleges.value = await api.getDict('COLLEGE');
  categories.value = await api.getDict('CATEGORY');
  load(1);
});
</script>

<style scoped>
.head-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.filter-bar { display: flex; gap: 12px; padding: 16px; margin-bottom: 16px; }
.cell-title { display: flex; align-items: center; gap: 10px; }
.comp-cover-mini { width: 48px; height: 34px; border-radius: 6px; background: linear-gradient(135deg, #c7d2fe, #e0e7ff); background-size: cover; background-position: center; }
.comp-name { font-weight: 600; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
.grid-3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 12px; }
.track-editor { width: 100%; display: flex; flex-direction: column; gap: 8px; }
.track-row { display: flex; align-items: center; gap: 10px; }
.pager { display: flex; justify-content: center; margin-top: 16px; }
</style>
