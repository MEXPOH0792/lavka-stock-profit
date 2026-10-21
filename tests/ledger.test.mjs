import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyLedger,mutate,calculate,summary,fixed,cost,today,inventoryAnalytics} from '../lib/ledger.ts';
import {createBackup,readBackup} from '../lib/backup.ts';
function base(){return mutate(emptyLedger(),{kind:'product',id:'p',name:'Финики',unit:'kg',price:'700'});}
function buy(l,q,p,d='2026-01-01'){return mutate(l,{kind:'purchase',productId:'p',quantity:q,price:p,date:d});}
function sell(l,q,p='700',d='2026-01-03'){return mutate(l,{kind:'sale',productId:'p',quantity:q,price:p,date:d});}

test('shop choice preserves existing records and survives settings updates',()=>{
 const original=buy(base(),'5','300');const selected=mutate(original,{kind:'shopType',shopType:'fashion'});
 assert.deepEqual(selected.products,original.products);assert.deepEqual(selected.batches,original.batches);
 const changed=mutate(selected,{kind:'settings',...selected.settings,name:'Обувь'});
 assert.equal(changed.settings.shopType,'fashion');assert.throws(()=>mutate(changed,{kind:'shopType',shopType:'unknown'}));
});
test('sizes and colors keep separate stock; pairs cannot be fractional',()=>{
 let l=mutate(emptyLedger(),{kind:'shopType',shopType:'fashion'});
 for(const [size,color] of [['42','Чёрный'],['43','Чёрный'],['42','Белый']])l=mutate(l,{kind:'opening',productId:'__new__',newProductName:'Кроссовки',newProductUnit:'pair',newProductSize:size,newProductColor:color,newProductPrice:'3500',quantity:'3',price:'2100',date:'2026-01-01',dateKnown:false});
 const p=l.products[0];l=mutate(l,{kind:'sale',productId:p.id,quantity:'1',price:'3500',date:'2026-01-02'});
 assert.deepEqual(calculate(l).batches.map(b=>b.remaining),[2000,3000,3000]);
 assert.equal(summary(l,'2026-01-01','2026-01-31').gross,140000);
 assert.throws(()=>mutate(l,{kind:'sale',productId:p.id,quantity:'0.5',price:'3500',date:'2026-01-02'}));
 const updated=mutate(l,{kind:'product',id:p.id,name:p.name,unit:'pair',price:'3600'});
 assert.equal(updated.products.find(x=>x.id===p.id).size,'42');assert.equal(updated.products.find(x=>x.id===p.id).color,'Чёрный');
 assert.throws(()=>mutate(l,{kind:'opening',productId:'__new__',newProductName:'кроссовки',newProductUnit:'pair',newProductSize:'42',newProductColor:'чёрный',quantity:'1',price:'2100',date:'2026-01-01'}),/уже есть/);
 assert.equal(readBackup(createBackup(l)).products[0].unit,'pair');
});
test('food shop keeps fractional weights and opening edits keep variant fields',()=>{
 let l=mutate(base(),{kind:'shopType',shopType:'food'});l=buy(l,'7.5','300');l=sell(l,'0.5','450');assert.equal(calculate(l).batches[0].remaining,7000);
 let fashion=mutate(emptyLedger(),{kind:'opening',productId:'__new__',newProductName:'Футболка',newProductUnit:'pcs',newProductSize:'M',newProductColor:'Белый',quantity:'2',price:'300',date:'2026-01-01'});
 fashion=mutate(fashion,{kind:'updateOpening',id:fashion.batches[0].id,name:'Футболка',unit:'pcs',quantity:'3',price:'300',date:'2026-01-01',salePrice:'600'});
 assert.equal(fashion.products[0].size,'M');assert.equal(fashion.products[0].color,'Белый');
});

