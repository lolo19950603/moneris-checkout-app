import express from "express";
import {createSubscriptionMetaobject, attachSubscriptionToCustomer, attachItemToSubscription} from "../services/subscription.js"

const router = express.Router();

router.post("/create", async (req, res) => {
  try {
    const {
      user_id,
      moneris_card,
      subscription_line_items,
      frequency_number,
      frequency_unit,
      shipping_address,
      billing_address,
      next_billing_date,
      status
    } = req.body;

    if (
      !user_id ||
      !moneris_card ||
      !subscription_line_items ||
      !frequency_number ||
      !frequency_unit ||
      !shipping_address ||
      !billing_address ||
      !next_billing_date ||
      !status
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const metaobjectId = await createSubscriptionMetaobject({
      user_id,
      moneris_card,
      subscription_line_items,
      frequency_number,
      frequency_unit,
      shipping_address,
      billing_address,
      next_billing_date,
      status
    });
    
    const result = await attachSubscriptionToCustomer({user_id, metaobjectId});
    res.json({ success: result});

  } catch (error) {
    console.error("Create subscription error:", error);
    res.status(500).json({ error: "Failed to create subscription" });
  }
});

router.post("/add-item", async (req, res) => {
  try {
    const {
      subscription_id,
      variant_id,
      quantity
    } = req.body;

    if (
      !subscription_id ||
      !variant_id ||
      !quantity
    ) {
      return res.status(400).json({ error: "Missing required fields" });
    }
  
    const result = await attachItemToSubscription({subscription_id, variant_id, quantity});

    res.json({ success: result });
  } catch (error) {
    console.error("Create subscription error:", error);
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

export default router;
