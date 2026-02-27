import { chargeMonerisToken } from "./moneris.js";

export async function getAllSubscriptionOrders() {
  const shop = process.env.SHOPIFY_STORE;
  const accessToken = process.env.SHOPIFY_ADMIN_TOKEN;

  let allSubscriptions = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const query = `
      query GetSubscriptionOrders($cursor: String) {
        metaobjects(
          type: "subscription_order"
          first: 100
          after: $cursor
        ) {
          edges {
            node {
              id
              handle
              fields {
                key
                value
                type
              }
            }
            cursor
          }
          pageInfo {
            hasNextPage
          }
        }
      }
    `;

    const res = await fetch(
      `https://${shop}/admin/api/2024-07/graphql.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        },
        body: JSON.stringify({
          query,
          variables: { cursor }
        })
      }
    );

    const json = await res.json();

    if (json.errors) {
      throw new Error(JSON.stringify(json.errors));
    }

    const page = json.data.metaobjects;

    for (const edge of page.edges) {
      allSubscriptions.push(edge.node);
    }

    hasNextPage = page.pageInfo.hasNextPage;
    cursor = page.edges.at(-1)?.cursor || null;
  }

  return allSubscriptions;
}

function normalizeFields(fields) {
  return fields.reduce((acc, field) => {
    acc[field.key] = field.value;
    return acc;
  }, {});
}

// Get today's date in Eastern Time (yyyy-mm-dd)
function getTodayET() {
  const now = new Date();
  const etDate = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now); // "MM/DD/YYYY"

  // Convert to "YYYY-MM-DD" for easy comparison
  const [month, day, year] = etDate.split('/');
  return `${year}-${month}-${day}`;
}

export function filterActiveAndDue(subscriptions) {
  const todayET = getTodayET();

  return subscriptions.filter(sub => {
    const data = normalizeFields(sub.fields);
    if (data.status !== 'active') return false;
    if (todayET !== data.next_billing_date) return false;

    return true;
  });
}

function parseSubscriptionLineItems(lineItemsRaw) {
  if (!lineItemsRaw) {
    return { currency: "CAD", items: [] };
  }

  try {
    const parsed = JSON.parse(lineItemsRaw);
    return {
      currency: parsed.currency || "CAD",
      items: Array.isArray(parsed.items) ? parsed.items : []
    };
  } catch {
    console.error("Failed to parse subscription_line_items JSON");
    return { currency: "CAD", items: [] };
  }
}

function mapAddressToMailingAddressInput(rawAddress) {
  if (!rawAddress) return null;

  // Your stored address looks like a REST CustomerAddress.
  // GraphQL OrderCreateOrderInput.shippingAddress/billingAddress expect MailingAddressInput
  // with specific, camelCase fields.
  return {
    firstName: rawAddress.first_name,
    lastName: rawAddress.last_name,
    company: rawAddress.company,
    address1: rawAddress.address1,
    address2: rawAddress.address2,
    city: rawAddress.city,
    province: rawAddress.province,
    country: rawAddress.country,
    zip: rawAddress.zip,
    phone: rawAddress.phone
  };
}

function computeTotalAmount(items) {
  return items.reduce((sum, item) => {
    const quantity = Number(item.quantity) || 0;
    const price = item.price !== undefined ? Number(item.price) : 0;
    return sum + quantity * price;
  }, 0);
}

async function fetchVariantPrices(variantIds) {
  if (!variantIds.length) return {};

  const shop = process.env.SHOPIFY_STORE;
  const accessToken = process.env.SHOPIFY_ADMIN_TOKEN;

  const query = `
    query getVariantPrices($ids: [ID!]!) {
      nodes(ids: $ids) {
        ... on ProductVariant {
          id
          price
        }
      }
    }
  `;

  const res = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken
    },
    body: JSON.stringify({ query, variables: { ids: variantIds } })
  });

  const json = await res.json();

  if (json.errors) {
    console.error("fetchVariantPrices GraphQL errors:", json.errors);
    throw new Error("Failed to fetch variant prices");
  }

  const result = {};

  for (const node of json.data.nodes || []) {
    if (!node) continue;
    const amount = Number(node.price);
    if (!isNaN(amount)) {
      result[node.id] = amount;
    }
  }

  return result;
}

function advanceNextBillingDate(currentDate, frequencyNumber, frequencyUnit) {
  if (!currentDate || !frequencyNumber || !frequencyUnit) return currentDate;

  const [year, month, day] = currentDate.split("-").map((v) => Number(v));
  if (!year || !month || !day) return currentDate;

  const date = new Date(Date.UTC(year, month - 1, day));

  switch (frequencyUnit) {
    case "day":
    case "days":
      date.setUTCDate(date.getUTCDate() + Number(frequencyNumber));
      break;
    case "week":
    case "weeks":
      date.setUTCDate(date.getUTCDate() + Number(frequencyNumber) * 7);
      break;
    case "month":
    case "months":
      date.setUTCMonth(date.getUTCMonth() + Number(frequencyNumber));
      break;
    case "year":
    case "years":
      date.setUTCFullYear(date.getUTCFullYear() + Number(frequencyNumber));
      break;
    default:
      return currentDate;
  }

  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function chargeSubscriptionWithMoneris({
  subscriptionId,
  customerId,
  monerisCard,
  totalAmount
}) {
  const orderId = `${subscriptionId}-${Date.now()}`;
  const amountStr = totalAmount.toFixed(2);
  try {
    const stdout = await chargeMonerisToken(
      orderId,
      monerisCard,
      amountStr,
      customerId
    );

    const text = String(stdout).toUpperCase();

    const isApproved =
      text.includes("RESSUCCESS = TRUE") ||
      text.includes("COMPLETE = TRUE") ||
      text.includes("RESPONSECODE = 0") ||
      text.includes("RESPONSECODE = 00");

    if (isApproved) {
      return {
        success: true,
        failureType: null,
        message: "Moneris charge approved",
        raw: stdout
      };
    }

    const isCardFailure =
      text.includes("EXPIRED") ||
      text.includes("DECLINED") ||
      text.includes("INVALID") ||
      text.includes("CARD");

    return {
      success: false,
      failureType: isCardFailure ? "card" : "system",
      message: "Moneris charge not approved",
      raw: stdout
    };
  } catch (error) {
    return {
      success: false,
      failureType: "system",
      message: error.message || "Moneris charge threw error",
      raw: String(error)
    };
  }
}

export async function createShopifyOrder(orderData) {
  const SHOP = process.env.SHOPIFY_STORE; 
  const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

  const mutation = `
    mutation orderCreate($order: OrderCreateOrderInput!) {
      orderCreate(order: $order) {
        order {
          id
          name
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variables = {
    order: {
      customerId: orderData.customerId,

      lineItems: orderData.lineItems,

      shippingAddress: orderData.shippingAddress,
      billingAddress: orderData.billingAddress,

      currency: orderData.currency || "CAD",

      financialStatus: "PAID",

      tags: orderData.tags || [],
      note: orderData.note || "Auto-created subscription order"
    }
  };

  try {
    const response = await fetch(
      `https://${SHOP}/admin/api/2024-07/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": ACCESS_TOKEN,
        },
        body: JSON.stringify({ query: mutation, variables }),
      }
    );

    const json = await response.json();

    if (json.errors) {
      console.error("GraphQL errors:", json.errors);
      throw new Error("GraphQL request failed");
    }

    return json.data.orderCreate;

  } catch (error) {
    console.error("createShopifyOrder error:", error);
    throw error;
  }
}

async function updateSubscriptionMetaobjectFields({
  id,
  next_billing_date,
  status,
  last_billed_order_id
}) {
  const shop = process.env.SHOPIFY_STORE;
  const accessToken = process.env.SHOPIFY_ADMIN_TOKEN;

  const fields = [];

  if (next_billing_date) {
    fields.push({
      key: "next_billing_date",
      value: String(next_billing_date)
    });
  }

  if (status) {
    fields.push({
      key: "status",
      value: String(status)
    });
  }

  if (last_billed_order_id) {
    fields.push({
      key: "last_billed_order_id",
      value: String(last_billed_order_id)
    });
  }

  if (!fields.length) return true;

  const mutation = `
    mutation UpdateSubscriptionMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
      metaobjectUpdate(id: $id, metaobject: $metaobject) {
        metaobject { id }
        userErrors { field message code }
      }
    }
  `;

  const variables = {
    id,
    metaobject: {
      fields
    }
  };

  const response = await fetch(
    `https://${shop}/admin/api/2024-07/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({ query: mutation, variables })
    }
  );

  const data = await response.json();

  if (data.data.metaobjectUpdate.userErrors.length) {
    throw new Error(JSON.stringify(data.data.metaobjectUpdate.userErrors));
  }

  return true;
}

// export async function chargeSubscriptionOrders(dueSubscriptions) {
//   for (const subscription of dueSubscriptions) {
//     try {
//       // 1️⃣ Extract required fields from metaobject
//       const customerField = subscription.fields.find(f => f.key === "customer");
//       const customerId = customerField?.reference?.id;
//       if (!customerId) {
//         console.warn("No customer linked for subscription:", subscription.id);
//         continue;
//       }

//       const monerisCardField = subscription.fields.find(f => f.key === "moneris_card");
//       const monerisCard = monerisCardField?.value;
//       if (!monerisCard) {
//         console.warn("No Moneris card on file for subscription:", subscription.id);
//         continue;
//       }

//       const lineItemsField = subscription.fields.find(f => f.key === "subscription_line_items");
//       const subscriptionLineItems = JSON.parse(lineItemsField?.value || "{}");

//       if (!subscriptionLineItems?.items?.length) {
//         console.warn("No line items for subscription:", subscription.id);
//         continue;
//       }

//       // 2️⃣ Charge the card in Moneris
//       const totalAmount = subscriptionLineItems.items.reduce(
//         (sum, item) => sum + item.quantity * parseFloat(item.price || 0),
//         0
//       );

//       const chargeResult = await chargeMoneris({
//         monerisCard,
//         amount: totalAmount,
//         customerId,
//       });

//       if (!chargeResult.success) {
//         console.error("Moneris charge failed for subscription:", subscription.id, chargeResult.error);
//         continue; // skip creating Shopify order
//       }

//       // 3️⃣ Prepare Shopify order data
//       const shopifyOrderData = {
//         customerId,
//         lineItems: subscriptionLineItems.items.map(item => ({
//           variantId: item.variant_id,
//           quantity: item.quantity,
//         })),
//         shippingAddress: subscription.shipping_address, // optional: if stored in metaobject
//         billingAddress: subscription.billing_address,   // optional: if stored
//         currencyCode: subscriptionLineItems.currency || "CAD",
//         financialStatus: "PAID", // since Moneris charge succeeded
//         transactions: [
//           {
//             kind: "SALE",
//             status: "SUCCESS",
//             amount: totalAmount.toFixed(2),
//             gateway: "Moneris",
//           }
//         ],
//         metafields: [
//           {
//             namespace: "custom",
//             key: "subscription_id",
//             type: "single_line_text_field",
//             value: subscription.id,
//           }
//         ],
//         tags: ["Subscription", "Auto-generated"],
//       };

//       // 4️⃣ Create Shopify order
//       const shopifyResult = await createShopifyOrder(shopifyOrderData); // define this later

//       if (shopifyResult.userErrors?.length) {
//         console.error("Shopify order creation failed:", shopifyResult.userErrors);
//       } else {
//         console.log("Shopify order created:", shopifyResult.order?.id);
//       }

//     } catch (err) {
//       console.error("Error processing subscription:", subscription.id, err);
//     }
//   }
// }

export async function createSubscriptionMetaobject({
  user_id,
  moneris_card,
  subscription_line_items,
  frequency_number,
  frequency_unit,
  shipping_address,
  billing_address,
  next_billing_date,
  status
}) {
  const shop = process.env.SHOPIFY_STORE;
  const accessToken = process.env.SHOPIFY_ADMIN_TOKEN;

  const mutation = `
    mutation CreateSubscription($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
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

  const variables = {
    metaobject: {
      type: "subscription_order",
      capabilities: {
        publishable: {
          status: "ACTIVE"
        }
      },
      fields: [
        { key: "customer_id", value: user_id },
        { key: "moneris_card", value: moneris_card },
        {
          key: "subscription_line_items",
          value: JSON.stringify(subscription_line_items)
        },
        { key: "frequency_number", value: String(frequency_number) },
        { key: "frequency_unit", value: String(frequency_unit) },
        {
          key: "shipping_address",
          value: JSON.stringify(shipping_address)
        },
        {
          key: "billing_address",
          value: JSON.stringify(billing_address)
        },
        { key: "next_billing_date", value: String (next_billing_date)},
        { key: "status", value: String(status) }
      ]
    }
  };
  const response = await fetch(
    `https://${shop}/admin/api/2024-07/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({ query: mutation, variables })
    }
  );

  const data = await response.json();

  if (data.data.metaobjectCreate.userErrors.length) {
    throw new Error(JSON.stringify(data.data.metaobjectCreate.userErrors));
  }

  return data.data.metaobjectCreate.metaobject.id;
}

export async function attachSubscriptionToCustomer({user_id, metaobjectId}) {
  const shop = process.env.SHOPIFY_STORE;
  const accessToken = process.env.SHOPIFY_ADMIN_TOKEN;

  // 1️⃣ Fetch existing cards using the Metafield query directly
  const query = `
    query getCustomerMetafield($id: ID!) {
      customer(id: $id) {
        metafield(namespace: "custom", key: "subscription_orders") {
          value
        }
      }
    }
  `;

  const queryRes = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
    body: JSON.stringify({ query, variables: { id: user_id } })
  });

  const queryData = await queryRes.json();
   // Shopify returns the value as a string; parse it or default to empty array
   const existing = JSON.parse(queryData?.data?.customer?.metafield?.value || '[]');
  
   if (!existing.includes(metaobjectId)) {
     existing.push(metaobjectId);
   } else {
     return true; // Already linked
   }
   // 2️⃣ Use metafieldsSet (Cleaner than customerUpdate)
   const mutation = `
     mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
       metafieldsSet(metafields: $metafields) {
         metafields { id }
         userErrors { field message }
       }
     }
   `;
 
   const mutationRes = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
     method: 'POST',
     headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
     body: JSON.stringify({
       query: mutation,
       variables: {
         metafields: [{
           ownerId: user_id,
           namespace: "custom",
           key: "subscription_orders",
           type: "list.metaobject_reference",
           value: JSON.stringify(existing)
        }]
      }
    })
  });

  const mutationData = await mutationRes.json();
  const errors = mutationData?.errors

  if (errors?.length) {
    console.error("Metafield Set Error:", JSON.stringify(errors));
    throw new Error('Failed to attach subscription');
  }

  return true;
}


