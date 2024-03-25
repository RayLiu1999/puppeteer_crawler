const connectToDatabase = require('./connect.js');
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
const pageLimit = 6; // 爬取上限頁數
const errorLimit = 3; // 爬取錯誤上限

exxute();

async function exxute() {
  const conn = await connectToDatabase();

  // 取得目前爬取頁數
  let [rows, fields] = await conn.query('SELECT page FROM company_search_page_urls ORDER BY page DESC LIMIT 0,1');

  let currentPage = rows.length > 0 ? rows[0].page + 1 : 1;

  // 依照頁數爬取
  let nums = [];
  for (currentPage; currentPage <= pageLimit; currentPage += 1) {
    nums.push(currentPage);
  }

  // 爬取公司列表頁面
  let tasks1 = [];
  if (nums.length > 0) {
    for (const page of nums) {
      let clrUrl = listUrl + `indcat=${CpTypes[CpType]}&page=${page}`;
      tasks1.push(companyPageCrawler(conn, clrUrl, page));
      // await companyPageCrawler(conn, clrUrl, page);
    };
  }

  await runAll(tasks1)
    .then(() => {
      console.log('爬取公司列表頁面完成');
    })
    .catch((err) => {
      console.log('爬取公司列表頁面失敗');
    });
  
  // 爬公司頁面網址
  [rows, fields] = await conn.execute(`SELECT url FROM company_search_page_urls WHERE status = ${crawlerStatus.notCrawler} OR (status = ${crawlerStatus.crawlerError} AND error_count < ${errorLimit})`);
  
  let task2 = [];
  for (const row of rows) {
    // task2.push(companyWebisteCrawler(conn, row.url));
    await companyWebisteCrawler(conn, row.url);
    await delay(1000);
  };

  // await runAll(task2)
  // .then(() => {
  //   console.log('爬取公司頁面完成');
  // })
  // .catch((err) => {
  //   console.log('爬取公司頁面失敗');
  // });
}

// 爬取104公司列表
async function companyPageCrawler(conn, clrUrl, currentPage) {
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

  let tempArr = Array(urlArr.length).fill('?', 0, urlArr.length);
  const [rows, fields] = await conn.execute('SELECT url FROM company_search_page_urls WHERE url IN ('+tempArr.join(',')+')', urlArr);
  let aleadyCrawledUrls = rows.map((row) => row.url);
  
  urlArr.forEach(async (url) => {
    // 判斷是否已經爬取過
    if (!aleadyCrawledUrls.includes(url)) {
      // 寫入資料庫
      await conn.execute(`INSERT INTO company_search_page_urls (industry_type, page, url) VALUES (?, ?, ?)`,  [CpType, currentPage, url]);
    }
  });

  console.log(`爬取第${currentPage}頁完成`);
};

// 爬取104公司頁面
async function companyWebisteCrawler(conn, url) {
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

  await browser.close();

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
  let dbTasks = [];
  for (const url of companyUrlls) {
    await conn.execute('INSERT INTO company_website_urls (url) VALUES (?)',  [url]);
  };

  // await runAll(dbTasks);

  // 更新爬取狀態
  if (isCrawled) {
    await conn.execute('UPDATE company_search_page_urls SET status = ? WHERE url = ?', [crawlerStatus.crawler, url]);
  } else {
    await conn.execute('UPDATE company_search_page_urls SET status = ?, error_count = error_count + 1  WHERE url = ?', [crawlerStatus.crawlerError, url]);
  }

  // conn.off('error', errorHandler);
  // conn.release(); // 释放连接
}

async function runAll(promises) {
  // 使用 Promise.all 來等待所有的 Promise 完成
  return Promise.all(promises);
}

function errorHandler(err) {
  console.error('Query error:', err);
  // 在处理完错误后，移除事件监听器
  conn.off('error', errorHandler);
}

async function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
