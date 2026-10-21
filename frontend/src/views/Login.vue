<template>
  <div class="login-wrap">
    <div class="bg-blob b1"></div>
    <div class="bg-blob b2"></div>
    <div class="login-card card">
      <div class="brand">
        <div class="brand-badge">🏆</div>
        <h1>赛事通</h1>
        <p>高校赛事管理平台</p>
      </div>

      <el-form :model="form" @keyup.enter="submit" size="large">
        <el-form-item>
          <el-input v-model="form.username" placeholder="学号 / 工号 / 用户名" :prefix-icon="User" clearable />
        </el-form-item>
        <el-form-item>
          <el-input v-model="form.password" type="password" placeholder="密码" :prefix-icon="Lock" show-password />
        </el-form-item>
        <el-button type="primary" size="large" class="submit" :loading="loading" @click="submit">登 录</el-button>
      </el-form>

      <div class="foot">
        <span class="text-muted text-sm">还没有账号？</span>
        <el-link type="primary" @click="$router.push('/register')">立即注册</el-link>
      </div>

      <el-divider><span class="text-xs text-muted">演示账号（点击自动填充）</span></el-divider>
      <div class="demo-accounts">
        <el-tag v-for="a in demoAccounts" :key="a.u" class="demo-tag" effect="plain" @click="fill(a)">{{ a.label }}</el-tag>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue';
import api from '@/api';
import { useAuthStore } from '@/store/auth';

const router = useRouter();
const route = useRoute();
const auth = useAuthStore();
const loading = ref(false);
const form = ref({ username: '', password: '' });

const demoAccounts = [
  { u: 'student1', p: '123456', label: '学生' },
  { u: 'teacher1', p: '123456', label: '老师' },
  { u: 'manager', p: 'manager123', label: '赛事负责人' },
  { u: 'admin', p: 'admin123', label: '管理员' },
];

function fill(a) { form.value = { username: a.u, password: a.p }; }

async function submit() {
  if (!form.value.username || !form.value.password) return ElMessage.warning('请输入用户名和密码');
  loading.value = true;
  try {
    const data = await api.login(form.value);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    await auth.fetchMe();
    ElMessage.success(`欢迎回来，${data.user.displayName}`);
    router.push(route.query.redirect || '/');
  } catch (e) { /* 已提示 */ } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-wrap { position: relative; height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #eef0ff 0%, #f6f4ff 45%, #fdf2ff 100%); overflow: hidden; }
.bg-blob { position: absolute; border-radius: 50%; filter: blur(70px); opacity: .5; }
.b1 { width: 420px; height: 420px; background: #c7d2fe; top: -80px; left: -60px; }
.b2 { width: 380px; height: 380px; background: #fbcfe8; bottom: -90px; right: -40px; }
.login-card { position: relative; width: 400px; padding: 40px 36px 30px; border-radius: 20px; box-shadow: 0 20px 50px rgba(79,70,229,.12); }
.brand { text-align: center; margin-bottom: 26px; }
.brand-badge { width: 56px; height: 56px; margin: 0 auto 12px; border-radius: 16px; background: linear-gradient(135deg, #4f46e5, #7c3aed); display: flex; align-items: center; justify-content: center; font-size: 28px; box-shadow: 0 8px 20px rgba(79,70,229,.35); }
.brand h1 { margin: 0; font-size: 24px; font-weight: 800; }
.brand p { margin: 4px 0 0; color: #8a8f9e; font-size: 13px; }
.submit { width: 100%; border-radius: 10px; }
.foot { text-align: center; margin-top: 14px; }
.demo-accounts { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.demo-tag { cursor: pointer; }
</style>
