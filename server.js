import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import saveCardRoute from './routes/saveCard.js';
import createCustomerSessionRoute from './routes/createCustomerSessionRoute.js';
import chargeCardRoute from './routes/chargeCard.js';
import subscriptionRoute from "./routes/subscription.js";
import { runDailySubscriptionBilling } from './services/subscription.js'
// import deleteCardRoute from './routes/deleteCard.js';

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));
app.use(express.json());
app.use(express.static('public'));

app.use('/save-card', saveCardRoute);
app.use('/create-customer-session', createCustomerSessionRoute);
app.use('/charge-card', chargeCardRoute);
app.use("/api/subscription", subscriptionRoute);
// app.use('/delete-card', deleteCardRoute);

app.listen(3000, () =>
  console.log('moneris checkout app running on http://localhost:3000')
);

const dryRun = process.env.SUBSCRIPTION_BILLING_DRY_RUN === false;

runDailySubscriptionBilling(dryRun).catch((err) => {
  console.error('Error running daily subscription billing:', err);
});
