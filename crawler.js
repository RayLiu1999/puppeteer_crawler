const connectToDatabase = require('./connect.js');
const puppeteer = require("puppeteer");
const fetch = require('node-fetch');
const cheerio = require('cheerio');

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
  /** 批發／零售／傳直銷業 */
  '批發業': 1003001000,
  '零售業': 1003002000,
  '傳直銷相關業': 1003003000,
  /** 文教相關業 */
  '教育服務業': 1005001000,
  '出版業': 1005002000,
  '藝文相關業': 1005003000,
  /** 大眾傳播相關業 */
  '電影業': 1006001000,
  '廣播電視業': 1006002000,
  '廣告行銷／傳播經紀業': 1006003000,
  /** 旅遊／休閒／運動業 */
  '運動及旅遊休閒服務業': 1007001000,
  /** 一般服務業 */
  '人力仲介代徵／派遣': 1009001000,
  '租賃業': 1009002000,
  '汽機車維修或服務相關業': 1009004000,
  '婚紗攝影及美髮美容業': 1009005000,
  '徵信及保全樓管相關業': 1009006000,
  '其他服務相關業': 1009007000,
  /** 電子資訊／軟體／半導體相關業 */
  '軟體及網路相關業': 1001001000,
  '電信及通訊相關業': 1001002000,
  '電腦及消費性電子製造業': 1001003000,
  '光電及光學相關業': 1001004000,
  '電子零組件相關業': 1001005000,
  '半導體業': 1001006000,
  /** 一般製造業 */
  '食品菸草及飲料製造業': 1002001000,
  '紡織業': 1002002000,
  '鞋類／紡織製品製造業': 1002003000,
  '家具及裝設品製造業': 1002004000,
  '紙製品製造業': 1002005000,
  '印刷相關業': 1002006000,
  '化學相關製造業': 1002007000,
  '石油及煤製品製造業': 1002008000,
  '橡膠及塑膠製品製造業': 1002009000,
  '非金屬礦物製品製造業': 1002010000,
  '金屬相關製造業': 1002011000,
  '機械設備製造修配業': 1002012000,
  '電力機械設備製造業': 1002013000,
  '運輸工具製造業': 1002014000,
  '精密儀器及醫療器材相關業': 1002015000,
  '育樂用品製造業': 1002016000,
  '其他相關製造業': 1002017000,
  /** 農林漁牧水電資源業 */
  '農林漁牧相關業': 1014001000,
  '林場伐木相關業': 1014002000,
  '漁撈水產養殖業': 1014003000,
  '水電能源供應業': 1014004000,
  /** 運輸物流及倉儲 */
  '運輸相關業': 1010001000,
  '倉儲或運輸輔助業': 1010002000,
  '郵政及快遞業': 1010003000,
  /** 政治宗教及社福相關業 */
  '政治機構相關業': 1013001000,
  '宗教／職業團體組織': 1013002000,
  '社會福利服務業': 1013003000,
  /** 金融投顧及保險業 */
  '金融機構及其相關業': 1004001000,
  '投資理財相關業': 1004002000,
  '保險業': 1004003000,
  /** 法律／會計／顧問／研發／設計業 */
  '法律服務業': 1008001000,
  '會計服務業': 1008002000,
  '顧問／研發／設計業': 1008003000,
  /** 建築營造及不動產相關業 */
  '建築或土木工程業': 1011001000,
  '建物裝修或空調工程業': 1011002000,
  '建築規劃及設計業': 1011003000,
  '不動產業': 1011004000,
  /** 醫療保健及環境衛生業 */
  '醫療服務業': 1012001000,
  '環境衛生相關業': 1012002000,
  /** 礦業及土石採取業 */
  '能源開採業': 1015001000,
  '其他礦業': 1015002000,
  '土石採取業': 1015003000,
  /** 住宿／餐飲服務業 */
  '餐飲業': 1016002000,
  '住宿服務業': 1016001000,
};

