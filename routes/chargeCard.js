import express from 'express';
import { createCheckoutTicket } from '../services/moneris.js';

const router = express.Router();


router.get('/preload', async (req, res) => {

  const payload = {
    "store_id":process.env.MONERIS_STORE_ID,
    "api_token":process.env.MONERIS_API_TOKEN,
    "checkout_id":process.env.MONERIS_SAVE_CARD_CHECKOUT_ID,
    "txn_total":"0.00",
    "environment":"prod",
    "action":"preload"
 }

  try {
    const ticket = await createCheckoutTicket(payload);
    res.redirect(`/save-card.html?ticket=${encodeURIComponent(ticket)}`);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

export default router;
