export async function createMonerisCardMetaobject({
  token,
  last4,
  expiry_date
}) {
  const shop = process.env.SHOPIFY_STORE;
  const accessToken = process.env.SHOPIFY_ADMIN_TOKEN;

  const mutation = `
    mutation metaobjectCreate($metaobject: MetaobjectCreateInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject { id }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    metaobject: {
      type: "moneris_card",
      capabilities: {
        publishable: {
          status: "ACTIVE"
        }
      },
      fields: [
        { key: "token", value: token },
        { key: "last4", value: last4 },
        { key: "expiry", value: expiry_date },
      ]
    }
  };

  const res = await fetch(
    `https://${shop}/admin/api/2024-07/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken
      },
      body: JSON.stringify({ query: mutation, variables })
    }
  );

  const data = await res.json();

  if (data.errors || data.data.metaobjectCreate.userErrors.length) {
    console.log(
      JSON.stringify('Failed to create metaobject:', data.data.metaobjectCreate.userErrors, null, 2)
    );
    throw new Error('Failed to create metaobject');
  }
  
  return data.data.metaobjectCreate.metaobject.id;
}

export async function attachCardToCustomer(customer_id, metaobjectId) {
  const shop = process.env.SHOPIFY_STORE;
  const accessToken = process.env.SHOPIFY_ADMIN_TOKEN;

  // 1️⃣ Fetch existing cards using the Metafield query directly
  const query = `
    query getCustomerMetafield($id: ID!) {
      customer(id: $id) {
        metafield(namespace: "custom", key: "moneris_cards") {
          value
        }
      }
    }
  `;

  const queryRes = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
    body: JSON.stringify({ query, variables: { id: customer_id } })
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
           ownerId: customer_id,
           namespace: "custom",
           key: "moneris_cards",
           type: "list.metaobject_reference",
           value: JSON.stringify(existing)
        }]
      }
    })
  });

  const mutationData = await mutationRes.json();
  const errors = mutationData?.data?.metafieldsSet?.userErrors;

  if (errors?.length) {
    console.error("Metafield Set Error:", JSON.stringify(errors));
    throw new Error('Failed to attach card');
  }

  return true;
}

export async function getMonersToken(customer_id) {
  const shop = process.env.SHOPIFY_STORE;
  const accessToken = process.env.SHOPIFY_ADMIN_TOKEN;

  // 1️⃣ Fetch existing cards using the Metafield query directly
  let query = `
    query getCustomerMetafield($id: ID!) {
      customer(id: $id) {
        metafield(namespace: "custom", key: "moneris_cards") {
          value
        }
      }
    }
  `;

  let queryRes = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': accessToken },
    body: JSON.stringify({ query, variables: { id: customer_id } })
  });

  let queryData = await queryRes.json();
  const existing = JSON.parse(queryData?.data?.customer?.metafield?.value || '[]');


  query = `
    query getMetaobject($id: ID!) {
      metaobject(id: $id) {
        id
        type
        handle
        fields {
          key
          value
          type
        }
      }
    }
  `;

  queryRes = await fetch(`https://${shop}/admin/api/2024-07/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': accessToken
    },
    body: JSON.stringify({ query, variables: { id: existing[0] } })
  });

  queryData = await queryRes.json();

  return queryData.data?.metaobject?.fields.find(field => field.key === 'token')?.value;
}
