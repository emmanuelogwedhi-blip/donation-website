const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const donations = require("./donations");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Donation server is running");
});

app.get("/donations", (req, res) => {
  res.json(donations);
});

async function getAccessToken() {
  const url =
    "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";

  const auth = Buffer.from(
    `${process.env.CONSUMER_KEY}:${process.env.CONSUMER_SECRET}`
  ).toString("base64");

  const response = await axios.get(url, {
    headers: {
      Authorization: `Basic ${auth}`,
    },
  });

  return response.data.access_token;
}

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

    const stkData = {
      BusinessShortCode: process.env.SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: Number(amount),

      PartyA: "254708374149",
      PartyB: process.env.SHORTCODE,
      PhoneNumber: "254708374149",

      CallBackURL: "https://mydomain.com/callback",
      AccountReference: "Donation",
      TransactionDesc: "Donation Payment",
    };

    const response = await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      stkData,
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
      receipt: "Waiting",
      checkoutRequestID: response.data.CheckoutRequestID,
      merchantRequestID: response.data.MerchantRequestID,
      date: new Date().toLocaleString(),
    });

    res.json(response.data);

  } catch (error) {
    console.log("M-Pesa Error:", error.response?.data || error.message);

    res.status(500).json({
      success: false,
      message: "M-Pesa request failed",
      error: error.response?.data || error.message,
    });
  }
});

app.post("/callback", (req, res) => {
  console.log("M-Pesa Callback Received:");
  console.log(JSON.stringify(req.body, null, 2));

  const callback = req.body.Body?.stkCallback;

  if (callback) {
    const donation = donations.find(
      item => item.checkoutRequestID === callback.CheckoutRequestID
    );

    if (donation) {
      if (callback.ResultCode === 0) {
        donation.status = "Successful";

        const metadata = callback.CallbackMetadata?.Item || [];
        const receiptItem = metadata.find(
          item => item.Name === "MpesaReceiptNumber"
        );

        donation.receipt = receiptItem ? receiptItem.Value : "Paid";
      } else {
        donation.status = "Failed";
        donation.receipt = "Failed";
      }
    }
  }

  res.json({
    ResultCode: 0,
    ResultDesc: "Callback received successfully",
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});