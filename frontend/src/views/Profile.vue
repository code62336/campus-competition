<template>
  <div class="page">
    <h2 class="page-title">个人中心</h2>
    <p class="page-sub">完善个人档案，管理账号与身份认证</p>

    <el-row :gutter="20">
      <el-col :span="8">
        <div class="card profile-card">
          <div class="avatar-wrap">
            <el-avatar :size="88" :src="profile?.avatar_url || undefined">{{ (auth.displayName || '?').slice(0, 1) }}</el-avatar>
            <el-upload :show-file-list="false" :http-request="uploadAvatar" accept="image/*">
              <el-button size="small" circle class="avatar-edit"><el-icon><Camera /></el-icon></el-button>
            </el-upload>
          </div>
          <div class="p-name">{{ auth.displayName }}</div>
          <div class="text-muted text-sm">{{ auth.username }} · {{ auth.roleLabel }}</div>
          <el-tag :type="verifyTagType" effect="light" style="margin-top:10px">{{ verifyLabel }}</el-tag>
          <div class="p-extra">
            <div class="extra-item" v-if="profile"><span>学院</span><b>{{ collegeName(profile.college_code) }}</b></div>
            <div class="extra-item" v-if="profile && auth.role==='STUDENT'"><span>专业</span><b>{{ majorName(profile.major_code) }}</b></div>
            <div class="extra-item" v-if="profile && auth.role==='TEACHER'"><span>职称</span><b>{{ titleName(profile.title) }}</b></div>
          </div>
        </div>
      </el-col>

      <el-col :span="16">
        <div class="card block" v-if="profile">
          <div class="block-title">基本信息</div>
          <el-form :model="form" label-width="90px">
            <el-form-item label="真实姓名"><el-input v-model="form.real_name" /></el-form-item>
            <el-form-item label="性别">
              <el-radio-group v-model="form.gender">
                <el-radio value="M">男</el-radio><el-radio value="F">女</el-radio><el-radio value="U">保密</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="学院">
              <el-select v-model="form.college_code" style="width:100%" @change="onCollegeChange">
                <el-option v-for="c in colleges" :key="c.code" :label="c.label" :value="c.code" />
              </el-select>
            </el-form-item>

            <template v-if="auth.role === 'STUDENT'">
              <el-form-item label="专业">
                <el-select v-model="form.major_code" style="width:100%">
                  <el-option v-for="m in majors" :key="m.code" :label="m.label" :value="m.code" />
                </el-select>
              </el-form-item>
              <el-form-item label="班级"><el-input v-model="form.class_name" /></el-form-item>
              <div class="grid-2">
                <el-form-item label="入学年份"><el-input-number v-model="form.enrollment_year" :min="2000" :max="2100" style="width:100%" /></el-form-item>
                <el-form-item label="毕业年份"><el-input-number v-model="form.graduation_year" :min="2000" :max="2100" style="width:100%" /></el-form-item>
              </div>
              <el-form-item label="学历">
                <el-select v-model="form.degree_level" style="width:100%">
                  <el-option label="本科" value="BACHELOR" /><el-option label="硕士" value="MASTER" /><el-option label="博士" value="DOCTOR" />
                </el-select>
              </el-form-item>
              <el-form-item label="技能标签">
                <el-select v-model="form.skills" multiple style="width:100%">
                  <el-option v-for="s in skillTags" :key="s.code" :label="s.label" :value="s.code" />
                </el-select>
              </el-form-item>
              <el-form-item label="找队伍">
                <el-switch v-model="form.looking_for_team" active-text="公开找队伍" />
              </el-form-item>
              <el-form-item label="接受老师邀请">
                <el-switch v-model="form.allow_teacher_invite" />
              </el-form-item>
            </template>

            <template v-if="auth.role === 'TEACHER'">
              <el-form-item label="职称">
                <el-select v-model="form.title" style="width:100%">
                  <el-option v-for="t in titles" :key="t.code" :label="t.label" :value="t.code" />
                </el-select>
              </el-form-item>
              <el-form-item label="研究方向"><el-input v-model="form.research_fields" placeholder="如：人工智能、机器学习" /></el-form-item>
              <el-form-item label="带队上限"><el-input-number v-model="form.max_teams" :min="1" :max="20" /></el-form-item>
              <el-form-item label="接受学生邀请"><el-switch v-model="form.accept_students" /></el-form-item>
              <el-form-item label="公开邮箱"><el-input v-model="form.email_public" /></el-form-item>
              <el-form-item label="个人主页"><el-input v-model="form.homepage_url" placeholder="可选" /></el-form-item>
            </template>

            <el-form-item label="个人简介">
              <el-input v-model="form.bio" type="textarea" :rows="3" maxlength="1000" />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" :loading="saving" @click="saveProfile">保存资料</el-button>
            </el-form-item>
          </el-form>
        </div>

        <div class="card block" v-if="auth.role === 'STUDENT' || auth.role === 'TEACHER'">
          <div class="block-title">身份认证</div>
          <div v-if="verification && verification.status !== 'UNVERIFIED'">
            <el-alert :title="verification.status === 'VERIFIED' ? '认证已通过' : verification.status === 'REJECTED' ? `认证被驳回：${verification.reason || ''}` : '认证审核中，请耐心等待'"
              :type="verification.status === 'VERIFIED' ? 'success' : verification.status === 'REJECTED' ? 'error' : 'warning'" :closable="false" show-icon />
            <el-button v-if="verification.status === 'REJECTED'" type="primary" style="margin-top:12px" @click="submitVerify">重新提交认证</el-button>
          </div>
          <div v-else>
            <p class="text-muted text-sm">提交{{ auth.role === 'STUDENT' ? '学生' : '教师' }}身份认证，审核通过后档案将获得认证标识。</p>
            <el-input v-model="verifyNote" type="textarea" :rows="2" placeholder="补充说明（可选）" style="margin-bottom:12px" />
            <el-button type="primary" @click="submitVerify">提交认证</el-button>
          </div>
        </div>

        <div class="card block">
          <div class="block-title">修改密码</div>
          <el-form label-width="90px" style="max-width:420px">
            <el-form-item label="原密码"><el-input v-model="pwd.oldPassword" type="password" show-password /></el-form-item>
            <el-form-item label="新密码"><el-input v-model="pwd.newPassword" type="password" show-password /></el-form-item>
            <el-form-item><el-button type="primary" :loading="pwdLoading" @click="changePwd">修改密码</el-button></el-form-item>
          </el-form>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import api from '@/api';
