# -*- coding: utf-8 -*-
"""修复回归验证：python test/verify.py  （需后端已启动，数据库为初始种子）
仅做 HTTP 侧验证；涉及改库的用例（锁定解锁/窗口关闭/锁定退出）由外部步骤处理。
"""
import json, urllib.request, urllib.error

BASE = 'http://localhost:8080/api/v1'
passed = []
failed = []

def req(method, path, token=None, body=None):
    headers = {'Content-Type': 'application/json'}
    if token: headers['Authorization'] = 'Bearer ' + token
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}

def login(u, p):
    s, b = req('POST', '/auth/login', body={'username': u, 'password': p})
    return b.get('data', {}).get('accessToken') if b.get('code') == 0 else None

def check(name, cond, detail=''):
    (passed if cond else failed).append(name)
    print(('  ✓ ' if cond else '  ✗ ') + name + (('  -> ' + detail) if detail and not cond else ''))

print('修复回归验证…\n')

# ---- P0-1 入队申请不再 500 ----
t = login('student6', '123456')
s, b = req('POST', '/invitations/join-requests', t, {'teamId': 2, 'message': '验证：申请加入'})
check('P0-1 学生申请入队返回 201', s == 201 and b.get('code') == 0, f'{s} {b}')

# ---- P0-2 新建赛事(camelCase) ----
mt = login('manager', 'manager123')
s, b = req('POST', '/competitions', mt, {'title': '回归验证赛事', 'code': 'REG' + str(int(__import__('time').time())), 'level': 'SCHOOL', 'year': 2026, 'registerStartAt': '2026-01-01 00:00:00', 'registerEndAt': '2026-12-31 00:00:00', 'tracks': [{'id': 1, 'name': '赛道A', 'quota': 10, 'enabled': True}]})
check('P0-2 新建赛事成功', s == 201 and b.get('code') == 0, f'{s} {b}')
cid = b.get('data', {}).get('id')

# ---- P0-3 编辑赛事字段持久化 ----
s, b = req('PATCH', f'/competitions/{cid}', mt, {'descriptionMd': '## 回归验证介绍', 'collegeCode': 'CS', 'maxTeamSize': 9})
check('P0-3a 编辑赛事成功', b.get('code') == 0, f'{s} {b}')
s, b = req('GET', f'/competitions/{cid}', mt)
d = b.get('data', {})
check('P0-3b 编辑字段已持久化', d.get('description_md') == '## 回归验证介绍' and d.get('max_team_size') == 9 and d.get('college_code') == 'CS', json.dumps({k: d.get(k) for k in ('description_md','max_team_size','college_code')}))

# ---- P0-4 个人资料布尔开关 ----
t1 = login('student1', '123456')
s, b = req('PATCH', '/users/me/profile', t1, {'looking_for_team': False, 'allow_teacher_invite': True})
check('P0-4a 保存布尔开关成功', b.get('code') == 0, f'{s} {b}')
s, b = req('GET', '/users/me/profile', t1)
p = b.get('data', {})
check('P0-4b 布尔值正确落库', p.get('looking_for_team') == 0 and p.get('allow_teacher_invite') == 1, json.dumps({k: p.get(k) for k in ('looking_for_team','allow_teacher_invite')}))

# ---- P0-5 负责人/管理员有档案 ----
s, b = req('GET', '/users/me/profile', mt)
check('P0-5 负责人个人中心有档案', b.get('code') == 0 and b.get('data') is not None, f'{s} {b}')

# ---- P1-1 验证码不回传 ----
s, b = req('POST', '/auth/codes/send', body={'email': 'wangwu@tzb.edu.cn', 'purpose': 'RESET_PASSWORD'})
check('P1-1 验证码不回传(无devCode)', b.get('code') == 0 and b.get('data') is not None and 'devCode' not in b.get('data', {}), json.dumps(b))

# ---- P1-3 已注册邮箱再注册 -> 409 ----
s, b = req('POST', '/auth/register', body={'username': 'regdup' + str(int(__import__('time').time())), 'password': '123456', 'userType': 'STUDENT', 'realName': '测试', 'email': 'wangwu@tzb.edu.cn'})
check('P1-3 重复邮箱返回 409 友好提示', s == 409 and b.get('code') == 'EMAIL_EXISTS', f'{s} {b}')

# ---- P1-5 不能移除队长 ----
s, b = req('DELETE', '/teams/1/members/5', t1)
check('P1-5 移除队长被拒绝', s == 400, f'{s} {b}')

# ---- P2-4 修改赛道校验 ----
s, b = req('PATCH', '/teams/1', t1, {'trackId': 9999})
check('P2-4 修改为不存在赛道被拒绝', b.get('code') != 0, f'{s} {b}')

# ---- P2-5 草稿赛事创建者可预览 ----
s, b = req('GET', '/competitions/3', mt)
check('P2-5 草稿赛事对创建者可见', b.get('code') == 0, f'{s} {b}')
s, b = req('GET', '/competitions/3')
check('P2-5 草稿赛事对匿名不可见', s == 404, f'{s} {b}')

# ---- P2-6 refresh 重放吊销整族 ----
tt = login('teacher1', '123456')
s, b = req('POST', '/auth/login', body={'username': 'teacher1', 'password': '123456'})
rt0 = b['data']['refreshToken']
s, b = req('POST', '/auth/refresh', body={'refreshToken': rt0})
rt1 = b['data']['refreshToken']
s, b = req('POST', '/auth/refresh', body={'refreshToken': rt0})
check('P2-6a 重放旧token被拒', s == 401 and b.get('code') == 'REFRESH_REUSED', f'{s} {b}')
s, b = req('POST', '/auth/refresh', body={'refreshToken': rt1})
check('P2-6b 重放后整族失效', s == 401, f'{s} {b}')

# ---- P2-7 状态机：草稿不可直接归档 ----
s, b = req('POST', '/competitions/3/archive', mt)
check('P2-7 草稿直接归档被拒', s == 409, f'{s} {b}')

# ---- P2-9 老师邀请学生闭环(带队伍) ----
tt2 = login('teacher2', '123456')
s, b = req('POST', '/invitations', tt2, {'type': 'TEACHER_INVITE_STUDENT', 'competitionId': 1, 'teamId': 2, 'inviteeId': 10, 'message': '验证邀请'})
check('P2-9a 老师带队伍邀请学生成功', s == 201 and b.get('code') == 0, f'{s} {b}')
# student6 接受
t6 = login('student6', '123456')
s, b = req('GET', '/invitations', t6)
inv = next((i for i in b.get('data', {}).get('items', []) if i['type'] == 'TEACHER_INVITE_STUDENT' and i['status'] == 'PENDING'), None)
if inv:
    s, b = req('POST', f"/invitations/{inv['id']}/accept", t6)
    check('P2-9b 学生接受邀请成功', b.get('code') == 0, f'{s} {b}')
    s, b = req('GET', '/teams/2', t6)
    members = b.get('data', {}).get('members', [])
    check('P2-9c 学生已入队', any(m['account_id'] == 10 and m['status'] == 'ACTIVE' for m in members), json.dumps([m['account_id'] for m in members]))
else:
    check('P2-9b 学生接受邀请成功', False, '未找到待处理邀请')

print(f'\n结果：{len(passed)} 通过，{len(failed)} 失败')
if failed:
    print('失败项：', failed)
print()
