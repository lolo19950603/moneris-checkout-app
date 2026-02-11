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

    // const nextBilling = new Date(data.nextBillingAt);

    // if (isNaN(nextBilling)) return false;

    // return nextBilling <= now;
    return true
  });
}

async function createSubscriptionMetaobject({
  customerId,
  variantIds,
  frequencyDays,
  monerisCardId
}) {

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
      fields: [
        { key: "customer_id", value: customerId },
        { key: "moneris_card", value: monerisCardId },
        { key: "frequency_days", value: String(frequencyDays) },
        {
          key: "items",
          value: variantIds
        },
        { key: "status", value: "active" }
      ]
    }
  };

  const response = await fetch(
    `https://${process.env.SHOPIFY_STORE}/admin/api/2024-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_TOKEN
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


