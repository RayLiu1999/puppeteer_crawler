const connection = require('./connect.js');
const puppeteer = require("puppeteer");
const fs = require("fs");

const url = 'https://www.104.com.tw/company/search/?';
let CpType = 1016002000; // 公司類別
let Cpage = 1; // 爬取起始頁數
let pageLimit = 2; // 爬取頁數上限

let nums = [];
for (let i = 1; i <= pageLimit; i++) {
  nums.push(i);
}

nums.forEach(async () => {
  let clrUrl = url + `indcat=${CpType}&page=${Cpage}`;
  await crawler(clrUrl);
  Cpage++;
});


// 公司
async function crawler(clrUrl) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(clrUrl);

  const title = await page.title();
  console.log("title:", title);

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

  urlArr.forEach((url) => {
    // 寫入資料庫
    connection.query('INSERT INTO company_urls (url) VALUES (?)',  [url], (err, results, fields) => {
      if (err) {
        console.error('Error connecting to MySQL: ' + err.stack);
        return;
      }
      console.log('Connected to MySQL as id ' + connection.threadId);
    });
  });
};

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

// 職缺
// (async () => {
//   const browser = await puppeteer.launch();
//   const page = await browser.newPage();
//   await page.goto("https://www.104.com.tw/jobs/search/");
//   // await page.screenshot({ path: "example.png" });

//   const title = await page.title();
//   console.log("title:", title);

//   // 職位連結
//   const urlArr = await page.evaluate(() => {
//     const arr = [];
//     const nodeList = document.querySelectorAll(`a[data-qa-id='jobSeachResultTitle']`);
//     nodeList.forEach((node) => {
//       arr.push(node.href);
//     });
//     return arr;
//   });
//   console.log(urlArr);

//   await browser.close();
// })();

