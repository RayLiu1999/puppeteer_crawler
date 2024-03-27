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
const pageLimit = 50; // 爬取上限頁數
const errorLimit = 3; // 爬取錯誤上限

execute();

async function execute() {
  const conn = await connectToDatabase();

  // 取得目前爬取頁數
  let [rows, fields] = await conn.query('SELECT page FROM company_page_urls ORDER BY page DESC LIMIT 0,1');

  let currentPage = rows.length > 0 ? rows[0].page + 1 : 1;

  // 依照頁數爬取
  let nums = [];
  for (currentPage; currentPage <= pageLimit; currentPage += 1) {
    nums.push(currentPage);
  }

  // 爬取公司列表頁面
  if (nums.length > 0) {
    for (const page of nums) {
      let clrUrl = listUrl + `indcat=${CpTypes[CpType]}&page=${page}`;
      await companyListPageCrawler(conn, clrUrl, page);
      await delay(1000);
    };
  }

  console.log('爬取公司列表完成');

  // 爬公司頁面網址
  [rows, fields] = await conn.execute(`SELECT url FROM company_page_urls WHERE status = ${crawlerStatus.notCrawler} OR (status = ${crawlerStatus.crawlerError} AND error_count < ${errorLimit})`);
  
  for (const row of rows) {
    await companyPageCrawler(conn, row.url);
    await delay(1000);
  };

  console.log('爬取公司頁面完成');

  // 爬取公司網站
  [rows, fields] = await conn.execute(`SELECT url FROM company_website_urls WHERE status = ${crawlerStatus.notCrawler} OR (status = ${crawlerStatus.crawlerError} AND error_count < ${errorLimit})`);

  for (const row of rows) {
    await companyWebsiteCrawler(conn, row.url);
    await delay(1000);
  }
}

// 爬取104公司列表
async function companyListPageCrawler(conn, clrUrl, currentPage) {
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

  await page.close();
  await browser.close();

  let aleadyCrawledUrls = [];
  if (urlArr.length > 0) {
    let tempArr = Array(urlArr.length).fill('?', 0, urlArr.length);
    const [rows, fields] = await conn.execute('SELECT url FROM company_page_urls WHERE url IN ('+tempArr.join(',')+')', urlArr);
    aleadyCrawledUrls = rows.map((row) => row.url);
  }
    
  urlArr.forEach(async (url) => {
    // 判斷是否已經爬取過
    if (!aleadyCrawledUrls.includes(url)) {
      // 寫入資料庫
      await conn.execute(`INSERT INTO company_page_urls (industry_type, page, url) VALUES (?, ?, ?)`,  [CpType, currentPage, url]);
    }
  });

  console.log(`爬取第${currentPage}頁完成`);

  await conn.release();
};

// 爬取104公司頁面
async function companyPageCrawler(conn, url) {
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

  let companyUrls = await page.evaluate(() => {
    const arr = [];
    const nodeList = document.querySelectorAll(`div.intro-table__head`);
    nodeList.forEach((node) => {
      let title = node.querySelector('h3').textContent;
      if (title === '相關連結' || title === '公司網址') {
        let urlNodes = node.parentNode.querySelector('.intro-table__data').querySelectorAll('a');
        urlNodes.forEach((urlNode) => {
          arr.push(urlNode.href);
        });
      }
    });
    return arr;
  });

  await page.close();
  await browser.close();

  // 過濾非官方網站
  companyUrls = companyUrls.filter((url) => {
    let isFilter = false;
    filterDomain.forEach((domain) => {
      if (url.includes(domain)) {
        isFilter = true;
      }
    });
    return !isFilter;
  });

  if (companyUrls.length > 0) {
    // 判斷是否已經爬取過
    let tempArr = Array(companyUrls.length).fill('?', 0, companyUrls.length);
    const [rows, fields] = await conn.execute('SELECT url FROM company_website_urls WHERE url IN ('+tempArr.join(',')+')', companyUrls);
    let aleadyCrawledUrls = rows.map((row) => row.url);
  
    // 取得104公司表ID
    const [companyPageRow, fields2] = await conn.execute('SELECT id FROM company_page_urls WHERE url = ? LIMIT 0, 1', [url]);
    const companyPageId = companyPageRow[0].id || 0;
    
    // 寫入資料庫
    let aleadyInsertUrls = [];
    for (const companyUrl of companyUrls) {
      if (!aleadyCrawledUrls.includes(companyUrl) && !aleadyInsertUrls.includes(companyUrl)) {
        // 長度超過100字元不寫入
        if (companyUrl.length > 100) {
          continue;
        }

        console.log(url + ' => ' + companyUrl);
        await conn.execute('INSERT INTO company_website_urls (page_urls_id, url) VALUES (?, ?)',  [companyPageId, companyUrl]);
        aleadyInsertUrls.push(companyUrl);
      }
    };
  }

  // 更新爬取狀態
  if (isCrawled) {
    await conn.execute('UPDATE company_page_urls SET status = ? WHERE url = ?', [crawlerStatus.crawler, url]);
  } else {
    await conn.execute('UPDATE company_page_urls SET status = ?, error_count = error_count + 1  WHERE url = ?', [crawlerStatus.crawlerError, url]);
  }

  await conn.release();
}

// 爬取公司網站
async function companyWebsiteCrawler(conn, url) {
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
