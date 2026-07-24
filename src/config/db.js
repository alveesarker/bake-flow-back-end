const mysql = require("mysql2/promise");
require("dotenv").config({ quiet: true });

// A connection pool is reused across requests instead of opening a new
// MySQL connection for every API call.
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "bakeflow",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true, // return DATE/DATETIME columns as plain strings
});

/**
 * Quick connectivity check used on server startup so we can log a clear
 * success/failure message instead of only failing on the first request.
 */
async function testConnection() {
  const connection = await pool.getConnection();
  try {
    await connection.ping();
  } finally {
    connection.release();
  }
}

module.exports = { pool, testConnection };
