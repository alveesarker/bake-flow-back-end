require("dotenv").config({ quiet: true });
const app = require("./app");
const { testConnection } = require("./config/db");

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
  console.log(`🚀 BakeFlow API running on http://localhost:${PORT}`);

  try {
    await testConnection();
    console.log(`✅ Connected to MySQL database "${process.env.DB_NAME || "bakeflow"}"`);
  } catch (err) {
    console.error("❌ Could not connect to MySQL:", err.message);
    console.error(
      "   Check DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME in your .env file."
    );
  }
});
