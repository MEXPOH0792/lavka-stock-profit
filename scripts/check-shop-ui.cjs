const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=process.env.TEST_ORIGIN||'http://127.0.0.1:3040/lavka-stock-profit/';
 if(new URL(url).hostname!=='127.0.0.1')throw Error('Use a local preview for this test.');
 const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('lavka-local-ledger-v1')));
 const overflow=async()=>assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 try{
 await page.goto(url);await page.getByRole('heading',{name:'Что вы продаёте?'}).waitFor();await overflow();
 await page.getByRole('button',{name:/Одежда и обувь Размеры/}).click();
 await page.getByRole('button',{name:'Добавить первый товар',exact:true}).click();
 const dialog=page.locator('dialog');
 await dialog.getByLabel('Название товара', {exact:true}).fill('Кроссовки Urban');
 await dialog.getByLabel('Как считаете товар').selectOption('pair');
 await dialog.getByLabel('За сколько продаёте 1 пару, ₽').fill('3500');
 await dialog.getByLabel('Цвет (можно пропустить)').fill('Чёрный');
 await dialog.getByLabel('Размер (можно пропустить)').fill('42');
 await dialog.getByLabel('Сколько сейчас на полке, пар').fill('3');
 await dialog.getByLabel('За сколько купили 1 пару, ₽').fill('2100');
 await dialog.getByRole('button',{name:'Сохранить товар',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.locator('.mobile-nav').getByRole('link',{name:'Товары',exact:true}).click();
 await page.getByRole('button',{name:'Продать · размер 42',exact:true}).waitFor();await overflow();
 await page.getByRole('button',{name:'＋ Добавить другой размер',exact:true}).click();
 await dialog.getByLabel('Размер (можно пропустить)').fill('43');
 await dialog.getByLabel('Сколько сейчас на полке, пар').fill('2');await dialog.getByLabel('За сколько купили 1 пару, ₽').fill('2100');
 await dialog.getByRole('button',{name:'Сохранить товар',exact:true}).click();await dialog.waitFor({state:'hidden'});
 assert.equal(await page.locator('.product-card').count(),1);
 await page.locator('.size-picker').getByRole('button',{name:'43 2 пары'}).click();
 await page.getByRole('button',{name:'Продать · размер 43',exact:true}).click();
 await dialog.getByLabel('Сколько, пар', {exact:true}).fill('1');await dialog.getByRole('button',{name:'Записать продажу',exact:true}).click();await dialog.waitFor({state:'hidden'});
 const data=await stored();assert.equal(data.ledger.sales.length,1);assert.equal(data.ledger.products.find(p=>p.id===data.ledger.sales[0].productId).size,'43');
 await page.reload();await page.getByRole('button',{name:'Продать · размер 42',exact:true}).waitFor();
 if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:require('node:path').join(process.env.QA_SCREENSHOT_DIR,'lavka-fashion-live.png'),fullPage:true});
 for(const width of [320,768,1280]){await page.setViewportSize({width,height:900});await overflow();}
 const food=await browser.newPage({viewport:{width:390,height:844}});await food.goto(url);
 await food.getByRole('button',{name:/Фрукты и сухофрукты Вес/}).click();await food.getByRole('button',{name:'Добавить первый товар',exact:true}).click();
 const fd=food.locator('dialog');await fd.getByLabel('Название товара',{exact:true}).fill('Курага');await fd.getByLabel('За сколько продаёте 1 килограмм, ₽').fill('450');await fd.getByLabel('Сколько сейчас на полке, кг').fill('7,5');await fd.getByLabel('За сколько купили 1 килограмм, ₽').fill('300');
 await fd.getByRole('button',{name:'Сохранить товар',exact:true}).click();await fd.waitFor({state:'hidden'});await food.locator('.mobile-nav').getByRole('link',{name:'Товары',exact:true}).click();await food.getByRole('button',{name:'Продать на развес',exact:true}).click();await fd.getByLabel('Сколько, кг',{exact:true}).fill('0,5');await fd.getByRole('button',{name:'Записать продажу',exact:true}).click();await fd.waitFor({state:'hidden'});
 assert.match(await food.locator('.product-card-stock').innerText(),/7 кг/);if(process.env.QA_SCREENSHOT_DIR)await food.screenshot({path:require('node:path').join(process.env.QA_SCREENSHOT_DIR,'lavka-food-live.png'),fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS: onboarding, sizes, pairs, exact variant sale, persistence, fractional sale, 320/390/768/1280 widths.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

