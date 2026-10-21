/* 演示数据初始化脚本（幂等）：node src/seed.js
 * 所有演示账号密码：见下方注释
 */
require('dotenv').config();
const { pool } = require('./config/db');
const { hash } = require('./utils/password');
const { toDateTime, toJson } = require('./utils/helpers');

const PWD = '123456'; // 学生/教师统一密码
const now = Date.now();
const startAt = toDateTime(new Date(now - 10 * 24 * 3600 * 1000));
const endAt = toDateTime(new Date(now + 30 * 24 * 3600 * 1000));

async function main() {
  const [chk] = await pool.query("SELECT id FROM account WHERE username='admin'");
  if (chk[0]) {
    console.log('检测到已初始化，跳过（如需重建请先清空 tzb 库后重跑 init.sql 与本脚本）');
    return;
  }

  const h123 = await hash(PWD);
  const hAdmin = await hash('admin123');
  const hManager = await hash('manager123');

  async function createAccount(username, passwordHash, userType, displayName, email) {
    const [r] = await pool.query(
      'INSERT INTO account (username, password_hash, user_type, display_name, email, email_verified, verify_status, created_at) VALUES (?,?,?,?,?,1,?,NOW(3))',
      [username, passwordHash, userType, displayName, email, 'VERIFIED']
    );
    return r.insertId;
  }
  async function createProfile(accId, userType, data) {
    await pool.query(
      `INSERT INTO user_profile (account_id, user_type, real_name, student_no, teacher_no, gender, college_code, major_code,
        class_name, enrollment_year, graduation_year, degree_level, title, research_fields, bio, skills,
        allow_teacher_invite, looking_for_team, accept_students, max_teams, profile_completed, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,NOW(3))`,
      [accId, userType, data.real_name, data.student_no || null, data.teacher_no || null, data.gender || null,
        data.college_code || null, data.major_code || null, data.class_name || null, data.enrollment_year || null,
        data.graduation_year || null, data.degree_level || null, data.title || null, data.research_fields || null,
        data.bio || null, toJson(data.skills || null), data.allow_teacher_invite === undefined ? 1 : data.allow_teacher_invite,
        data.looking_for_team || 0, data.accept_students === undefined ? 1 : data.accept_students, data.max_teams || 3]
    );
  }
  async function createVerification(accId, userType, status) {
    await pool.query('INSERT INTO user_verification (account_id, user_type, status, auto_matched, created_at) VALUES (?,?,?,1,NOW(3))', [accId, userType, status]);
  }

  // ---- 账号 ----
  const adminId = await createAccount('admin', hAdmin, 'ADMIN', '超级管理员', 'admin@tzb.edu.cn');
  const managerId = await createAccount('manager', hManager, 'MANAGER', '赛事负责人', 'manager@tzb.edu.cn');
  const t1 = await createAccount('teacher1', h123, 'TEACHER', '张三', 'zhangsan@tzb.edu.cn');
  const t2 = await createAccount('teacher2', h123, 'TEACHER', '李四', 'lisi@tzb.edu.cn');
  const s1 = await createAccount('student1', h123, 'STUDENT', '王五', 'wangwu@tzb.edu.cn');
  const s2 = await createAccount('student2', h123, 'STUDENT', '赵六', 'zhaoliu@tzb.edu.cn');
  const s3 = await createAccount('student3', h123, 'STUDENT', '孙七', 'sunqi@tzb.edu.cn');
  const s4 = await createAccount('student4', h123, 'STUDENT', '周八', 'zhouba@tzb.edu.cn');

  // ---- 档案 ----
  await createProfile(t1, 'TEACHER', { real_name: '张三', teacher_no: 'T1001', college_code: 'CS', title: 'PROF', research_fields: '人工智能、机器学习、计算机视觉', bio: '计算机学院教授，博士生导师，长期从事人工智能与机器学习研究，指导过多项国家级竞赛。', accept_students: 1, max_teams: 3 });
  await createProfile(t2, 'TEACHER', { real_name: '李四', teacher_no: 'T1002', college_code: 'SE', title: 'APROF', research_fields: '软件工程、后端架构、微服务', bio: '软件学院副教授，研究方向为软件工程与分布式系统。', accept_students: 1, max_teams: 2 });
  await createProfile(s1, 'STUDENT', { real_name: '王五', student_no: '2023001', college_code: 'CS', major_code: 'CS_CS', class_name: '计科2301', enrollment_year: 2023, graduation_year: 2027, degree_level: 'BACHELOR', skills: ['FE', 'ALGO'], looking_for_team: 1, bio: '热爱前端与算法，拿过蓝桥杯省一。' });
  await createProfile(s2, 'STUDENT', { real_name: '赵六', student_no: '2023002', college_code: 'SE', major_code: 'SE_SE', class_name: '软工2302', enrollment_year: 2023, graduation_year: 2027, degree_level: 'BACHELOR', skills: ['BE', 'DATA'], looking_for_team: 1 });
  await createProfile(s3, 'STUDENT', { real_name: '孙七', student_no: '2023003', college_code: 'AI', major_code: 'AI_AI', class_name: '人工2301', enrollment_year: 2023, graduation_year: 2027, degree_level: 'BACHELOR', skills: ['ML'], looking_for_team: 1 });
  await createProfile(s4, 'STUDENT', { real_name: '周八', student_no: '2023004', college_code: 'EE', major_code: 'EE_IOT', class_name: '物联2301', enrollment_year: 2023, graduation_year: 2027, degree_level: 'BACHELOR', skills: ['EMBED'], looking_for_team: 1 });

  // ---- 认证记录 ----
  await createVerification(t1, 'TEACHER', 'VERIFIED');
  await createVerification(t2, 'TEACHER', 'VERIFIED');
  await createVerification(s1, 'STUDENT', 'VERIFIED');
  await createVerification(s2, 'STUDENT', 'VERIFIED');
  await pool.query("INSERT INTO user_verification (account_id, user_type, status, auto_matched, created_at) VALUES (?,?,?,0,NOW(3))", [s3, 'STUDENT', 'PENDING_REVIEW']);
  await pool.query('UPDATE account SET verify_status=? WHERE id=?', ['PENDING_REVIEW', s3]);

  // ---- 赛事 ----
  async function createCompetition(code, title, subtitle, level, collegeCode, year, category, organizer, status, tracks, desc, cover) {
    const [r] = await pool.query(
      `INSERT INTO competition (code, title, subtitle, level, college_code, year, category, organizer, description_md, cover_url,
        tracks_json, register_start_at, register_end_at, status, min_team_size, max_team_size, teacher_required,
        max_teacher_count, max_teams_per_teacher, allow_cross_college, published_at, created_by, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,IF(?='PUBLISHED',NOW(3),NULL),?,NOW(3))`,
      [code, title, subtitle, level, collegeCode, year, category, organizer, desc, cover,
        toJson(tracks), startAt, endAt, status, 3, 8, 1, 2, 3, 1, status, managerId]
    );
    return r.insertId;
  }

  const comp1 = await createCompetition(
    'TZB2026-1', "2026年'挑战杯'大学生课外学术科技作品竞赛", '校级选拔赛', 'SCHOOL', null, 2026, 'CS', '校团委',
    'PUBLISHED',
    [{ id: 1, name: '科技发明制作', quota: 30, enabled: true }, { id: 2, name: '自然科学类学术论文', quota: 30, enabled: true }, { id: 3, name: '哲学社会科学类社会调查报告', quota: 30, enabled: true }],
    '## 竞赛简介\n\n挑战杯是由共青团中央、中国科协、教育部等联合主办的全国性大学生课外学术科技作品竞赛。\n\n### 参赛要求\n- 每队 3-8 人，需至少 1 名指导老师\n- 允许跨学院组队\n\n### 时间安排\n- 组队报名：即日起\n- 校赛评审：报名结束后两周内\n',
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1200'
  );
  const comp2 = await createCompetition(
    'TZB2026-2', '软件学院程序设计竞赛', '院级 · 算法与应用开发', 'COLLEGE', 'SE', 2026, 'CS', '软件学院',
    'PUBLISHED',
    [{ id: 1, name: '算法组', quota: 20, enabled: true }, { id: 2, name: '应用开发组', quota: 20, enabled: true }],
    '## 竞赛简介\n\n面向软件学院学生的程序设计竞赛，分为算法组与应用开发组两个赛道。',
    'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=1200'
  );
  await createCompetition(
    'TZB2026-3', '人工智能创新挑战赛', '校赛 · 智能应用', 'SCHOOL', null, 2026, 'AI_ROBOT', '人工智能学院',
    'DRAFT',
    [{ id: 1, name: '智能硬件', quota: 20, enabled: true }, { id: 2, name: 'AI 应用', quota: 20, enabled: true }],
    '## 竞赛简介\n\n人工智能创新挑战赛（草稿，尚未发布）。',
    null
  );

  // ---- 队伍 ----
  async function createTeam(compId, name, slogan, collegeCode, leaderId, trackId, memberCount) {
    const [r] = await pool.query(
      `INSERT INTO team (competition_id, track_id, name, slogan, college_code, leader_id, status, member_count, max_members, recruiting, created_by, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,NOW(3))`,
      [compId, trackId, name, slogan, collegeCode, leaderId, 'RECRUITING', memberCount, 8, 1, leaderId]
    );
    return r.insertId;
  }
  const team1 = await createTeam(comp1, '星辰探索队', '探索未知，点亮星辰', 'CS', s1, 1, 2);
  const team2 = await createTeam(comp1, '代码特工队', '代码即正义', 'AI', s3, 2, 2);

  async function addMember(teamId, accId, role, source) {
    const [p] = await pool.query('SELECT real_name FROM user_profile WHERE account_id=?', [accId]);
    await pool.query(
      `INSERT INTO team_member (team_id, account_id, role, status, source, real_name_snapshot, joined_at, created_at)
       VALUES (?,?,?,?,?,?,NOW(3),NOW(3))`,
      [teamId, accId, role, 'ACTIVE', source, p[0] ? p[0].real_name : null]
    );
  }
  await addMember(team1, s1, 'LEADER', 'SELF');
  await addMember(team1, s2, 'MEMBER', 'INVITE');
  await addMember(team1, t1, 'ADVISOR', 'INVITE');
  await pool.query('UPDATE team SET advisor_id=? WHERE id=?', [t1, team1]);
  await addMember(team2, s3, 'LEADER', 'SELF');
  await addMember(team2, s4, 'MEMBER', 'INVITE');

  // ---- 邀请 ----
  await pool.query(
    `INSERT INTO invitation (type, competition_id, team_id, inviter_id, invitee_id, message, status, expires_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,NOW(3))`,
    ['TEACHER_INVITE_STUDENT', comp1, null, t2, s4, '同学你好，我关注到你有嵌入式方向的特长，想邀请你一起组队参加挑战杯。', 'PENDING', toDateTime(new Date(now + 7 * 24 * 3600 * 1000))]
  );
  await pool.query(
    `INSERT INTO invitation (type, competition_id, team_id, inviter_id, invitee_id, message, status, expires_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,NOW(3))`,
    ['STUDENT_INVITE_TEACHER', comp1, team2, s3, t2, '李老师您好，我们代码特工队想邀请您担任指导老师。', 'PENDING', toDateTime(new Date(now + 7 * 24 * 3600 * 1000))]
  );

  // ---- 通知 ----
  async function addNotice(recipient, type, title, content, link) {
    await pool.query('INSERT INTO notification (recipient_id, type, title, content, link_url) VALUES (?,?,?,?,?)', [recipient, type, title, content, link]);
  }
  await addNotice(s1, 'SYSTEM', '欢迎使用高校赛事管理系统', '欢迎加入！完善个人档案并完成身份认证后，即可参与组队与竞赛。', '/profile');
  await addNotice(s3, 'INVITATION', '收到入队邀请', '李四老师邀请你一起组队参加挑战杯。', '/invitations');
  await addNotice(t2, 'INVITATION', '收到指导邀请', '孙七邀请你担任「代码特工队」指导老师。', '/invitations');
  await addNotice(managerId, 'SYSTEM', '有待审核的认证申请', '孙七 提交了学生身份认证，请及时审核。', '/admin/verifications');

  console.log('✅ 演示数据初始化完成');
  console.log('账号一览（密码）：');
  console.log('  admin   / admin123   （超级管理员）');
  console.log('  manager / manager123 （赛事负责人）');
  console.log('  teacher1 / 123456    （教师·张三）');
  console.log('  teacher2 / 123456    （教师·李四）');
  console.log('  student1 / 123456    （学生·王五）');
  console.log('  student2 / 123456    （学生·赵六）');
  console.log('  student3 / 123456    （学生·孙七）');
  console.log('  student4 / 123456    （学生·周八）');
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
