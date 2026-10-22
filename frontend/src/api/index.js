import request from '@/utils/request';

export default {
  // 认证
  register: (data) => request.post('/auth/register', data),
  login: (data) => request.post('/auth/login', data),
  logout: (refreshToken) => request.post('/auth/logout', { refreshToken }),
  getMe: () => request.get('/auth/me'),
  changePassword: (data) => request.patch('/auth/password', data),
  sendCode: (data) => request.post('/auth/codes/send', data),
  resetPassword: (data) => request.post('/auth/password/reset', data),

  // 档案
  getMyProfile: () => request.get('/users/me/profile'),
  updateMyProfile: (data) => request.patch('/users/me/profile', data),
  getMyVerification: () => request.get('/users/me/verification'),
  submitVerification: (data) => request.post('/users/me/verification', data),

  // 教师/学生/字典
  listTeachers: (params) => request.get('/teachers', { params }),
  searchStudents: (params) => request.get('/students/search', { params }),
  getDict: (type) => request.get(`/dicts/${type}`),

  // 赛事
  listCompetitions: (params) => request.get('/competitions', { params }),
  getCompetition: (id) => request.get(`/competitions/${id}`),
  getCompetitionStat: (id) => request.get(`/competitions/${id}/stat`),
  createCompetition: (data) => request.post('/competitions', data),
  updateCompetition: (id, data) => request.patch(`/competitions/${id}`, data),
  deleteCompetition: (id) => request.delete(`/competitions/${id}`),
  publishCompetition: (id) => request.post(`/competitions/${id}/publish`),
  offlineCompetition: (id) => request.post(`/competitions/${id}/offline`),
  archiveCompetition: (id) => request.post(`/competitions/${id}/archive`),

  // 队伍
  createTeam: (data) => request.post('/teams', data),
  getTeam: (id) => request.get(`/teams/${id}`),
  updateTeam: (id, data) => request.patch(`/teams/${id}`, data),
  disbandTeam: (id) => request.delete(`/teams/${id}`),
  lockTeam: (id) => request.post(`/teams/${id}/lock`),
  unlockTeam: (id) => request.post(`/teams/${id}/unlock`),
  transferLeader: (id, newLeaderId) => request.post(`/teams/${id}/transfer-leader`, { newLeaderId }),
  leaveTeam: (id) => request.post(`/teams/${id}/leave`),
  removeMember: (id, accountId) => request.delete(`/teams/${id}/members/${accountId}`),
  myTeams: () => request.get('/teams/mine'),
  listRecruiting: (params) => request.get('/teams/recruiting', { params }),
  assignAdvisor: (id, advisorId) => request.post(`/teams/${id}/advisors`, { advisorId }),

  // 邀请/申请
  createInvitation: (data) => request.post('/invitations', data),
  listInvitations: (params) => request.get('/invitations', { params }),
  acceptInvitation: (id) => request.post(`/invitations/${id}/accept`),
  rejectInvitation: (id, reason) => request.post(`/invitations/${id}/reject`, { reason }),
  cancelInvitation: (id) => request.post(`/invitations/${id}/cancel`),
  createJoinRequest: (data) => request.post('/invitations/join-requests', data),
  listJoinRequests: () => request.get('/invitations/join-requests'),
  approveJoinRequest: (id) => request.post(`/invitations/join-requests/${id}/approve`),
  rejectJoinRequest: (id, reason) => request.post(`/invitations/join-requests/${id}/reject`, { reason }),

  // 通知
  listNotifications: (params) => request.get('/notifications', { params }),
  unreadCount: () => request.get('/notifications/unread-count'),
  markRead: (id) => request.post(`/notifications/${id}/read`),
  readAll: () => request.post('/notifications/read-all'),

  // 管理端
  getStats: () => request.get('/admin/stats'),
  listUsers: (params) => request.get('/admin/users', { params }),
  setUserStatus: (id, status) => request.patch(`/admin/users/${id}/status`, { status }),
  resetUserPassword: (id, newPassword) => request.post(`/admin/users/${id}/password/reset`, { newPassword }),
  createUser: (data) => request.post('/admin/users', data),
  listVerifications: (params) => request.get('/admin/verifications', { params }),
  reviewVerification: (id, data) => request.post(`/admin/verifications/${id}/review`, data),
  listCompetitionsAdmin: (params) => request.get('/admin/competitions', { params }),
  listDicts: (type) => request.get('/admin/dicts', { params: type ? { type } : {} }),
  saveDict: (data) => request.put('/admin/dicts', data),
  deleteDict: (id) => request.delete(`/admin/dicts/${id}`),
  listAuditLogs: (params) => request.get('/admin/audit-logs', { params }),

  // 文件
  uploadFile: (formData) => request.post('/files', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
};
