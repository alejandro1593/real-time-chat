const { Router } = require('express');
const { search } = require('../controllers/userController');
const { auth } = require('../middleware/auth');

const router = Router();

router.get('/search', auth, search);

module.exports = router;