export async function attachItemToSubscription({subscription_id, variant_id, quantity}) {
  const shop = process.env.SHOPIFY_STORE;
  const accessToken = process.env.SHOPIFY_ADMIN_TOKEN;

    // Step 1: Fetch the existing metaobject to get current subscription_line_items
    const fetchQuery = `
    query GetSubscriptionMetaobject($id: ID!) {
      metaobject(id: $id) {
        id
        fields {
          key
          value
        }
      }
    }
  `;

  const fetchResponse = await fetch(
    `https://${shop}/admin/api/2024-07/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({ query: fetchQuery, variables: { id: subscription_id } })
    }
  );

  const fetchData = await fetchResponse.json();

  if (!fetchData.data.metaobject) {
    throw new Error("Subscription metaobject not found");
  }

  // Step 2: Parse existing subscription_line_items
  const fields = fetchData.data.metaobject.fields; // flat array
  const lineItemsField = fields.find(f => f.key === "subscription_line_items");

  const currentLineItemsObj = lineItemsField
    ? JSON.parse(lineItemsField.value)
    : { currency: "CAD", items: [] };

  // Work with the items array
  const currentItems = currentLineItemsObj.items;

  // Check if the variant exists
  const existingIndex = currentItems.findIndex(item => item.variant_id === variant_id);
  if (existingIndex >= 0) {
    currentItems[existingIndex].quantity += quantity;
  } else {
    currentItems.push({ variant_id, quantity });
  }

  // Assign back to the object
  currentLineItemsObj.items = currentItems;

  // // Step 4: Update the metaobject
  const mutation = `
    mutation UpdateSubscription($id: ID!, $metaobject: MetaobjectUpdateInput!) {
      metaobjectUpdate(id: $id, metaobject: $metaobject) {
        metaobject { id }
        userErrors { field message code }
      }
    }`;
  const variables = {
    id: subscription_id,
    metaobject: {
      fields: [
        {
          key: "subscription_line_items",
          value: JSON.stringify(currentLineItemsObj)
        }
      ]
    }
  };
  
  const updateResponse = await fetch(
    `https://${shop}/admin/api/2024-07/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": accessToken
      },
      body: JSON.stringify({ query: mutation, variables })
    }
  );

  const updateData = await updateResponse.json();


  if (updateData.data.metaobjectUpdate.userErrors.length) {
    throw new Error(JSON.stringify(updateData.data.metaobjectUpdate.userErrors));
  }
  
  return true;
}

