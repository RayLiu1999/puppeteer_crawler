<?php

# 資料庫資料
$dbnametxt = 'puppeteer_crawler';       //----------資料庫的名稱
$dbusertxt = 'root';                    //----------資料的庫帳號
$dbpwdtxt  = '';                        //----------資料庫的密碼
$dbhosturl = '127.0.0.1';               //----------資料庫位置

#連接資料庫
try { 
  $db_conn = new PDO('mysql:host='.$dbhosturl.';dbname='.$dbnametxt, $dbusertxt, $dbpwdtxt);
  $db_conn->exec("SET NAMES utf8mb4");
} catch (PDOException $e) {
  die("Could not connect to database.");
}

// 網站類型
$WebTypes = [
  'underHTML5' => 0,
  'wordpress' => 1,
  'HTML5' => 2,
  'facebook' => 3,
  'instagram' => 4,
  'twitter' => 5,
  'shoppee' => 6,
  'googleBusiness' => 7,
  'shopline' => 8,
];

$WebTypesReverse = array_flip($WebTypes);

$sql = "
SELECT 
  page.industry_type as industry_type,
  website.title as title,
  website.url as url,
  info.web_type as web_type,
  info.email as email
FROM 
  `company_information` as info
LEFT JOIN
  `company_website_urls` as website
ON 
  `info`.`website_id` = `website`.`id`
LEFT JOIN
  `company_page_urls` as page
ON 
  `website`.`page_urls_id` = `page`.`id`
";
$stmt = $db_conn->query($sql);
$company_information = $stmt->fetchAll(PDO::FETCH_ASSOC);

$file = fopen(__DIR__ . '/export.csv', 'w');

// 寫入標題
fputcsv($file, ['產品類別', '公司名稱', '公司網址', '公司網站類型', '電子信箱']);

foreach ($company_information as $key => $value) {
  $company_information[$key]['web_type'] = $WebTypesReverse[intval($value['web_type'])];

  // 過濾前後符號
  $company_information[$key]['email'] = rtrim($value['email'], '-');

  // 過濾沒有符合email格式的
  if (!filter_var($value['email'], FILTER_VALIDATE_EMAIL)) {
    unset($company_information[$key]);
    continue;
  }

  fputcsv($file, $company_information[$key]);
}
fclose($file);