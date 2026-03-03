import express from "express";

const router = express.Router();

router.post("/delete", async (req, res) => {
  try {
    const { cardId, customerGid } = req.body;

    if (!cardId || !customerGid) {
      return res.status(400).json({ error: "Missing cardId or customerId" });
    }

    const shop = process.env.SHOPIFY_STORE;
    const accessToken = process.env.SHOPIFY_ADMIN_TOKEN;

    const getMetaQuery = `
      query getCustomerMonerisCards($id: ID!) {
        customer(id: $id) {
          metafield(namespace: "custom", key: "moneris_cards") {
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

    const updated = existing.filter((id) => id !== cardId);

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
              key: "moneris_cards",
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
      console.error("moneris_cards metafieldsSet error:", metaErrors);
      return res.status(500).json({ error: "Failed to update customer cards" });
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
        variables: { id: cardId },
      }),
    });

    json = await response.json();
    const delErrors = json?.data?.metaobjectDelete?.userErrors;
    if (delErrors && delErrors.length) {
      console.error("metaobjectDelete error:", delErrors);
    }

    res.json({ success: true });
  } catch (err) {
    console.error("deleteCard error:", err);
    res.status(500).json({ error: "Failed to delete card" });
  }
});

export default router;

