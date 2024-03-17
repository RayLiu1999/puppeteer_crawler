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

// 104公司列表網址
const listUrl = 'https://www.104.com.tw/company/search/?';

// 公司類別
const CpTypes = {
  '餐飲業': 1016002000,
  '住宿服務業': 1016001000,
}

const CpType = '餐飲業';
const pageLimit = 5; // 爬取上限頁數
const errorLimit = 3; // 爬取錯誤上限

// 取得目前爬取頁數
connection.query('SELECT page FROM company_search_page_urls ORDER BY page DESC LIMIT 0,1', async (err, results, fields) => {
  if (err) {
    console.error('Error connecting to MySQL: ' + err.stack);
    return;
  }
  console.log('Connected to MySQL as id ' + connection.threadId);

  let currentPage = 1;
  if (results.length > 0) {
    currentPage = results[0].page + 1;
  }

  // 依照頁數爬取
  let nums = [];
  for (currentPage; currentPage <= pageLimit; currentPage += 1) {
    nums.push(currentPage);
  }

  // 爬取公司列表頁面
  if (nums.length > 0) {
    nums.forEach(async (page) => {
      let clrUrl = listUrl + `indcat=${CpTypes[CpType]}&page=${page}`;
      await companyPageCrawler(clrUrl, page);
      await delay(500);
    });
  }

  // 爬公司頁面網址
  await connection.query(`SELECT url FROM company_search_page_urls WHERE status = ${crawlerStatus.notCrawler} OR (status = ${crawlerStatus.crawlerError} AND error_count < ${errorLimit})`, async (err, results, fields) => {
    if (err) {
      console.error('Error connecting to MySQL: ' + err.stack);
      return;
    }
    console.log('Connected to MySQL as id ' + connection.threadId);

    results.forEach(async (result) => {
      console.log('爬公司頁面網址' + result.url);
      await companyWebisteCrawler(result.url);
      await delay(500);
    });
  });

  // 關閉連線
  // await connection.end();

});

// 爬取104公司列表
async function companyPageCrawler(clrUrl, currentPage) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(clrUrl);

  const title = await page.title();

  // 職位連結
  const urlArr = await page.evaluate(() => {
    const arr = [];
    const nodeList = document.querySelectorAll(`a.company-name-link--pc`);
    nodeList.forEach((node) => {
      arr.push(node.href);
    });
    return arr;
  });

  await browser.close();

  console.log(urlArr);
  
  urlArr.forEach(async (url) => {
    // 判斷是否已經爬取過
    await connection.query('SELECT id FROM company_search_page_urls WHERE url = ? LIMIT 0,1', [url], (err, results, fields) => {
      if (err) {
        console.error('Error connecting to MySQL: ' + err.stack);
        return;
      }
      console.log('Connected to MySQL as id ' + connection.threadId);

      if (results.length === 0) {
        // 寫入資料庫
        connection.query(`INSERT INTO company_search_page_urls (industry_type, page, url) VALUES (?, ?, ?)`,  [CpType, currentPage, url], (err, results, fields) => {
          if (err) {
            console.error('Error connecting to MySQL: ' + err.stack);
            return;
          }
          console.log('Connected to MySQL as id ' + connection.threadId);
        });
      }
    });
  });
};

// 爬取104公司頁面
async function companyWebisteCrawler(url) {
  // 爬取狀態
  let isCrawled = false;

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
    connection.query('UPDATE company_search_page_urls SET status = ?, error_count = error_count + 1  WHERE url = ?', [crawlerStatus.crawlerError, url], (err, results, fields) => {
      if (err) {
        console.error('Error connecting to MySQL: ' + err.stack);
        return;
      }
      console.log('Connected to MySQL as id ' + connection.threadId);
    });
  }
}

async function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
