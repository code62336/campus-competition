# -*- coding: utf-8 -*-
"""修复回归验证：python test/verify.py  （需后端已启动）
自包含：每次运行新建独立赛事/学生/教师/队伍，不依赖种子数据、可重复运行。
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')  # 避免 Windows GBK 控制台 UnicodeEncodeError

import json, time, urllib.request, urllib.error

BASE = 'http://localhost:8080/api/v1'
TS = int(time.time())
passed = []
failed = []

def req(method, path, token=None, body=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
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

def register(user_type, tag, email=None):
    username = f'vfy_{user_type.lower()}_{tag}_{TS}'
    s, b = req('POST', '/auth/register', body={
        'username': username, 'password': '123456', 'userType': user_type,
        'realName': f'验证{tag}', 'collegeCode': 'CS', 'email': email,
        **({'studentNo': f'S{TS}{tag}'} if user_type == 'STUDENT' else {'teacherNo': f'T{TS}{tag}'}),
    })
    return username, b.get('data', {}).get('id')

def check(name, cond, detail=''):
    (passed if cond else failed).append(name)
    print(('  ✓ ' if cond else '  ✗ ') + name + (('  -> ' + detail) if detail and not cond else ''))

print('修复回归验证…\n')

mt = login('manager', 'manager123')

# ---- 建一个已发布赛事（fixture） ----
s, b = req('POST', '/competitions', mt, {'title': f'验证赛事{TS}', 'code': f'VFY{TS}', 'level': 'SCHOOL', 'year': 2026,
    'registerStartAt': '2026-01-01 00:00:00', 'registerEndAt': '2026-12-31 00:00:00',
    'tracks': [{'id': 1, 'name': '赛道A', 'quota': 10, 'enabled': True}]})
check('P0-2 新建赛事成功', s == 201 and b.get('code') == 0, f'{s} {b}')
cid = b.get('data', {}).get('id')
req('POST', f'/competitions/{cid}/publish', mt)

# ---- P0-3 编辑持久化 ----
s, b = req('PATCH', f'/competitions/{cid}', mt, {'descriptionMd': '## 回归介绍', 'collegeCode': 'CS', 'maxTeamSize': 9})
check('P0-3a 编辑赛事成功', b.get('code') == 0, f'{s} {b}')
s, b = req('GET', f'/competitions/{cid}', mt)
d = b.get('data', {})
check('P0-3b 编辑字段已持久化', d.get('description_md') == '## 回归介绍' and d.get('max_team_size') == 9, json.dumps({k: d.get(k) for k in ('description_md', 'max_team_size')}))

# ---- 学生 A 建队 ----
un_a, id_a = register('STUDENT', 'A')
ta = login(un_a, '123456')
s, b = req('POST', '/teams', ta, {'competitionId': cid, 'name': f'验证队{TS}', 'trackId': 1})
check('学生建队成功', s == 201 and b.get('code') == 0, f'{s} {b}')
team_id = b.get('data', {}).get('id')

# ---- P0-1 学生 B 申请入队 ----
un_b, id_b = register('STUDENT', 'B')
tb = login(un_b, '123456')
s, b = req('POST', '/invitations/join-requests', tb, {'teamId': team_id, 'message': '申请加入'})
check('P0-1 学生申请入队返回 201', s == 201 and b.get('code') == 0, f'{s} {b}')

# ---- P0-4 布尔开关保存 ----
s, b = req('PATCH', '/users/me/profile', ta, {'looking_for_team': True, 'allow_teacher_invite': False})
check('P0-4a 保存布尔开关成功', b.get('code') == 0, f'{s} {b}')
s, b = req('GET', '/users/me/profile', ta)
p = b.get('data', {})
check('P0-4b 布尔值正确落库', p.get('looking_for_team') == 1 and p.get('allow_teacher_invite') == 0, json.dumps({k: p.get(k) for k in ('looking_for_team', 'allow_teacher_invite')}))

# ---- P0-5 负责人有档案 ----
s, b = req('GET', '/users/me/profile', mt)
check('P0-5 负责人个人中心有档案', b.get('code') == 0 and b.get('data') is not None, f'{s} {b}')

# ---- P1-1 验证码不回传 ----
s, b = req('POST', '/auth/codes/send', body={'email': 'admin@tzb.edu.cn', 'purpose': 'RESET_PASSWORD'})
check('P1-1 验证码不回传(无devCode)', b.get('code') == 0 and 'devCode' not in b.get('data', {}), json.dumps(b))

# ---- P1-3 重复邮箱 -> 409 ----
s, b = req('POST', '/auth/register', body={'username': f'dup_{TS}', 'password': '123456', 'userType': 'STUDENT', 'realName': '重复', 'email': 'admin@tzb.edu.cn'})
check('P1-3 重复邮箱返回 409 友好提示', s == 409 and b.get('code') == 'EMAIL_EXISTS', f'{s} {b}')

# ---- P1-5 不能移除队长 ----
s, b = req('DELETE', f'/teams/{team_id}/members/{id_a}', ta)
check('P1-5 移除队长被拒绝', s == 400, f'{s} {b}')

# ---- P2-4 修改赛道校验 ----
s, b = req('PATCH', f'/teams/{team_id}', ta, {'trackId': 9999})
check('P2-4 修改为不存在赛道被拒绝', b.get('code') != 0, f'{s} {b}')

# ---- P2-5 草稿赛事详情 ----
s, b = req('POST', '/competitions', mt, {'title': f'草稿{TS}', 'code': f'DRAFT{TS}', 'level': 'SCHOOL', 'year': 2026,
    'registerStartAt': '2026-01-01 00:00:00', 'registerEndAt': '2026-12-31 00:00:00', 'tracks': [{'id': 1, 'name': 't', 'quota': 5, 'enabled': True}]})
draft_id = b.get('data', {}).get('id')
s, b = req('GET', f'/competitions/{draft_id}', mt)
check('P2-5 草稿赛事对创建者可见', b.get('code') == 0, f'{s} {b}')
s, b = req('GET', f'/competitions/{draft_id}')
check('P2-5 草稿赛事对匿名不可见', s == 404, f'{s} {b}')

# ---- P2-6 refresh 重放吊销整族 ----
un_t1, _ = register('TEACHER', 'R')
s, b = req('POST', '/auth/login', body={'username': un_t1, 'password': '123456'})
rt0 = b['data']['refreshToken']
s, b = req('POST', '/auth/refresh', body={'refreshToken': rt0})
rt1 = b['data']['refreshToken']
s, b = req('POST', '/auth/refresh', body={'refreshToken': rt0})
check('P2-6a 重放旧token被拒', s == 401 and b.get('code') == 'REFRESH_REUSED', f'{s} {b}')
s, b = req('POST', '/auth/refresh', body={'refreshToken': rt1})
check('P2-6b 重放后整族失效', s == 401, f'{s} {b}')

# ---- P2-7 状态机：草稿不可直接归档 ----
s, b = req('POST', f'/competitions/{draft_id}/archive', mt)
check('P2-7 草稿直接归档被拒', s == 409, f'{s} {b}')

# ---- P2-9 老师邀请学生闭环 ----
un_t2, id_t2 = register('TEACHER', 'T')
tt2 = login(un_t2, '123456')
# 队长 A 邀请老师 T2 -> 老师接受成为指导老师
s, b = req('POST', '/invitations', ta, {'type': 'STUDENT_INVITE_TEACHER', 'competitionId': cid, 'teamId': team_id, 'inviteeId': id_t2})
check('P2-9a 学生邀请老师成功', s == 201 and b.get('code') == 0, f'{s} {b}')
s, b = req('GET', '/invitations', tt2)
inv = next((i for i in b.get('data', {}).get('items', []) if i['type'] == 'STUDENT_INVITE_TEACHER' and i['status'] == 'PENDING'), None)
if inv:
    req('POST', f"/invitations/{inv['id']}/accept", tt2)
# 老师 T2 邀请学生 B -> B 接受入队
s, b = req('POST', '/invitations', tt2, {'type': 'TEACHER_INVITE_STUDENT', 'competitionId': cid, 'teamId': team_id, 'inviteeId': id_b})
check('P2-9b 老师带队伍邀请学生成功', s == 201 and b.get('code') == 0, f'{s} {b}')
s, b = req('GET', '/invitations', tb)
inv2 = next((i for i in b.get('data', {}).get('items', []) if i['type'] == 'TEACHER_INVITE_STUDENT' and i['status'] == 'PENDING'), None)
if inv2:
    s, b = req('POST', f"/invitations/{inv2['id']}/accept", tb)
    check('P2-9c 学生接受邀请成功', b.get('code') == 0, f'{s} {b}')
    s, b = req('GET', f'/teams/{team_id}', tb)
    members = b.get('data', {}).get('members', [])
    check('P2-9d 学生已入队', any(m['account_id'] == id_b and m['status'] == 'ACTIVE' for m in members), json.dumps([m['account_id'] for m in members]))
else:
    check('P2-9c 学生接受邀请成功', False, '未找到待处理邀请')

# ---- M2 老师不能邀人进别人的队伍 ----
un_t3, id_t3 = register('TEACHER', 'X')
tt3 = login(un_t3, '123456')
s, b = req('POST', '/invitations', tt3, {'type': 'TEACHER_INVITE_STUDENT', 'competitionId': cid, 'teamId': team_id, 'inviteeId': id_b})
check('M2 非指导老师邀请被拒', s == 403 and b.get('code') == 'PERMISSION_DENIED', f'{s} {b}')

print(f'\n结果：{len(passed)} 通过，{len(failed)} 失败')
if failed:
    print('失败项：', failed)
print()
