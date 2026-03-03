// scripts/createTestSubscriptions.js
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env") });

import {
  createSubscriptionMetaobject,
  attachSubscriptionToCustomer,
} from "../services/subscription.js";

const CUSTOMER_1 = "gid://shopify/Customer/10133284979008";
const CUSTOMER_2 = "gid://shopify/Customer/10088121237824";
const MONERIS_CARD = "gid://shopify/Metaobject/178021957952";

const subscriptionLineItems = {
  currency: "CAD",
  items: [
    {
      variant_id: "gid://shopify/ProductVariant/51522619965760",
      quantity: 1,
    },
  ],
};

const rawAddress = {
  id: 11831826940224,
  customer_id: 10133284979008,
  first_name: "Loren",
  last_name: "Testing",
  company: null,
  address1: "123 Main St",
  address2: "Apt 4B",
  city: "Toronto",
  province: "Ontario",
  country: "Canada",
  zip: "M5V 3L9",
  phone: "4160000000",
  name: "Loren Testing",
  province_code: "ON",
  country_code: "CA",
  country_name: "Canada",
  default: true,
};

const NEXT_BILLING_DATE = "2026-03-02";

async function createAndAttachSubscription(userId, index) {
  const metaobjectId = await createSubscriptionMetaobject({
    user_id: userId,
    moneris_card: MONERIS_CARD,
    subscription_line_items: subscriptionLineItems,
    frequency_number: 1,
    frequency_unit: "month",
    shipping_address: rawAddress,
    billing_address: rawAddress,
    next_billing_date: NEXT_BILLING_DATE,
    status: "active",
  });

  await attachSubscriptionToCustomer({
    user_id: userId,
    metaobjectId,
  });

  console.log(
    `Created subscription #${index + 1} for customer ${userId}: ${metaobjectId}`
  );
}

async function main() {
  if (!process.env.SHOPIFY_STORE || !process.env.SHOPIFY_ADMIN_TOKEN) {
    console.error(
      "Missing SHOPIFY_STORE or SHOPIFY_ADMIN_TOKEN. Check your .env file."
    );
    process.exit(1);
  }

  try {
    // First 5 for customer 1
    for (let i = 0; i < 5; i++) {
      await createAndAttachSubscription(CUSTOMER_1, i);
    }

    // Next 5 for customer 2
    for (let i = 0; i < 5; i++) {
      await createAndAttachSubscription(CUSTOMER_2, 5 + i);
    }

    console.log("Done creating 10 subscription metaobjects.");
  } catch (err) {
    console.error("Error seeding subscriptions:", err);
    process.exit(1);
  }
}

main();