/* 冒烟测试：node test/smoke.js
 * 前置：后端已启动（默认 http://localhost:8080），数据库为初始种子状态（student5=账号9 未入队）。
 * 覆盖：登录 / 建赛事+发布 / 发邀请 三条主链路。
 */
const BASE = process.env.BASE || 'http://localhost:8080/api/v1';

let pass = 0;
let fail = 0;
function ok(name, cond, extra = '') {
  if (cond) { pass += 1; console.log(`  ✓ ${name}`); }
  else { fail += 1; console.log(`  ✗ ${name} ${extra}`); }
}
async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, json };
}
async function login(u, p) {
  const r = await call('POST', '/auth/login', { body: { username: u, password: p } });
  return r.json.data;
}

(async () => {
  console.log('冒烟测试开始…');

  // 1. 登录
  const admin = await login('admin', 'admin123');
  ok('管理员登录', !!admin?.accessToken);

  // 2. 建赛事 + 发布
  const mgr = await login('manager', 'manager123');
  const code = 'SMOKE' + Date.now();
  const created = await call('POST', '/competitions', {
    token: mgr.accessToken,
    body: { title: '冒烟测试赛事', code, level: 'SCHOOL', year: 2026, registerStartAt: '2026-01-01 00:00:00', registerEndAt: '2026-12-31 00:00:00', tracks: [{ id: 1, name: '测试赛道', quota: 10, enabled: true }] },
  });
  ok('负责人创建赛事', created.status === 201 && created.json.code === 0, JSON.stringify(created.json));
  const cid = created.json.data?.id;
  const published = await call('POST', `/competitions/${cid}/publish`, { token: mgr.accessToken });
  ok('发布赛事', published.json.code === 0 && published.json.data?.status === 'PUBLISHED', JSON.stringify(published.json));

  // 3. 发邀请（student1 队长 -> student5 加入 team1）
  const s1 = await login('student1', '123456');
  const invited = await call('POST', '/invitations', {
    token: s1.accessToken,
    body: { type: 'TEAM_INVITE_MEMBER', competitionId: 1, teamId: 1, inviteeId: 9, message: '冒烟测试邀请' },
  });
  ok('队长邀请队友', invited.status === 201 && invited.json.code === 0, JSON.stringify(invited.json));

  console.log(`\n结果：${pass} 通过，${fail} 失败`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('冒烟测试异常：', e); process.exit(1); });
