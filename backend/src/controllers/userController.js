const { Op } = require('sequelize');
const { User } = require('../models');

async function search(req, res, next) {
  try {
    const q = (req.query.q || '').trim().toLowerCase();
    if (!q) return res.json([]);
    const users = await User.findAll({
      where: {
        id: { [Op.ne]: req.user.id },
        [Op.or]: [
          { username: { [Op.iLike]: `%${q}%` } },
          { email: { [Op.iLike]: `%${q}%` } }
        ]
      },
      limit: 10,
      order: [['username', 'ASC']]
    });
    res.json(users.map((u) => u.toSafe()));
  } catch (err) {
    next(err);
  }
}

module.exports = { search };