// const CpType = '住宿服務業';
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

  for (const CpType of Object.keys(CpTypes)) {
    // 取得目前爬取頁數
    let [rows, fields] = await conn.query(`SELECT page FROM company_page_urls WHERE industry_type = '${CpType}' ORDER BY page DESC LIMIT 0,1`);

    let currentPage = rows.length > 0 ? rows[0].page + 1 : 1;

    // 依照頁數爬取
    let nums = [];
    for (currentPage; currentPage <= pageLimit; currentPage += 1) {
      nums.push(currentPage);
    }

    // 爬取公司列表頁面
    if (nums.length > 0) {
      await companyListPageCrawler(conn, nums, CpType);
    }

    console.log(`爬取${CpType}公司列表完成`);
  }

  // 爬公司頁面網址
  [rows, fields] = await conn.execute(`SELECT url FROM company_page_urls WHERE status = ${crawlerStatus.notCrawler} OR (status = ${crawlerStatus.crawlerError} AND error_count < ${errorLimit}) ORDER BY id ASC`);
  rows = rows.filter((row) => row.url !== null);

  await companyPageCrawler(conn, rows);

  console.log(`爬取公司頁面完成`);

  // 爬取公司網站
  [rows, fields] = await conn.execute(`SELECT id, url FROM company_website_urls WHERE status = ${crawlerStatus.notCrawler} OR (status = ${crawlerStatus.crawlerError} AND error_count < ${errorLimit}) ORDER BY id ASC`);

  rows = rows.filter((row) => row.url !== null);
  await companyWebsiteCrawler_Fetch(conn, rows);

  console.log(`爬取公司網站完成`);

  await browser.close();
}

// 爬取104公司列表
async function companyListPageCrawler(conn, nums, CpType) {
  for (const currentPage of nums) {
    const clrUrl = listUrl + `indcat=${CpTypes[CpType]}&page=${currentPage}`;
    let crawlerCount = 0;
    let hasUrl = false;

    while (crawlerCount < 3 && !hasUrl) {
      try {
        // 開啟新分頁
        const page = await browser.newPage();
        // 設定windows user agent
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3');
  
        // 電腦版
        await page.setViewport({ width: 1920, height: 1080 });
  
        // 載入網頁
        await page.goto(clrUrl);

        await delay(100);

        // 公司頁面連結
        const urlArr = await page.evaluate(() => {
          const arr = [];
          const nodeList = document.querySelectorAll(`a.company-name-link--pc`);
          nodeList.forEach((node) => {
            arr.push(node.href);
          });
          return arr;
        });

        if (urlArr.length > 0) {
          hasUrl = true;
        }
        else {
          // 關閉分頁
          await page.close();
          crawlerCount += 1;
          continue;
        }

        console.log(urlArr);
  
        let alreadyCrawledUrls = [];
        if (urlArr.length > 0) {
          let tempArr = Array(urlArr.length).fill('?', 0, urlArr.length);
          const [rows, fields] = await conn.execute('SELECT url FROM company_page_urls WHERE url IN ('+tempArr.join(',')+')', urlArr);
          console.log(rows);
          alreadyCrawledUrls = rows.map((row) => row.url);
        }
  
        urlArr.forEach(async (url) => {
          // 判斷是否已經爬取過
          if (!alreadyCrawledUrls.includes(url)) {
            // 寫入資料庫
            await conn.execute(`INSERT INTO company_page_urls (industry_type, page, url) VALUES (?, ?, ?)`,  [CpType, currentPage, url]);
          }
        });

        await delay(200);
  
        // 關閉分頁
        await page.close();
  
        console.log(`爬取第${currentPage}頁完成`);
      } catch (error) {
        console.log(error.message);
        await conn.execute('UPDATE company_page_urls SET status = ?, error_count = error_count + 1  WHERE url = ?', [crawlerStatus.crawlerError, clrUrl]);
        continue;
      }
    }

    // 超過3次爬不到內容，則寫入空值，寫入最大頁數，結束爬取
    if (crawlerCount >= 3) {
      await conn.execute(`INSERT INTO company_page_urls (industry_type, page, url) VALUES (?, ?, ?)`,  [CpType, pageLimit, null]);
      break;
    }
  }

  await conn.release();
};

