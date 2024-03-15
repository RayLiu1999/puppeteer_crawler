const connection = require('./connect.js');
const puppeteer = require("puppeteer");
const fs = require("fs");

let urls = [];

// 撈公司網址
connection.query('SELECT url FROM company_urls LIMIT 0,1', async (err, results, fields) => {
  if (err) {
    console.error('Error connecting to MySQL: ' + err.stack);
    return;
  }
  console.log('Connected to MySQL as id ' + connection.threadId);

  results.forEach((result) => {
    urls.push(result.url);
  });

  urls.forEach(async (url) => {
    // await companyWebisteCrawler(url);
    // 爬取公司104頁面
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // 電腦版
    await page.setViewport({ width: 1920, height: 1080 });

    // 載入網頁
    await page.goto(url);

    // 網頁截圖
    await page.screenshot({ path: `123.png` });

    const urlArr = await page.evaluate(() => {
      const arr = [];
      const nodeList = document.querySelectorAll(`div.intro-table__head`);
      nodeList.forEach((node) => {
        if (node.querySelector('h3').textContent === '相關連結') {
          let urlNodes = node.parentNode.querySelector('.intro-table__data').querySelectorAll('a');
          urlNodes.forEach((urlNode) => {
            arr.push(urlNode.href);
          });
        }
      });
      return arr;
    });
    console.log(urlArr);
  });
});

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}