const metrics=l=>inventoryAnalytics(l,'2026-01-01','2026-01-31','2026-02-01');
test('turnover weights actual FIFO cost; markup uses sales prices, not list price',()=>{
 let l=buy(buy(base(),'1','100'),'1','300','2026-01-06');l=sell(l,'2','400','2026-01-11');
 const a=metrics(l),m=a.products.p;assert.equal(m.turnoverDays,6.25);assert.equal(m.markupPercent,100);assert.equal(m.stockCents,0);assert.equal(m.stale,false);assert.equal(a.groups[0].metrics.turnoverDays,6.25);
});
test('no sales: no fabricated turnover or markup, stock and stale state remain real',()=>{
 const m=metrics(buy(base(),'10','100')).products.p;assert.equal(m.turnoverDays,null);assert.equal(m.markupPercent,null);assert.equal(m.stockCents,100000);assert.equal(m.staleCents,100000);assert.equal(m.stale,true);assert.equal(m.averageDailyQuantity,0);
});
test('unknown purchase dates suppress interval but preserve actual markup',()=>{
 let l=mutate(base(),{kind:'opening',productId:'p',quantity:'2',price:'100',date:'2026-01-01',dateKnown:false});l=sell(l,'1','130','2026-01-06');
 const m=metrics(l).products.p;assert.equal(m.turnoverDays,null);assert.equal(m.markupPercent,30);assert.equal(m.stale,null);assert.equal(m.staleCents,0);
});
test('same-day turnover and below-cost sale are valid; period excludes later sales',()=>{
 let l=sell(buy(base(),'2','100'),'1','80','2026-01-01');l=sell(l,'1','130','2026-02-01');const m=metrics(l).products.p;assert.equal(m.turnoverDays,0);assert.equal(m.markupPercent,-20);assert.equal(m.stockCents,0);
});
test('groups weight cost instead of averaging percentages and do not mix quantity units',()=>{
 let l=sell(buy(base(),'1','100'),'1','130','2026-01-06');l=mutate(l,{kind:'product',id:'p2',name:'Штучный',unit:'pcs',price:'1'});l=mutate(l,{kind:'purchase',productId:'p2',date:'2026-01-01',quantity:'1',price:'300'});l=mutate(l,{kind:'sale',productId:'p2',date:'2026-01-11',quantity:'1',price:'600'});
 const m=metrics(l).groups[0].metrics;assert.equal(m.turnoverDays,8.75);assert.equal(m.markupPercent,82.5);assert.equal(m.averageDailyQuantity,null);
});
test('analytics excludes synthetic inventory dates and is safe on calculated snapshots',()=>{
 let l=buy(base(),'1','100');l=mutate(l,{kind:'adjustment',productId:'p',quantity:'2',price:'100',reason:'Излишек'});l=sell(l,'2','130',today());
 const a=inventoryAnalytics(l,'2000-01-01',today());assert.equal(a.products.p.turnoverDays,null);assert.deepEqual(inventoryAnalytics(calculate(l),'2000-01-01',today()),a);
});
test('replenishment persists through old edit payloads; invalid delivery times rejected',()=>{
 let l=mutate(base(),{kind:'product',id:'p',name:'Финики',unit:'kg',leadTimeDays:'4',preferredSupplier:'Поставщик'});assert.equal(l.products[0].replenishment.leadTimeDays,4);
 l=mutate(l,{kind:'product',id:'p',name:'Финики 2',unit:'kg'});assert.equal(l.products[0].replenishment.leadTimeDays,4);assert.equal(metrics(l).products.p.reorderPointQuantity,null);
 for(const leadTimeDays of ['-1','1.5','366','NaN'])assert.throws(()=>mutate(l,{kind:'product',id:'p',name:'Финики',unit:'kg',leadTimeDays}),/Срок поставки/);
});
test('FIFO: 10×400 + 2×450 = 4900; revenue 8400; profit 3500',()=>{let l=buy(buy(base(),'10','400'),'10','450','2026-01-02');l=calculate(sell(l,'12'));assert.equal(l.sales[0].cost,490000);assert.equal(l.sales[0].revenue,840000);assert.equal(l.sales[0].profit,350000);assert.deepEqual(l.batches.map(b=>b.remaining),[0,8000]);assert.equal(l.allocations.length,2);});
test('oversell rejected without mutating input',()=>{const l=buy(base(),'4.5','400');assert.throws(()=>sell(l,'6'),/Недостаточно/);assert.equal(l.sales.length,0);assert.equal(calculate(l).batches[0].remaining,4500);});
test('money parser rejects floats, negatives, exponents and extra precision',()=>{assert.equal(fixed('123,45',2),12345);for(const s of ['-1','NaN','1e3','0','1.001','Infinity'])assert.throws(()=>fixed(s,2));assert.equal(fixed('0',2,true),0);});
test('fractional sales conserve every purchase cent',()=>{let l=buy(base(),'0.003','3.33');for(let n=0;n<3;n++)l=sell(l,'0.001','10');const c=calculate(l);assert.equal(c.sales.reduce((n,s)=>n+s.cost,0),cost(3,333));assert.equal(c.batches[0].remaining,0);});
test('historical report reconstructs month-end remaining cost',()=>{let l=buy(base(),'10','400');l=sell(l,'2','700','2026-01-25');l=sell(l,'3','700','2026-02-01');const r=summary(l,'2026-01-01','2026-01-31');assert.equal(r.stock,320000);assert.equal(r.revenue,140000);assert.equal(r.purchased,400000);});
test('backdated sale before stock existed is rejected',()=>{const l=buy(base(),'10','400','2026-01-05');assert.throws(()=>sell(l,'1','700','2026-01-01'),/Недостаточно/);});
test('whole pieces required',()=>{let l=mutate(emptyLedger(),{kind:'product',id:'p',name:'Штучный',unit:'pcs'});assert.throws(()=>buy(l,'0.5','100'),/целое количество/);l=buy(l,'5','100');assert.throws(()=>sell(l,'1.5'),/целое количество/);});
test('weighing reduces FIFO, zero is valid and history retained',()=>{let l=buy(base(),'10','400');l=mutate(l,{kind:'adjustment',productId:'p',quantity:'8',reason:'Взвешивание'});let c=calculate(l);assert.equal(c.adjustments[0].difference,-2000);assert.equal(c.adjustments[0].loss,80000);l=mutate(l,{kind:'adjustment',productId:'p',quantity:'0',reason:'Списание'});assert.equal(calculate(l).batches[0].remaining,0);});
test('surplus requires cost and creates an identifiable batch',()=>{let l=buy(base(),'10','400');assert.throws(()=>mutate(l,{kind:'adjustment',productId:'p',quantity:'12',reason:'Инвентаризация'}));l=mutate(l,{kind:'adjustment',productId:'p',quantity:'12',price:'450',reason:'Инвентаризация'});assert.equal(calculate(l).batches[1].remaining,2000);});
test('opening balances excluded from purchase totals',()=>{const l=mutate(base(),{kind:'opening',productId:'p',quantity:'10',price:'400',date:today(),dateKnown:false});assert.equal(summary(l,'2000-01-01','2100-01-01').purchased,0);assert.equal(calculate(l).batches[0].dateKnown,false);});
test('archiving stock and changing unit after movements rejected',()=>{const l=buy(base(),'10','400');assert.throws(()=>mutate(l,{kind:'archive',id:'p'}),/нулевым/);assert.throws(()=>mutate(l,{kind:'product',id:'p',name:'Финики',unit:'pcs'}),/менять нельзя/);});
test('recurring expense cannot duplicate current month',()=>{const l=mutate(base(),{kind:'expense',id:'e',name:'Аренда',category:'Аренда',amount:'100',date:today(),recurring:true});assert.throws(()=>mutate(l,{kind:'repeatExpense',id:'e'}),/уже добавлен/);});
test('impossible calendar dates rejected',()=>{assert.throws(()=>buy(base(),'1','10','2026-02-30'),/корректную дату/);});
test('monotonic event ordering handles same-day transactions',()=>{let l=buy(base(),'1','10',today());for(let i=0;i<10;i++)l=sell(l,'0.1','20',today());assert.equal(calculate(l).batches[0].remaining,0);});
test('purchase can atomically create a product with a custom name',()=>{const l=mutate(emptyLedger(),{kind:'purchase',productId:'__new__',newProductName:'Манго без сахара',newProductCategory:'Сухофрукты',newProductUnit:'kg',newProductPrice:'850',quantity:'3.5',price:'500',date:today()});assert.equal(l.products.length,1);assert.equal(l.products[0].name,'Манго без сахара');assert.equal(l.products[0].price,85000);assert.equal(l.batches[0].productId,l.products[0].id);assert.equal(calculate(l).batches[0].remaining,3500);});
test('invalid first operation does not leave a newly named product behind',()=>{const l=emptyLedger();assert.throws(()=>mutate(l,{kind:'purchase',productId:'__new__',newProductName:'Новый товар',newProductUnit:'pcs',quantity:'1.5',price:'100',date:today()}),/целое количество/);assert.equal(l.products.length,0);});