import { useAuthStore } from '@/store/auth';

const auth = useAuthStore();
const profile = ref(null);
const form = ref({});
const verification = ref(null);
const saving = ref(false);
const verifyNote = ref('');
const pwd = ref({ oldPassword: '', newPassword: '' });
const pwdLoading = ref(false);

const colleges = ref([]);
const majors = ref([]);
const skillTags = ref([]);
const titles = ref([]);

const verifyLabel = computed(() => ({ UNVERIFIED: '未认证', PENDING_REVIEW: '审核中', VERIFIED: '已认证', REJECTED: '认证被驳回' }[auth.user?.verifyStatus] || '未认证'));
const verifyTagType = computed(() => ({ UNVERIFIED: 'info', PENDING_REVIEW: 'warning', VERIFIED: 'success', REJECTED: 'danger' }[auth.user?.verifyStatus] || 'info'));

function collegeName(code) { return colleges.value.find((c) => c.code === code)?.label || code || '—'; }
function majorName(code) { return majors.value.find((m) => m.code === code)?.label || code || '—'; }
function titleName(code) { return titles.value.find((t) => t.code === code)?.label || code || '—'; }

function onCollegeChange() {
  majors.value = allMajors.value.filter((m) => m.parent_code === form.value.college_code);
  if (!majors.value.find((m) => m.code === form.value.major_code)) form.value.major_code = '';
}
const allMajors = ref([]);

async function saveProfile() {
  saving.value = true;
  try {
    await api.updateMyProfile(form.value);
    ElMessage.success('资料已保存');
    await auth.fetchMe();
  } finally { saving.value = false; }
}

async function submitVerify() {
  await api.submitVerification({ materials: verifyNote.value ? [{ note: verifyNote.value }] : [] });
  ElMessage.success('认证已提交，等待审核');
  await auth.fetchMe();
  verification.value = await api.getMyVerification();
}

async function changePwd() {
  if (!pwd.value.oldPassword || !pwd.value.newPassword) return ElMessage.warning('请填写完整');
  pwdLoading.value = true;
  try { await api.changePassword(pwd.value); ElMessage.success('密码已修改，请重新登录'); auth.clear(); location.href = '/login'; }
  finally { pwdLoading.value = false; }
}

async function uploadAvatar({ file }) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await api.uploadFile(fd);
  await api.updateMyProfile({ avatar_url: res.url });
  ElMessage.success('头像已更新');
  await auth.fetchMe();
  profile.value = await api.getMyProfile();
}

onMounted(async () => {
  colleges.value = await api.getDict('COLLEGE');
  skillTags.value = await api.getDict('SKILL_TAG');
  titles.value = await api.getDict('TITLE');
  allMajors.value = await api.getDict('MAJOR');

  profile.value = await api.getMyProfile();
  if (profile.value) {
    form.value = { ...profile.value, skills: profile.value.skills || [] };
    onCollegeChange();
  }
  if (auth.role === 'STUDENT' || auth.role === 'TEACHER') {
    verification.value = await api.getMyVerification();
  }
});
</script>

<style scoped>
.profile-card { padding: 28px 20px; text-align: center; }
.avatar-wrap { position: relative; width: 88px; margin: 0 auto 14px; }
.avatar-edit { position: absolute; bottom: -4px; right: -4px; }
.p-name { font-size: 18px; font-weight: 700; }
.p-extra { margin-top: 18px; text-align: left; }
.extra-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px dashed #eef0f5; font-size: 14px; }
.extra-item:last-child { border-bottom: none; }
.extra-item span { color: #8a8f9e; }
.block { padding: 22px; margin-bottom: 20px; }
.block-title { font-size: 16px; font-weight: 700; margin-bottom: 16px; padding-left: 10px; border-left: 4px solid #4f46e5; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 12px; }
</style>