export async function runDailySubscriptionBilling(dryRun = false) {
  console.log(
    `[SubscriptionBilling] Starting runDailySubscriptionBilling (dryRun=${dryRun})`
  );

  const allSubscriptions = await getAllSubscriptionOrders();
  const dueSubscriptions = filterActiveAndDue(allSubscriptions);

  console.log(
    `[SubscriptionBilling] Found ${allSubscriptions.length} total subscriptions, ${dueSubscriptions.length} due today`
  );

  let processed = 0;
  let succeeded = 0;
  let cardFailures = 0;
  let systemFailures = 0;

  for (const subscription of dueSubscriptions) {
    processed += 1;

    try {
      const data = normalizeFields(subscription.fields);

      const customerId = data.customer_id;
      const monerisCard = data.moneris_card;
      const frequencyNumber = data.frequency_number;
      const frequencyUnit = data.frequency_unit;
      const currentNextBillingDate = data.next_billing_date;

      if (!customerId || !monerisCard) {
        console.warn(
          "[SubscriptionBilling] Missing customer_id or moneris_card for subscription",
          subscription.id
        );
        systemFailures += 1;
        continue;
      }

      const lineItemsObj = parseSubscriptionLineItems(
        data.subscription_line_items
      );

      if (!lineItemsObj.items.length) {
        console.warn(
          "[SubscriptionBilling] No subscription_line_items for subscription",
          subscription.id
        );
        systemFailures += 1;
        continue;
      }

      let totalAmount = computeTotalAmount(lineItemsObj.items);

      if (!(totalAmount > 0)) {
        // Fallback: fetch variant prices from Shopify when price is not stored on items
        const variantIds = Array.from(
          new Set(
            lineItemsObj.items
              .map((item) => item.variant_id)
              .filter(Boolean)
          )
        );

        try {
          const priceMap = await fetchVariantPrices(variantIds);

          totalAmount = lineItemsObj.items.reduce((sum, item) => {
            const quantity = Number(item.quantity) || 0;
            const variantPrice =
              item.price !== undefined
                ? Number(item.price)
                : priceMap[item.variant_id] ?? 0;
            return sum + quantity * variantPrice;
          }, 0);
        } catch (err) {
          console.error(
            "[SubscriptionBilling] Failed to fetch variant prices for subscription",
            subscription.id,
            err
          );
          systemFailures += 1;
          continue;
        }
      }

      if (!(totalAmount > 0)) {
        console.warn(
          "[SubscriptionBilling] Computed totalAmount is not > 0 for subscription",
          subscription.id
        );
        systemFailures += 1;
        continue;
      }

      const rawShippingAddress = data.shipping_address
        ? JSON.parse(data.shipping_address)
        : null;
      const rawBillingAddress = data.billing_address
        ? JSON.parse(data.billing_address)
        : null;

      const shippingAddress = mapAddressToMailingAddressInput(
        rawShippingAddress
      );
      const billingAddress = mapAddressToMailingAddressInput(rawBillingAddress);

      console.log(
        "[SubscriptionBilling] Processing subscription",
        subscription.id,
        "customer",
        customerId,
        "amount",
        totalAmount.toFixed(2),
        "currency",
        lineItemsObj.currency
      );

      if (dryRun) {
        console.log(
          "[SubscriptionBilling] DRY RUN - would charge Moneris and create Shopify order for subscription",
          subscription.id
        );
        continue;
      }
      const chargeResult = await chargeSubscriptionWithMoneris({
        subscriptionId: subscription.id,
        customerId,
        monerisCard,
        totalAmount
      });

      if (!chargeResult.success) {
        console.error(
          "[SubscriptionBilling] Moneris charge failed for subscription",
          subscription.id,
          "type",
          chargeResult.failureType,
          "message",
          chargeResult.message
        );

        if (chargeResult.failureType === "card") {
          cardFailures += 1;
          await updateSubscriptionMetaobjectFields({
            id: subscription.id,
            status: "card_failed"
          });
        } else {
          systemFailures += 1;
        }

        continue;
      }

      const orderData = {
        customerId,
        lineItems: lineItemsObj.items.map((item) => ({
          variantId: item.variant_id,
          quantity: item.quantity
        })),
        shippingAddress,
        billingAddress,
        currency: lineItemsObj.currency || "CAD",
        tags: ["Subscription", "Auto-generated"],
        note: `Auto-created subscription order for ${subscription.id}`
      };

      const orderResult = await createShopifyOrder(orderData);

      if (orderResult.userErrors && orderResult.userErrors.length) {
        console.error(
          "[SubscriptionBilling] Shopify order creation failed for subscription",
          subscription.id,
          orderResult.userErrors
        );
        systemFailures += 1;
        continue;
      }

      console.log(
        "[SubscriptionBilling] Shopify order created for subscription",
        subscription.id,
        "orderId",
        orderResult.order?.id,
        "orderName",
        orderResult.order?.name
      );

      const orderId = orderResult.order?.id || null;

      const nextBillingDate = advanceNextBillingDate(
        currentNextBillingDate,
        frequencyNumber,
        frequencyUnit
      );

      await updateSubscriptionMetaobjectFields({
        id: subscription.id,
        next_billing_date: nextBillingDate,
        status: "active",
        last_billed_order_id: orderId
      });

      succeeded += 1;
    } catch (error) {
      console.error(
        "[SubscriptionBilling] Unexpected error processing subscription",
        subscription.id,
        error
      );
      systemFailures += 1;
    }
  }

  console.log(
    `[SubscriptionBilling] Finished runDailySubscriptionBilling - processed=${processed}, succeeded=${succeeded}, cardFailures=${cardFailures}, systemFailures=${systemFailures}`
  );

  return {
    processed,
    succeeded,
    cardFailures,
    systemFailures
  };
}