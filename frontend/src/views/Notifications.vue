<template>
  <div class="page">
    <div class="head-row">
      <div>
        <h2 class="page-title" style="margin:0">通知中心</h2>
        <p class="page-sub" style="margin:4px 0 0">站内消息与系统通知</p>
      </div>
      <el-button @click="readAll">全部已读</el-button>
    </div>

    <div class="card" style="padding:8px 16px">
      <div v-for="n in list" :key="n.id" class="noti-item" :class="{ unread: !n.read_at }" @click="open(n)">
        <div class="noti-dot" :style="{ background: n.read_at ? 'transparent' : '#4f46e5' }"></div>
        <div class="flex-1">
          <div class="noti-title">
            <el-tag size="small" :type="typeTag(n.type)" effect="light">{{ typeLabel(n.type) }}</el-tag>
            <b>{{ n.title }}</b>
          </div>
          <div class="text-muted text-sm noti-content">{{ n.content }}</div>
          <div class="text-xs text-muted">{{ fmt(n.created_at) }}</div>
        </div>
      </div>
      <el-empty v-if="!list.length" description="暂无通知" :image-size="70" />
    </div>

    <div class="pager" v-if="total > size">
      <el-pagination background layout="prev, pager, next, total" :total="total" :page-size="size" :current-page="page" @current-change="onPage" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import api from '@/api';
import { useAuthStore } from '@/store/auth';

const router = useRouter();
const auth = useAuthStore();
const list = ref([]);
const total = ref(0);
const page = ref(1);
const size = 10;

function typeLabel(t) { return { INVITATION: '邀请', TEAM: '队伍', SYSTEM: '系统' }[t] || t; }
function typeTag(t) { return { INVITATION: 'warning', TEAM: 'success', SYSTEM: 'primary' }[t] || 'info'; }
function fmt(d) { return d ? String(d).slice(0, 16).replace('T', ' ') : '—'; }

async function load() {
  const data = await api.listNotifications({ page: page.value, size });
  list.value = data.items;
  total.value = data.total;
}
function onPage(p) { page.value = p; load(); }

async function open(n) {
  if (!n.read_at) {
    await api.markRead(n.id);
    const c = await api.unreadCount(); auth.setUnread(c.total);
    n.read_at = new Date().toISOString();
  }
  if (n.link_url) router.push(n.link_url);
}

async function readAll() {
  await api.readAll();
  auth.setUnread(0);
  ElMessage.success('已全部标记为已读'); load();
}

onMounted(load);
</script>

<style scoped>
.head-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.noti-item { display: flex; align-items: flex-start; gap: 12px; padding: 16px 8px; border-bottom: 1px solid #f0f1f5; cursor: pointer; }
.noti-item:last-child { border-bottom: none; }
.noti-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 8px; flex-shrink: 0; }
.flex-1 { flex: 1; }
.noti-title { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.noti-content { line-height: 1.5; }
.unread { background: #fafbff; }
.pager { display: flex; justify-content: center; margin-top: 20px; }
</style>
