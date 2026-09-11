const { Router } = require('express');
const {
  list,
  getOrCreateDirect,
  createGroup,
  getMessages,
  sendMessage
} = require('../controllers/conversationController');
const { auth } = require('../middleware/auth');

const router = Router();

router.get('/', auth, list);
router.post('/direct', auth, getOrCreateDirect);
router.post('/group', auth, createGroup);
router.get('/:id/messages', auth, getMessages);
router.post('/:id/messages', auth, sendMessage);

module.exports = router;