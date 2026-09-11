const { Router } = require('express');
const { body } = require('express-validator');
const {
  list,
  getOrCreateDirect,
  createGroup,
  getMessages,
  sendMessage,
  editMessage,
  deleteMessage,
  searchMessages,
  markRead,
  getMembers,
  leaveGroup
} = require('../controllers/conversationController');
const { auth } = require('../middleware/auth');
const validate = require('../middleware/validate');

const router = Router();

router.get('/', auth, list);
router.post('/direct', auth, [body('userId').isUUID().withMessage('Id de usuario inválido')], validate, getOrCreateDirect);
router.post(
  '/group',
  auth,
  [
    body('name').trim().isLength({ min: 1, max: 80 }).withMessage('Nombre de grupo entre 1 y 80 caracteres'),
    body('userIds').isArray({ min: 1 }).withMessage('Añade al menos un miembro')
  ],
  validate,
  createGroup
);
router.get('/:id/messages', auth, getMessages);
router.post('/:id/messages', auth, sendMessage);
router.get('/:id/messages/search', auth, searchMessages);
router.put('/:id/messages/:msgId', auth, editMessage);
router.delete('/:id/messages/:msgId', auth, deleteMessage);
router.post('/:id/read', auth, markRead);
router.get('/:id/members', auth, getMembers);
router.delete('/:id/participants/me', auth, leaveGroup);

module.exports = router;