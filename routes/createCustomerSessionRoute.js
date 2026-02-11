import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.get('/save-card', async (req, res) => {
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

router.get('/charge-card', async (req, res) => {
  const customerId = req.query.customerId;
  const token = jwt.sign(
    { customerId },
    process.env.SAVE_CARD_SECRET,
    { expiresIn: '5m' }
  );
  res.redirect(
    `/charge-card?token=${token}`
  );
});

export default router;