const express = require("express");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

let donations = [];

// Pages
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "login.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// Donation data
app.get("/donations", (req, res) => {
  res.json(donations);
});

// M-Pesa access token
async function getAccessToken() {
  const auth = Buffer.from(
    `${process.env.CONSUMER_KEY}:${process.env.CONSUMER_SECRET}`
  ).toString("base64");

  const response = await axios.get(
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    }
  );

  return response.data.access_token;
}

// Donation route
app.post("/donate", async (req, res) => {
  try {
    const { name, phone, amount, message } = req.body;

    const accessToken = await getAccessToken();

    const timestamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, "")
      .slice(0, 14);

    const password = Buffer.from(
      `${process.env.SHORTCODE}${process.env.PASSKEY}${timestamp}`
    ).toString("base64");

    const stkPush = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      {
        BusinessShortCode: process.env.SHORTCODE,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Number(amount),
        PartyA: phone,
        PartyB: process.env.SHORTCODE,
        PhoneNumber: phone,
        CallBackURL: "https://donation-website-xm7u.onrender.com/callback",
        AccountReference: "Donation",
        TransactionDesc: "Donation Payment",
      },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
      }
    );

    donations.push({
      name,
      phone,
      amount: Number(amount),
      message: message || "",
      status: "Pending",
      checkoutRequestID: stkPush.data.CheckoutRequestID,
      merchantRequestID: stkPush.data.MerchantRequestID,
      date: new Date(),
    });

    res.json(stkPush.data);
  } catch (error) {
    console.log("M-Pesa Error:", error.response?.data || error.message);

    res.status(500).json({
      success: false,
      message:
        error.response?.data?.errorMessage || "M-Pesa request failed",
    });
  }
});

// Callback route
app.post("/callback", (req, res) => {
  console.log("M-Pesa Callback Received");
  console.log(JSON.stringify(req.body, null, 2));

  res.json({
    ResultCode: 0,
    ResultDesc: "Callback received successfully",
  });
});

// 404 page
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "404.html"));
});

// Start server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
