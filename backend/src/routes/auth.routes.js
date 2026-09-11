const { Router } = require('express');
const { body } = require('express-validator');
const { register, login, me } = require('../controllers/authController');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = Router();

router.post(
  '/register',
  [
    body('username')
      .trim()
      .isLength({ min: 3, max: 40 })
      .withMessage('El nombre de usuario debe tener entre 3 y 40 caracteres')
      .matches(/^[a-zA-Z0-9_.-]+$/)
      .withMessage('El nombre de usuario solo puede contener letras, números, punto, guion y guion bajo'),
    body('email').isEmail().withMessage('Correo electrónico inválido'),
    body('password')
      .isLength({ min: 6 })
      .withMessage('La contraseña debe tener al menos 6 caracteres')
  ],
  validate,
  register
);

router.post(
  '/login',
  [
    body('username').trim().notEmpty().withMessage('El usuario es obligatorio'),
    body('password').notEmpty().withMessage('La contraseña es obligatoria')
  ],
  validate,
  login
);

router.get('/me', auth, me);

module.exports = router;