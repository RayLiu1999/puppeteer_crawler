const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto("https://www.104.com.tw/jobs/search/");
  // await page.screenshot({ path: "example.png" });

  const title = await page.title();
  console.log("title:", title);

  const url = await page.url();
  console.log("url:", url);



  await browser.close();
})();
