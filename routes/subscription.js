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

router.post("/update", async (req, res) => {
  try {
    const {
      subscriptionId,
      customerGid,
      subscription_line_items,
      status,
      frequency_number,
      frequency_unit,
      next_billing_date,
      moneris_card,
      shipping_address,
      billing_address,
    } = req.body;

    if (
      !subscriptionId ||
      !subscription_line_items ||
      !status ||
      !frequency_number ||
      !frequency_unit
    ) {
      return res.status(400).json({
        error:
          "Missing subscriptionId, subscription_line_items, status, frequency_number, or frequency_unit",
      });
    }

    const shop = process.env.SHOPIFY_STORE;
    const accessToken = process.env.SHOPIFY_ADMIN_TOKEN;

    const mutation = `
      mutation subscriptionUpdate($id: ID!, $fields: [MetaobjectFieldInput!]!) {
        metaobjectUpdate(id: $id, metaobject: { fields: $fields }) {
          metaobject {
            id
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const fields = [
      {
        key: "subscription_line_items",
        value: JSON.stringify(subscription_line_items),
      },
      {
        key: "status",
        value: String(status),
      },
      {
        key: "frequency_number",
        value: String(frequency_number),
      },
      {
        key: "frequency_unit",
        value: String(frequency_unit),
      },
    ];

    if (next_billing_date != null && next_billing_date !== "") {
      fields.push({ key: "next_billing_date", value: String(next_billing_date) });
    }
    if (moneris_card != null && moneris_card !== "") {
      fields.push({ key: "moneris_card", value: String(moneris_card) });
    }
    if (shipping_address != null) {
      fields.push({
        key: "shipping_address",
        value: JSON.stringify(shipping_address),
      });
    }
    if (billing_address != null) {
      fields.push({
        key: "billing_address",
        value: JSON.stringify(billing_address),
      });
    }

    const response = await fetch(
      `https://${shop}/admin/api/2024-07/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query: mutation,
          variables: {
            id: subscriptionId,
            fields,
          },
        }),
      }
    );

    const json = await response.json();
    const errors = json?.data?.metaobjectUpdate?.userErrors;

    if (errors && errors.length) {
      console.error("metaobjectUpdate userErrors:", errors);
      return res.status(500).json({ error: "Failed to update subscription" });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("Update subscription error:", error);
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

export default router;
