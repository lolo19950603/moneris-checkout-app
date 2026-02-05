import express from 'express';
import { createCheckoutTicket, getMonerisReceipt } from '../services/moneris.js';
import { createMonerisCardMetaobject, attachCardToCustomer } from '../services/shopify.js';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Preload route (already exists)
router.get('/preload', async (req, res) => {
  try {
    const customer_payload = jwt.verify(
      req.query.token,
      process.env.SAVE_CARD_SECRET
    );
    const customerId = customer_payload.customerId;
    const moneris_payload = {
      store_id: process.env.MONERIS_STORE_ID,
      api_token: process.env.MONERIS_API_TOKEN,
      checkout_id: process.env.MONERIS_SAVE_CARD_CHECKOUT_ID,
      txn_total: "0.00",
      cust_id:customerId,
      environment: "prod",
      action: "preload"
    };
    const ticket = await createCheckoutTicket(moneris_payload);
    res.redirect(`/save-card.html?ticket=${encodeURIComponent(ticket)}`);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create ticket' });
  }
});

router.post('/save-to-shopify-customer', async (req, res) => {
  const { ticket } = req.body;
  const payload = {
    store_id: process.env.MONERIS_STORE_ID,
    api_token: process.env.MONERIS_API_TOKEN,
    checkout_id: process.env.MONERIS_SAVE_CARD_CHECKOUT_ID,
    ticket: ticket,
    environment: "prod",
    action: 'receipt'
  };

  try {
    // 1. Get the receipt from Moneris to retrieve the card data
    const receipt = await getMonerisReceipt(payload); // call Moneris receipt API
    const token = receipt.response?.receipt?.cc?.tokenize?.datakey;
    const cust_id = receipt.response?.receipt?.cc?.cust_id;
    const first6last4 = receipt.response?.receipt?.cc?.first6last4;
    const last4 = first6last4.slice(-4);
    const expiry_date = receipt.response?.receipt?.cc?.expiry_date;
    const card_data = { //use static customer id for now
      token: token,
      last4: last4,
      expiry_date: expiry_date
    };
    // 2. Create a metaobject in Shopify to store the card data
    const shopify_metaobject_id = await createMonerisCardMetaobject(card_data);
    // 3. Attach the metaobject to the customer
    const shopify_save_res = await attachCardToCustomer(cust_id, shopify_metaobject_id);
    res.json({ success: shopify_save_res });
  } catch (err) {
    console.error(err);
    res.status(500).json({error: "Failed to get a receipt"});
  }
});


export default router;
