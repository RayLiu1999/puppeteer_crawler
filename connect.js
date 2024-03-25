const mysql = require('mysql2/promise');


// 連線到資料庫
async function connectToDatabase() {
  const connection = await mysql.createPool({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'puppeteer_crawler'
  });

  return connection;
}

module.exports = connectToDatabase;