// 爬取104公司頁面
async function companyPageCrawler(conn, rows) {
  for (const row of rows) {
    const url = row.url;
    console.log(url);

    let crawlerCount = 0;
    let hasUrl = false;

    while (crawlerCount < 3 && !hasUrl) {
      // 開啟新分頁
      let page = await browser.newPage();

      try {
    
        // 電腦版
        await page.setViewport({ width: 1920, height: 1080 });
    
        // 載入網頁
        let response = await page.goto(url);
    
        if (response.status() !== 200) {
          throw new Error('頁面載入失敗');
        }

        await page.waitForSelector('h1', { timeout: 5000});

        // 取得h1標題
        let companyTitle = await page.evaluate(() => {
          return document.querySelector('h1').textContent;
        });

        if (companyTitle !== '') {
          hasUrl = true;
        }
        else {
          // 關閉分頁
          await page.close();
          crawlerCount += 1;
          continue;
        }

        await page.waitForSelector('div.intro-table__head', { timeout: 5000});

        // 取得公司網址
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

        console.log('公司網站(已過濾社群網站): ');
        console.log(companyUrls);
        console.log('----------------------');

        if (companyUrls.length > 0) {
          // 判斷是否已經爬取過
          let tempArr = Array(companyUrls.length).fill('?', 0, companyUrls.length);
          const [rows, fields] = await conn.execute('SELECT url FROM company_website_urls WHERE url IN ('+tempArr.join(',')+')', companyUrls);
          let alreadyCrawledUrls = rows.map((row) => row.url);
    
          // 取得104公司表ID
          const [companyPageRow, fields2] = await conn.execute('SELECT id FROM company_page_urls WHERE url = ? LIMIT 0, 1', [url]);
          const companyPageId = companyPageRow[0].id || 0;
    
          // 寫入資料庫
          let alreadyInsertUrls = [];
          for (const companyUrl of companyUrls) {
            if (!alreadyCrawledUrls.includes(companyUrl) && !alreadyInsertUrls.includes(companyUrl)) {
              // 長度超過100字元不寫入
              if (companyUrl.length > 100) {
                continue;
              }
    
              await conn.execute('INSERT INTO company_website_urls (page_urls_id, title, url) VALUES (?, ?, ?)',  [companyPageId, companyTitle, companyUrl]);
              alreadyInsertUrls.push(companyUrl);
            }
          };
        }

        // 更新爬取狀態
        await conn.execute('UPDATE company_page_urls SET status = ? WHERE url = ?', [crawlerStatus.crawler, url]);

        // 關閉分頁
        await page.close();

      } catch (error) {
        crawlerCount += 1;

        console.log(error.message);
        await conn.execute('UPDATE company_page_urls SET status = ?, error_count = error_count + 1  WHERE url = ?', [crawlerStatus.crawlerError, url]);

        // 關閉分頁
        await page.close();
        continue;
      }
    }
  }

  await conn.release();
}

// 爬取公司網站(改成fetch)
async function companyWebsiteCrawler(conn, rows) {
    for (const row of rows) {
      let page;
      try {
        page = await browser.newPage();
        // await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3');

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

// 爬取公司網站(改成fetch)
async function companyWebsiteCrawler_Fetch(conn, rows, CpType) {
  for (const row of rows) {
    const url = row.url;
    console.log(url);

    try {
      let res;

      // 載入網頁
      await Promise.race([
        fetch(url, 
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.3'
            }
          },
        ).then((res) => {
          if (res.ok) {
            return res.text();
          }
          else {
            throw new Error('連線錯誤');
          }
        }).catch((err) => {
          throw new Error(err);
        }),
        new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('頁面載入超時')), 10000);
        }),
      ])
      .then((response) => {
        res = response;
      });

      const $ = cheerio.load(res);

      await delay(100);

      // 移除所有script,noscript
      $('script').remove();
      $('noscript').remove();
      $('img').remove();
      $('style').remove();
      $('link').remove();

      // 取得所有text中的email
      const emailReg = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/g;
      // let emails = $('body').text().match(emailReg);
      let emails = $('body').html().match(emailReg);

      // 過濾圖片
      if (emails) {
        emails = emails.filter((email) => {
          return !email.includes('.jpg') && !email.includes('.png') && !email.includes('.jpeg') && !email.includes('.gif') && !email.includes('.webp') && !email.includes('.svg');
        });
      }

      // 判斷網站類型
      const webType = checkWebType(url, res);

      // 寫入資料庫
      if (emails && emails.length > 0) {
        let tempArr = Array(emails.length).fill('?', 0, emails.length);
        const [infoRows, fields] = await conn.execute('SELECT email FROM company_information WHERE email IN ('+tempArr.join(',')+')', emails);
        let aleadyCrawledEmails = infoRows.map((row) => row.email);
        console.log(aleadyCrawledEmails);

        let aleadyInsertEmails = [];
        for (const email of emails) {
          console.log(aleadyCrawledEmails.includes(email));
          console.log(aleadyInsertEmails.includes(email));
          if (!aleadyCrawledEmails.includes(email) && !aleadyInsertEmails.includes(email)) {
            // 長度超過100字元不寫入
            // if (email.length > 100) {
            //   continue;
            // }
            console.log([row.id, webType, email]);

            await conn.execute('INSERT INTO company_information (website_id, web_type, email) VALUES (?, ?, ?)',  [row.id, webType, email]);
            aleadyInsertEmails.push(email);
          }
        };
      }

      // 更新爬取狀態
      await conn.execute('UPDATE company_website_urls SET status = ? WHERE url = ?', [crawlerStatus.crawler, url]);

      await delay(100);
    }
    catch (error) {
      console.log(error.message);
      await conn.execute('UPDATE company_website_urls SET status = ?, error_count = error_count + 1  WHERE url = ?', [crawlerStatus.crawlerError, url]);
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
