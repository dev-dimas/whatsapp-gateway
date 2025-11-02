#!/usr/bin/env node

/**
 * Example script demonstrating multi-account WhatsApp Gateway usage
 *
 * Usage:
 *   1. Make sure the server is running
 *   2. Update API_KEY and BASE_URL below
 *   3. Run: node examples/multi-account-example.js
 */

const axios = require("axios");

// Configuration
const BASE_URL = "http://localhost";
const API_KEY = "your-secret-api-key-change-this";

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json",
  },
});

// Helper function for delays
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  console.log("🚀 WhatsApp Multi-Account Gateway - Example Script\n");

  try {
    // 1. Create a new account
    console.log("1️⃣  Creating new account...");
    const createResponse = await api.post("/accounts", {
      accountId: "example-account",
      name: "Example Account",
    });
    console.log("✅ Account created:", createResponse.data.data);
    console.log("");

    // Wait for initialization
    await sleep(3000);

    // 2. Get QR code URL
    console.log("2️⃣  QR Code available at:");
    console.log(`   ${BASE_URL}/accounts/example-account/qr`);
    console.log("   👉 Open this URL in a browser and scan with WhatsApp\n");

    // 3. Wait for user to scan (check status)
    console.log("3️⃣  Waiting for QR scan...");
    let connected = false;
    let attempts = 0;
    const maxAttempts = 60; // 2 minutes

    while (!connected && attempts < maxAttempts) {
      await sleep(2000);
      const statusResponse = await api.get("/accounts/example-account/status");
      const status = statusResponse.data;

      if (status.isConnected) {
        connected = true;
        console.log(`✅ Connected! Phone: ${status.phoneNumber}\n`);
      } else if (status.status === "connecting") {
        process.stdout.write(".");
        attempts++;
      } else {
        console.log(`   Status: ${status.status}`);
        attempts++;
      }
    }

    if (!connected) {
      console.log(
        "\n⚠️  Timeout waiting for connection. Please scan the QR code manually."
      );
      console.log("   You can still use the account once connected.\n");
      return;
    }

    // 4. List all accounts
    console.log("4️⃣  Listing all accounts...");
    const listResponse = await api.get("/accounts");
    console.log("✅ Active accounts:", listResponse.data.data.length);
    listResponse.data.data.forEach((acc) => {
      console.log(`   - ${acc.accountId} (${acc.accountName}): ${acc.status}`);
      if (acc.messageStats) {
        console.log(
          `     Messages: ${acc.messageStats.dailyCount}/${acc.messageStats.dailyLimit} today`
        );
      }
    });
    console.log("");

    // 5. Send a test message (optional - uncomment and add phone number)
    /*
    console.log('5️⃣  Sending test message...');
    const messageResponse = await api.post('/accounts/example-account/message', {
      phoneNumber: '+1234567890', // Replace with actual number
      message: 'Hello from WhatsApp Multi-Account Gateway! 🚀',
    });
    console.log('✅ Message sent:', messageResponse.data.message);
    console.log('');
    */

    // 6. Get account details
    console.log("5️⃣  Getting account details...");
    const detailsResponse = await api.get("/accounts/example-account");
    const details = detailsResponse.data.data;
    console.log("✅ Account details:");
    console.log(`   ID: ${details.accountId}`);
    console.log(`   Name: ${details.name}`);
    console.log(`   Phone: ${details.phoneNumber}`);
    console.log(`   Status: ${details.status}`);
    console.log(`   Last Connected: ${details.lastConnected}`);
    if (details.connectionStatus && details.connectionStatus.messageStats) {
      const stats = details.connectionStatus.messageStats;
      console.log(`   Hourly Usage: ${stats.hourlyCount}/${stats.hourlyLimit}`);
      console.log(`   Daily Usage: ${stats.dailyCount}/${stats.dailyLimit}`);
    }
    console.log("");

    console.log("✨ Example completed successfully!");
    console.log("");
    console.log("📚 Next steps:");
    console.log(
      "   - Send messages via POST /accounts/example-account/message"
    );
    console.log("   - Create more accounts for load distribution");
    console.log("   - Check API_DOCUMENTATION.md for full API reference");
    console.log("");
    console.log("🧹 Cleanup:");
    console.log("   To delete this example account, run:");
    console.log(
      `   curl -X DELETE "${BASE_URL}/accounts/example-account" -H "X-API-Key: ${API_KEY}"`
    );
    console.log("");
  } catch (error) {
    console.error("\n❌ Error:", error.response?.data || error.message);

    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log(
        "\n💡 Tip: Make sure API_KEY is correctly set in this script and .env file"
      );
    }

    if (error.code === "ECONNREFUSED") {
      console.log(
        "\n💡 Tip: Make sure the server is running (yarn dev or yarn start)"
      );
    }
  }
}

// Run the example
main().catch(console.error);
