import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.get('/', async (req, res) => {
  const customerId = req.query.customerId;

  const token = jwt.sign(
    { customerId },
    process.env.SAVE_CARD_SECRET,
    { expiresIn: '5m' }
  );
  res.redirect(
    `/save-card/preload?token=${token}`
  );
});

export default router;