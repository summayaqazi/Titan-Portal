const parseListQuery = (req, { defaultLimit = 10, maxLimit = 100 } = {}) => {
  const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || defaultLimit, 1), maxLimit);
  const search = (req.query.search || '').trim();
  return { page, limit, search, skip: (page - 1) * limit };
};

const paginatedResponse = ({ items, total, page, limit }) => ({
  success: true,
  data: items,
  page,
  limit,
  total,
  totalPages: Math.max(Math.ceil(total / limit), 1),
});

module.exports = { parseListQuery, paginatedResponse };
