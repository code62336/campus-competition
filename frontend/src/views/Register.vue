<template>
  <div class="reg-wrap">
    <div class="reg-card card">
      <div class="brand">
        <div class="brand-badge">🏆</div>
        <h1>注册账号</h1>
        <p>加入高校赛事管理平台</p>
      </div>

      <el-form :model="form" :rules="rules" ref="formRef" label-position="top" size="large">
        <el-form-item label="身份类型" prop="userType">
          <el-radio-group v-model="form.userType" class="type-group">
            <el-radio-button value="STUDENT">我是学生</el-radio-button>
            <el-radio-button value="TEACHER">我是老师</el-radio-button>
          </el-radio-group>
        </el-form-item>

        <div class="grid-2">
          <el-form-item label="用户名 / 学号工号" prop="username">
            <el-input v-model="form.username" placeholder="登录用" />
          </el-form-item>
          <el-form-item label="真实姓名" prop="realName">
            <el-input v-model="form.realName" placeholder="用于档案展示" />
          </el-form-item>
        </div>

        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="至少 6 位" show-password />
        </el-form-item>

        <div class="grid-2">
          <el-form-item :label="form.userType === 'STUDENT' ? '学号' : '工号'" prop="no">
            <el-input v-model="form.no" />
          </el-form-item>
          <el-form-item label="学院" prop="collegeCode">
            <el-select v-model="form.collegeCode" placeholder="请选择" style="width:100%">
              <el-option v-for="c in colleges" :key="c.code" :label="c.label" :value="c.code" />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="邮箱" prop="email">
          <el-input v-model="form.email" placeholder="选填，用于找回密码" />
        </el-form-item>

        <el-button type="primary" size="large" class="submit" :loading="loading" @click="submit">注 册</el-button>
      </el-form>

      <div class="foot">
        <span class="text-muted text-sm">已有账号？</span>
        <el-link type="primary" @click="$router.push('/login')">去登录</el-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '@/api';

const router = useRouter();
const formRef = ref();
const loading = ref(false);
const colleges = ref([]);

const form = ref({ userType: 'STUDENT', username: '', realName: '', password: '', no: '', collegeCode: '', email: '' });

const rules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  realName: [{ required: true, message: '请输入真实姓名', trigger: 'blur' }],
  password: [{ required: true, min: 6, message: '密码至少 6 位', trigger: 'blur' }],
  no: [{ required: true, message: '请输入学号/工号', trigger: 'blur' }],
  collegeCode: [{ required: true, message: '请选择学院', trigger: 'change' }],
};

onMounted(async () => { colleges.value = await api.getDict('COLLEGE'); });

async function submit() {
  await formRef.value.validate();
  loading.value = true;
  try {
    const payload = {
      userType: form.value.userType,
      username: form.value.username,
      password: form.value.password,
      realName: form.value.realName,
      email: form.value.email,
      collegeCode: form.value.collegeCode,
      ...(form.value.userType === 'STUDENT' ? { studentNo: form.value.no } : { teacherNo: form.value.no }),
    };
    await api.register(payload);
    ElMessage.success('注册成功，请登录');
    router.push('/login');
  } catch (e) { /* 已提示 */ } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.reg-wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 40px 16px; background: linear-gradient(135deg, #eef0ff 0%, #f6f4ff 45%, #fdf2ff 100%); }
.reg-card { width: 520px; max-width: 100%; padding: 36px 36px 28px; border-radius: 20px; box-shadow: 0 20px 50px rgba(79,70,229,.12); }
.brand { text-align: center; margin-bottom: 20px; }
.brand-badge { width: 52px; height: 52px; margin: 0 auto 10px; border-radius: 14px; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 26px; }
.brand h1 { margin: 0; font-size: 22px; }
.brand p { margin: 4px 0 0; color: #8a8f9e; font-size: 13px; }
.type-group { display: flex; }
.type-group :deep(.el-radio-button__inner) { width: 100px; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
.submit { width: 100%; border-radius: 10px; }
.foot { text-align: center; margin-top: 12px; }
</style>
