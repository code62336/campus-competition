// 统一成功响应
exports.ok = (res, data, status = 200) => res.status(status).json({ code: 0, message: 'ok', data });

// 统一分页响应
exports.paged = (res, { items, page, size, total }) => {
  res.json({
    code: 0,
    message: 'ok',
    data: {
      items,
      page,
      size,
      total,
      has_more: page * size < total,
    },
  });
};

// 解析分页参数
exports.parsePager = (query) => {
  let page = parseInt(query.page, 10);
  let size = parseInt(query.size, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(size) || size < 1) size = 20;
  if (size > 100) size = 100;
  return { page, size, offset: (page - 1) * size };
};
