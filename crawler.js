const connectToDatabase = require('./connect.js');
const puppeteer = require("puppeteer");

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
};

const CpType = '餐飲業';
const pageLimit = 100; // 爬取上限頁數
const errorLimit = 3; // 爬取錯誤上限

// 網站類型
const WebTypes = {
  'underHTML5': 0,
  'wordpress': 1,
  'HTML5': 2,
  'facebook': 3,
  'instagram': 4,
  'twitter': 5,
  'shoppee': 6,
  'googleBusiness': 7,
  'shopline': 8,
};

let browser;
execute();

async function execute() {
  browser = await puppeteer.launch();
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
    await companyListPageCrawler(conn, nums);
  }

  console.log('爬取公司列表完成');

  // 爬公司頁面網址
  [rows, fields] = await conn.execute(`SELECT url FROM company_page_urls WHERE status = ${crawlerStatus.notCrawler} OR (status = ${crawlerStatus.crawlerError} AND error_count < ${errorLimit})`);

  await companyPageCrawler(conn, rows);

  console.log('爬取公司頁面完成');

  // 爬取公司網站
  [rows, fields] = await conn.execute(`SELECT id, url FROM company_website_urls WHERE status = ${crawlerStatus.notCrawler} OR (status = ${crawlerStatus.crawlerError} AND error_count < ${errorLimit})`);

  await companyWebsiteCrawler(conn, rows);

  await browser.close();
}

// 爬取104公司列表
async function companyListPageCrawler(conn, nums) {
  for (const currentPage of nums) {
    const clrUrl = listUrl + `indcat=${CpTypes[CpType]}&page=${currentPage}`;
    const page = await browser.newPage();
    await page.goto(clrUrl);

    // 職位連結
    const urlArr = await page.evaluate(() => {
      const arr = [];
      const nodeList = document.querySelectorAll(`a.company-name-link--pc`);
      nodeList.forEach((node) => {
        arr.push(node.href);
      });
      return arr;
    });

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

    await page.close();

    console.log(`爬取第${currentPage}頁完成`);
  }

  // await browser.close();
  await conn.release();
};

// 爬取104公司頁面
async function companyPageCrawler(conn, rows) {
  for (const row of rows) {
    let page = await browser.newPage();
    const url = row.url;

    // 電腦版
    await page.setViewport({ width: 1920, height: 1080 });

    // 載入網頁
    let response = await page.goto(url);

    if (response.status() === 200) {
      await conn.execute('UPDATE company_page_urls SET status = ? WHERE url = ?', [crawlerStatus.crawler, url]);
    }
    else {
      await conn.execute('UPDATE company_page_urls SET status = ?, error_count = error_count + 1  WHERE url = ?', [crawlerStatus.crawlerError, url]);
      continue;
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

    await page.close();
  };

  // await browser.close();
  await conn.release();
}

// 爬取公司網站(改成fetch)
async function companyWebsiteCrawler(conn, rows) {
    for (const row of rows) {
      let page;
      try {
        page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3');

        const url = row.url;

        // 電腦版
        await page.setViewport({ width: 1920, height: 1080 });

        let response;

        // 載入網頁
        await Promise.race([
          page.goto(url),
          new Promise((resolve, reject) => {
            setTimeout(() => reject(new Error('頁面載入超時')), 10000);
          }),
        ])
        .then((res) => {
          response = res;
        });

        console.log(response.status());
        console.log(url);

        if (response.status() === 200) {
          await conn.execute('UPDATE company_website_urls SET status = ? WHERE url = ?', [crawlerStatus.crawler, url]);
        }
        else {
          await conn.execute('UPDATE company_website_urls SET status = ?, error_count = error_count + 1  WHERE url = ?', [crawlerStatus.crawlerError, url]);
          continue;
        }

        // page.waitForNavigation();

        await delay(200);

        let emails = await page.evaluate(() => {
          let body = document.body;

          // 移除所有script
          body.querySelectorAll('script').forEach((script) => {
            script.remove();
          });

          // 取得所有text中的email
          const emailReg = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
          const emails = body.textContent.match(emailReg);
          return emails;
        });

        let webType = checkWebType(url, await page.content());

        console.log(emails);
        console.log(webType);

        // 寫入資料庫
        if (emails && emails.length > 0) {
          let tempArr = Array(emails.length).fill('?', 0, emails.length);
          const [rows, fields] = await conn.execute('SELECT email FROM company_information WHERE email IN ('+tempArr.join(',')+')', emails);
          let aleadyCrawledEmails = rows.map((row) => row.email);

          let aleadyInsertEmails = [];
          for (const email of emails) {
            if (!aleadyCrawledEmails.includes(email) && !aleadyInsertEmails.includes(email)) {
              // 長度超過100字元不寫入
              if (email.length > 100) {
                continue;
              }

              await conn.execute('INSERT INTO company_information (website_id, industry_type, web_type, email) VALUES (?, ?, ?, ?)',  [row.id, CpType, webType, email]);
              aleadyInsertEmails.push(email);
            }
          };
        }

        // 更新爬取狀態
        await conn.execute('UPDATE company_website_urls SET status = ? WHERE url = ?', [crawlerStatus.crawler, url]);

        await delay(200);
        await page.close();
      }
      catch (error) {
        console.log(error.message);
        console.log(row.url);
        await page.close();
        await conn.execute('UPDATE company_website_urls SET status = ?, error_count = error_count + 1  WHERE url = ?', [crawlerStatus.crawlerError, row.url]);
        continue;
      }
    }
}

async function runAll(promises) {
  // 使用 Promise.all 來等待所有的 Promise 完成
  return Promise.all(promises);
}

function checkWebType(url, html) {
  const hostName = new URL(url).hostname;

  if (hostName.includes('facebook.com')) {
    return WebTypes.facebook;
  }

  if (hostName.includes('instagram.com')) {
    return WebTypes.instagram;
  }

  if (hostName.includes('twitter.com')) {
    return WebTypes.twitter;
  }

  if (hostName.includes('shopee.tw') || hostName.includes('shopee.com')) {
    return WebTypes.shoppee;
  }

  if (hostName.includes('business.site')) {
    return WebTypes.googleBusiness;
  }

  if (html.includes('wp-content')) {
    return WebTypes.wordpress;
  }

  if (html.includes('shoplineapp')) {
    return WebTypes.shopline;
  }

  if (html.includes('<!DOCTYPE html>')) {
    return WebTypes.HTML5;
  }
  else {
    return WebTypes.underHTML5;
  }
}

function getWebInfo(html) {
  // 取得所有text中的email
  const emailReg = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
  const emails = html.match(emailReg);
}

function errorHandler(err) {
  console.error('Query error:', err);
  // 在处理完错误后，移除事件监听器
  conn.off('error', errorHandler);
}

async function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}
