const { User } = require('../models');
const { signToken } = require('../middleware/auth');
const { Op } = require('sequelize');

const AVATAR_COLORS = ['#22d3ee', '#a78bfa', '#34d399', '#f472b6', '#fb923c', '#facc15', '#60a5fa', '#f87171'];

async function register(req, res, next) {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Nombre de usuario, correo y contraseña son obligatorios' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }
    const existing = await User.findOne({ where: { [Op.or]: [{ username }, { email }] } });
    if (existing) {
      return res.status(409).json({ message: 'El usuario o correo ya existe' });
    }
    const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
    const user = await User.create({ username, email, passwordHash: password, avatarColor: color });
    const token = signToken(user);
    res.status(201).json({ user: user.toSafe(), token });
  } catch (err) {
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: 'Usuario y contraseña son obligatorios' });
    }
    const user = await User.findOne({ where: { username } });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    const token = signToken(user);
    res.json({ user: user.toSafe(), token });
  } catch (err) {
    next(err);
  }
}

async function me(req, res) {
  res.json({ user: req.user.toSafe() });
}

module.exports = { register, login, me };