const mysql = require('mysql2/promise');


// 連線到資料庫
async function connectToDatabase() {
  const pool = await mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'puppeteer_crawler'
  });

  const connection = await pool.getConnection();

  return connection;
}

module.exports = connectToDatabase;