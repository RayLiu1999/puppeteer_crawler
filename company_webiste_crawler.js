const connection = require('./connect.js');
const puppeteer = require("puppeteer");
const fs = require("fs");


// 爬蟲抓取狀態
const crawlerStatus = {
  // 未爬取
  notCrawler: 0,
  // 爬取成功
  crawler: 1,
  // 爬取失敗
  crawlerError: 2,
};

// 過濾的網站domain
const filterDomain = [
  'facebook.com',
  'instagram.com',
  'youtube.com',
  'twitter.com',
];

// 撈公司頁面網址
connection.query('SELECT url FROM company_search_page_urls WHERE status = 0 OR status = 2 LIMIT 0,1', async (err, results, fields) => {
  let pageUrls = [];

  if (err) {
    console.error('Error connecting to MySQL: ' + err.stack);
    return;
  }
  console.log('Connected to MySQL as id ' + connection.threadId);

  results.forEach((result) => {
    pageUrls.push(result.url);
  });

  let isCrawled = false;
  pageUrls.forEach(async (url) => {
    // await companyWebisteCrawler(url);
    // 爬取公司104頁面
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // 電腦版
    await page.setViewport({ width: 1920, height: 1080 });

    // 載入網頁
    const response = await page.goto(url);

    if (response.status() === 200) {
      isCrawled = true;
    }

    // 網頁截圖
    await page.screenshot({ path: `123.png` });

    let companyUrlls = await page.evaluate(() => {
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

    // 過濾非官方網站
    companyUrlls = companyUrlls.filter((url) => {
      let isFilter = false;
      filterDomain.forEach((domain) => {
        if (url.includes(domain)) {
          isFilter = true;
        }
      });
      return !isFilter;
    });
    
    // 寫入資料庫
    companyUrlls.forEach((url) => {
      connection.query('INSERT INTO company_website_urls (url) VALUES (?)',  [url], (err, results, fields) => {
        if (err) {
          console.error('Error connecting to MySQL: ' + err.stack);
          return;
        }
        console.log('Connected to MySQL as id ' + connection.threadId);
      });
    });


    // 更新爬取狀態
    if (isCrawled) {
      connection.query('UPDATE company_search_page_urls SET status = ? WHERE url = ?', [crawlerStatus.crawler, url], (err, results, fields) => {
        if (err) {
          console.error('Error connecting to MySQL: ' + err.stack);
          return;
        }
        console.log('Connected to MySQL as id ' + connection.threadId);
      });
    } else {
      connection.query('UPDATE company_search_page_urls SET status = ? WHERE url = ?', [crawlerStatus.crawlerError, url], (err, results, fields) => {
        if (err) {
          console.error('Error connecting to MySQL: ' + err.stack);
          return;
        }
        console.log('Connected to MySQL as id ' + connection.threadId);
      });
    }
  });
});