test('shop type allows only matching units',()=>{
 const fashion=mutate(emptyLedger(),{kind:'shopType',shopType:'fashion'});
 assert.throws(()=>mutate(fashion,{kind:'opening',productId:'__new__',newProductName:'Куртка',newProductUnit:'kg',quantity:'1',price:'1000',date:today()}),/штуки или пары/);
 const food=mutate(emptyLedger(),{kind:'shopType',shopType:'food'});
 assert.throws(()=>mutate(food,{kind:'opening',productId:'__new__',newProductName:'Курага',newProductUnit:'pair',quantity:'1',price:'500',date:today()}),/килограммы или штуки/);
});

test('filled shop cannot switch template until reset',()=>{
 let l=mutate(emptyLedger(),{kind:'shopType',shopType:'fashion'});
 l=mutate(l,{kind:'opening',productId:'__new__',newProductName:'Кроссовки',newProductCategory:'Обувь',newProductUnit:'pair',quantity:'1',price:'2000',date:today()});
 assert.throws(()=>mutate(l,{kind:'shopType',shopType:'food'}),/сначала удалите все данные/);
 l=mutate(l,{kind:'reset'});
 assert.equal(l.products.length,0);
 assert.equal(l.batches.length,0);
 assert.equal(l.settings.shopType,undefined);
 assert.equal(l.categories.length,0);
});
test('opening stock can be edited together with its product',()=>{let l=mutate(base(),{kind:'opening',id:'opening',productId:'p',quantity:'5',price:'400',salePrice:'700',date:today()});l=mutate(l,{kind:'updateOpening',id:'opening',name:'Конфеты ассорти',category:'Сладости',unit:'kg',quantity:'6.5',price:'450',salePrice:'800',date:today(),dateKnown:false});const c=calculate(l);assert.equal(c.products[0].name,'Конфеты ассорти');assert.equal(c.products[0].price,80000);assert.equal(c.batches[0].quantity,6500);assert.equal(c.batches[0].price,45000);assert.equal(c.batches[0].dateKnown,false);});
test('product and opening stock can be deleted before other movements',()=>{let l=mutate(base(),{kind:'opening',id:'opening',productId:'p',quantity:'5',price:'400',date:today()});l=mutate(l,{kind:'deleteProduct',id:'p'});assert.equal(l.products.length,0);assert.equal(l.batches.length,0);});
test('product with movement history cannot be edited as opening stock or deleted',()=>{let l=mutate(base(),{kind:'opening',id:'opening',productId:'p',quantity:'5',price:'400',date:today()});l=sell(l,'1','700',today());assert.throws(()=>mutate(l,{kind:'updateOpening',id:'opening',name:'Другое',unit:'kg',quantity:'6',price:'450',date:today()}),/есть движения/);assert.throws(()=>mutate(l,{kind:'deleteProduct',id:'p'}),/Удалить товар с продажами/);assert.equal(l.products.length,1);assert.equal(l.batches.length,1);});
test('backup round-trip preserves a valid ledger and rejects foreign files',()=>{const original=buy(base(),'2','300',today()),restored=readBackup(createBackup(original));assert.equal(restored.products[0].name,'Финики');assert.equal(restored.batches[0].quantity,2000);assert.throws(()=>readBackup('{"hello":"world"}'),/не файл/);});
