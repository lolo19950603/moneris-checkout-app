import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import saveCardRoute from './routes/saveCard.js';
import createCustomerSessionRoute from './routes/createCustomerSessionRoute.js';
import chargeCardRoute from './routes/chargeCard.js';
import createSubscriptionRoute from "./routes/createSubscription.js";
import {getAllSubscriptionOrders, filterActiveAndDue} from './services/subscription.js'
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
app.use("/api/subscription/create", createSubscriptionRoute);
// app.use('/delete-card', deleteCardRoute);

app.listen(3000, () =>
  console.log('moneris checkout app running on http://localhost:3000')
);

const allSubscriptions = await getAllSubscriptionOrders();

const dueSubscriptions = filterActiveAndDue(allSubscriptions);

console.log(
  `Found ${dueSubscriptions.length} subscriptions due for billing`
);
