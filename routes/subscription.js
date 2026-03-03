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

router.post("/delete", async (req, res) => {
  try {
    const { subscriptionId, customerGid } = req.body;

    if (!subscriptionId || !customerGid) {
      return res.status(400).json({ error: "Missing subscription_id or user_id" });
    }

    const shop = process.env.SHOPIFY_STORE;
    const accessToken = process.env.SHOPIFY_ADMIN_TOKEN;

    const getMetaQuery = `
      query getCustomerSubscriptions($id: ID!) {
        customer(id: $id) {
          metafield(namespace: "custom", key: "subscription_orders") {
            value
          }
        }
      }
    `;

    let response = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({ query: getMetaQuery, variables: { id: customerGid } }),
    });

    let json = await response.json();
    const existing = JSON.parse(json?.data?.customer?.metafield?.value || "[]");

    const updated = existing.filter((id) => id !== subscriptionId);

    const setMetaMutation = `
      mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields { id }
          userErrors { field message }
        }
      }
    `;

    response = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: setMetaMutation,
        variables: {
          metafields: [
            {
              ownerId: customerGid,
              namespace: "custom",
              key: "subscription_orders",
              type: "list.metaobject_reference",
              value: JSON.stringify(updated),
            },
          ],
        },
      }),
    });

    json = await response.json();
    const metaErrors = json?.data?.metafieldsSet?.userErrors;
    if (metaErrors && metaErrors.length) {
      console.error("subscription_orders metafieldsSet error:", metaErrors);
      return res.status(500).json({ error: "Failed to update customer subscriptions" });
    }

    const deleteMutation = `
      mutation metaobjectDelete($id: ID!) {
        metaobjectDelete(id: $id) {
          deletedId
          userErrors { field message }
        }
      }
    `;

    response = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken,
      },
      body: JSON.stringify({
        query: deleteMutation,
        variables: { id: subscriptionId },
      }),
    });

    json = await response.json();
    const delErrors = json?.data?.metaobjectDelete?.userErrors;
    if (delErrors && delErrors.length) {
      console.error("metaobjectDelete error:", delErrors);
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Delete subscription error:", error);
    res.status(500).json({ error: "Failed to delete subscription" });
  }
});

export default router;
