import express from "express";
import {createSubscriptionMetaobject} from "../services/subscription"

const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { customerId, variantIds, frequencyDays, monerisCardId } = req.body;

    if (!customerId || !variantIds?.length || !frequencyDays || !monerisCardId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const metaobjectId = await createSubscriptionMetaobject({
      customerId,
      variantIds,
      frequencyDays,
      monerisCardId
    });

    res.json({ success: true, metaobjectId });

  } catch (error) {
    console.error("Create subscription error:", error);
    res.status(500).json({ error: "Failed to create subscription" });
  }
});

export default router;
