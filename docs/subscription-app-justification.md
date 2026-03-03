# Custom Subscription App — Design Justification

## Summary (for email / Confluence)

Our business runs on **Moneris** for payment processing (rates, reporting, and existing PCI workflows). Shopify’s native subscription features require **Shopify Payments** and do not support Moneris, which would force us onto a different processor and add cost and operational overhead. For that reason we built a **custom app** that handles recurring billing via Moneris (using stored tokens only), then creates matching Shopify orders for fulfillment and accounting. This is a **private integration for our store only**—we are not distributing an app or misrepresenting the billing as Shopify’s. To stay compliant and transparent, we use Moneris tokenization (no raw card data in our systems), display clear customer consent that charges are processed by us via Moneris and are not part of Shopify’s subscription system, and provide straightforward cancellation and card-deletion flows. With those safeguards, this design is a reasonable and defensible way to offer subscriptions while staying on Moneris and avoiding Shopify Payments.

---

## Optional: Bullet version for stakeholders

- **Why custom:** Shopify native subscriptions require Shopify Payments; we need to stay on Moneris (fees, reporting, existing setup).
- **What we built:** Private custom app that charges stored Moneris tokens on a schedule and creates corresponding Shopify orders.
- **Compliance:** Token-only (no raw card data); explicit consent that billing is via us/Moneris, not Shopify; easy cancel and delete-card options.
- **Scope:** Single store, internal use only—not an app for other merchants.
