import { spawn } from "child_process";
import path from "path";

// const JAVA_BIN = process.env.JAVA_BIN || 'java';

/**
 * Create a Moneris Checkout ticket
 * @param {Object} payload - The payload to send to Moneris Checkout
 * @returns {Promise<Object>} - The response from Moneris
 */
export async function createCheckoutTicket(payload) {
  try {

    const resMoneris = await fetch("https://gateway.moneris.com/chkt/request/request.php", {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: JSON.stringify(payload)
    });
    const data = await resMoneris.json();
    const monerisResponse = data.response;
    const ticket = monerisResponse.ticket;
    return ticket;
  } catch (error) {
    console.error('Error creating Moneris ticket:', error);
    throw error;
  }
}

export async function getMonerisReceipt(payload) {
  try {
    const res = await fetch("https://gateway.moneris.com/chkt/request/request.php", {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: JSON.stringify(payload)
    });  
    const data = await res.json();
    return data;
  } catch (error) {
    console.error('Error creating Moneris receipt:', error);
    throw error;
  }
}

async function resolveMonerisDataKey(data_key) {
  const value = String(data_key || "");

  // If it's not a Shopify metaobject ID, assume it's already the token
  if (!value.startsWith("gid://shopify/Metaobject/")) {
    return value;
  }

  const shop = process.env.SHOPIFY_STORE;
  const accessToken = process.env.SHOPIFY_ADMIN_TOKEN;

  if (!shop || !accessToken) {
    throw new Error("SHOPIFY_STORE or SHOPIFY_ADMIN_TOKEN is not set");
  }

  const query = `
    query getMonerisCardMetaobject($id: ID!) {
      metaobject(id: $id) {
        id
        fields {
          key
          value
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
    body: JSON.stringify({ query, variables: { id: value } })
  });

  const json = await res.json();

  if (json.errors) {
    console.error("resolveMonerisDataKey GraphQL errors:", json.errors);
    throw new Error("Failed to fetch moneris_card metaobject");
  }

  const fields = json.data?.metaobject?.fields || [];
  const tokenField = fields.find((f) => f.key === "token");
  const token = tokenField?.value;

  if (!token) {
    throw new Error("Moneris token not found on moneris_card metaobject");
  }

  return token;
}

export async function chargeMonerisToken(
  order_id,
  data_key,
  amount,
  cust_id
) {
  const resolvedDataKey = await resolveMonerisDataKey(data_key);

  return new Promise((resolve, reject) => {
    const javaProcess = spawn(
      "java",
      [
        "-cp",
        ".;JavaAPI.jar",
        "ProdCanadaResPurchaseCC",
        order_id,
        resolvedDataKey,
        amount,
        cust_id
      ],
      {
        cwd: path.resolve("./services/moneris-java"),
        env: {
          ...process.env
        }
      }
    );

    let stdout = "";
    let stderr = "";

    javaProcess.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    javaProcess.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    javaProcess.on("close", (code) => {
      if (code !== 0) {
        console.error("Java error:", stderr);
        return reject(new Error(stderr));
      }

      resolve(stdout);
    });
  });
}