import express from 'express';
import { getMonersToken } from '../services/shopify.js';
import { chargeMonerisToken } from '../services/moneris.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const customer_payload = jwt.verify(
      req.query.token,
      process.env.SAVE_CARD_SECRET
    );
    const cust_id = customer_payload.customerId;
    const data_key = await getMonersToken(cust_id);

    const charge_res = await chargeMonerisToken(
      'test_00004',
      data_key,
      '0.01',
      cust_id
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({error: "Failed to charge card"});
  }
});

export default router;
