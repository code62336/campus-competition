/* 冒烟测试：node test/smoke.js  （需后端已启动）
 * 自包含：每次运行都新建独立的赛事/学生/队伍，不依赖种子数据、可重复运行。
 * 覆盖：登录 / 建赛事+发布 / 学生建队 / 队长邀请队友 四条主链路。
 */
const BASE = process.env.BASE || 'http://localhost:8080/api/v1';
const TS = Date.now();

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
async function registerStudent(no) {
  const username = `smoke_stu_${TS}_${no}`;
  const r = await call('POST', '/auth/register', {
    body: { username, password: '123456', userType: 'STUDENT', realName: `冒烟学生${no}`, collegeCode: 'CS', studentNo: `S${TS}${no}` },
  });
  return { username, id: r.json.data?.id };
}

(async () => {
  console.log('冒烟测试开始…');

  // 1. 登录
  const admin = await login('admin', 'admin123');
  ok('管理员登录', !!admin?.accessToken);

  // 2. 建赛事 + 发布
  const mgr = await login('manager', 'manager123');
  const code = `SMOKE${TS}`;
  const created = await call('POST', '/competitions', {
    token: mgr.accessToken,
    body: { title: `冒烟赛事${TS}`, code, level: 'SCHOOL', year: 2026, registerStartAt: '2026-01-01 00:00:00', registerEndAt: '2026-12-31 00:00:00', tracks: [{ id: 1, name: '测试赛道', quota: 10, enabled: true }] },
  });
  ok('负责人创建赛事', created.status === 201 && created.json.code === 0, JSON.stringify(created.json));
  const cid = created.json.data?.id;
  const published = await call('POST', `/competitions/${cid}/publish`, { token: mgr.accessToken });
  ok('发布赛事', published.json.code === 0 && published.json.data?.status === 'PUBLISHED', JSON.stringify(published.json));

  // 3. 学生建队
  const stuA = await registerStudent('A');
  const a = await login(stuA.username, '123456');
  const team = await call('POST', '/teams', {
    token: a.accessToken,
    body: { competitionId: cid, name: `冒烟队伍${TS}`, slogan: '自包含冒烟', trackId: 1 },
  });
  ok('学生建队', team.status === 201 && team.json.code === 0, JSON.stringify(team.json));
  const teamId = team.json.data?.id;

  // 4. 队长邀请队友
  const stuB = await registerStudent('B');
  const invited = await call('POST', '/invitations', {
    token: a.accessToken,
    body: { type: 'TEAM_INVITE_MEMBER', competitionId: cid, teamId, inviteeId: stuB.id, message: '冒烟邀请' },
  });
  ok('队长邀请队友', invited.status === 201 && invited.json.code === 0, JSON.stringify(invited.json));

  console.log(`\n结果：${pass} 通过，${fail} 失败`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('冒烟测试异常：', e); process.exit(1); });
