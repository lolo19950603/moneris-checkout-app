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

export function chargeMonerisToken(
  order_id,
  data_key,
  amount,
  cust_id
) {
  return new Promise((resolve, reject) => {
    const javaProcess = spawn(
      'java',
      [
        "-cp",
        ".;JavaAPI.jar",
        "ProdCanadaResPurchaseCC",
        order_id,
        data_key,
        amount,
        cust_id
      ],
      {
        cwd: path.resolve("./services/moneris-java"),
        env: {
          ...process.env,
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

      // You can return raw output or parse it
      resolve(stdout);
    });
  });
}