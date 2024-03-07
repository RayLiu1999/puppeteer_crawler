const puppeteer = require("puppeteer");

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

// 公司
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("https://www.104.com.tw/company/search/?indcat=1016002000&page=3");
  // await page.screenshot({ path: "example.png" });

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
  console.log(urlArr);

  await browser.close();
})();

function delay(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}