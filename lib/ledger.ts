export type Replenishment = { supplier: string; leadTimeDays: number | null };
export type Product = { id: string; name: string; category: string; unit: 'kg' | 'pcs'; price: number; archived: boolean; createdAt: string; updatedAt: string; replenishment?: Replenishment };
export type Batch = { id: string; productId: string; date: string; dateKnown: boolean; quantity: number; price: number; supplier: string; expiry: string; note: string; opening: boolean; createdAt: string; remaining?: number };
export type Allocation = { id: string; saleId: string; batchId: string; quantity: number; price: number; cost: number };
export type Sale = { id: string; productId: string; date: string; quantity: number; price: number; note: string; createdAt: string; revenue?: number; cost?: number; profit?: number };
export type Adjustment = { id: string; productId: string; date: string; quantity: number; price: number; reason: string; createdAt: string; previous?: number; difference?: number; loss?: number };
export type Expense = { id: string; name: string; category: string; amount: number; date: string; recurring: boolean; note: string; sourceId: string; createdAt: string };
export type Settings = { name: string; owner: string; staleDays: number; timezone: string };
export type Ledger = { products: Product[]; batches: Batch[]; sales: Sale[]; adjustments: Adjustment[]; expenses: Expense[]; categories: {id:string;name:string}[]; expenseCategories: {id:string;name:string}[]; allocations: Allocation[]; settings: Settings };
export const expenseDefaults = ['Аренда','Зарплата','Электричество','Интернет','Налоги','Доставка','Упаковка','Реклама','Ремонт','Прочее'];
export function emptyLedger(): Ledger { return {products:[],batches:[],sales:[],adjustments:[],expenses:[],allocations:[],categories:['Сухофрукты','Орехи','Специи','Сладости','Прочее'].map(name=>({id:name,name})),expenseCategories:expenseDefaults.map(name=>({id:name,name})),settings:{name:'Мой магазин',owner:'Владелец',staleDays:30,timezone:'Asia/Barnaul'}}; }
export function fixed(input: unknown, digits: number, allowZero=false): number {
  const value=String(input??'').trim().replace(',','.');
  if(!new RegExp(`^\\d{1,9}(?:\\.\\d{1,${digits}})?$`).test(value)) throw Error(`Введите положительное число, не более ${digits} знаков после запятой.`);
  const [a,b='']=value.split('.'); const result=Number(BigInt(a)*BigInt(10**digits)+BigInt(b.padEnd(digits,'0')));
  if(!Number.isSafeInteger(result)||result>1_000_000_000_000||result<(allowZero?0:1))throw Error('Сумма или количество вне допустимого диапазона.'); return result;
}
export function cost(quantity:number, price:number):number {const n=Number((BigInt(quantity)*BigInt(price)+500n)/1000n);if(!Number.isSafeInteger(n))throw Error('Сумма операции слишком велика.');return n;}
function exactSum(values:number[]):number {const n=Number(values.reduce((sum,value)=>sum+BigInt(value),0n));if(!Number.isSafeInteger(n))throw Error('Превышен допустимый объём учёта.');return n;}
export function money(cents:number):string {const n=BigInt(cents);const a=n<0n?-n:n;return `${n<0n?'−':''}${(a/100n).toLocaleString('ru-RU')}${a%100n?','+String(a%100n).padStart(2,'0'):''} ₽`;}
export function qty(q:number):string {return (q/1000).toLocaleString('ru-RU',{maximumFractionDigits:3});}
export function today(zone='Asia/Barnaul'):string {return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function days(date:string,now:string):number {return Math.floor((Date.parse(now)-Date.parse(date))/86400000);}
export function dateValue(value:unknown,max:string):string {const s=String(value??'');if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||isNaN(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s||s>max||s<'2000-01-01')throw Error('Укажите корректную дату, не позднее сегодняшней.');return s;}
export function textValue(value:unknown,required=false,max=200):string {const s=String(value??'').trim();if((required&&!s)||s.length>max)throw Error(`Заполните поле (до ${max} символов).`);return s;}
export function quantity(value:unknown,p:Product,zero=false):number {const q=fixed(value,3,zero);if(p.unit==='pcs'&&q%1000!==0)throw Error('Штучный товар учитывается целыми единицами.');return q;}

// Replay the dated ledger so historical edits cannot silently corrupt FIFO or month-end stock.
export function calculate(source:Ledger, cutoff='9999-12-31'):Ledger {
 const l=structuredClone(source);l.allocations=[];const active:Batch[]=[];
 const events=[...l.batches.map(b=>({kind:'batch',item:b})),...l.sales.map(s=>({kind:'sale',item:s})),...l.adjustments.map(a=>({kind:'adjustment',item:a}))].filter(e=>e.item.date<=cutoff).sort((a,b)=>a.item.date.localeCompare(b.item.date)||a.item.createdAt.localeCompare(b.item.createdAt)||a.item.id.localeCompare(b.item.id));
 const take=(productId:string,requested:number,saleId:string)=>{let left=requested,total=0;const stock=active.filter(b=>b.productId===productId).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
  const available=stock.reduce((n,b)=>n+(b.remaining??0),0);if(requested>available)throw Error(`Недостаточно товара. В наличии ${qty(available)}. Проверьте количество и дату операции.`);
  for(const b of stock){if(!left)break;const before=b.remaining??0;const used=Math.min(left,before);if(!used)continue;const value=cost(before,b.price)-cost(before-used,b.price);b.remaining=before-used;left-=used;total+=value;if(saleId)l.allocations.push({id:`${saleId}:${b.id}`,saleId,batchId:b.id,quantity:used,price:b.price,cost:value});}return total;};
 for(const event of events){if(event.kind==='batch'){const b=event.item as Batch;b.remaining=b.quantity;active.push(b);}else if(event.kind==='sale'){const s=event.item as Sale;s.cost=take(s.productId,s.quantity,s.id);s.revenue=cost(s.quantity,s.price);s.profit=s.revenue-s.cost;}else{const a=event.item as Adjustment;a.previous=active.filter(b=>b.productId===a.productId).reduce((n,b)=>n+(b.remaining??0),0);a.difference=a.quantity-a.previous;a.loss=0;if(a.difference<0)a.loss=take(a.productId,-a.difference,'');if(a.difference>0)active.push({id:`adjustment:${a.id}`,productId:a.productId,date:a.date,dateKnown:true,quantity:a.difference,remaining:a.difference,price:a.price,opening:true,supplier:'Корректировка',expiry:'',note:a.reason,createdAt:a.createdAt});}}
 l.batches=active;l.sales=l.sales.filter(s=>s.date<=cutoff);l.adjustments=l.adjustments.filter(a=>a.date<=cutoff);
 exactSum(active.map(b=>b.quantity));exactSum(active.map(b=>cost(b.quantity,b.price)));exactSum(l.sales.map(s=>s.revenue??0));exactSum(l.sales.map(s=>s.cost??0));exactSum(l.expenses.map(e=>e.amount));
 return l;
}
export function summary(source:Ledger,from:string,to:string) {const l=calculate(source,to);const sales=l.sales.filter(s=>s.date>=from);const revenue=sales.reduce((n,s)=>n+(s.revenue??0),0),cogs=sales.reduce((n,s)=>n+(s.cost??0),0),expenses=l.expenses.filter(e=>e.date>=from&&e.date<=to).reduce((n,e)=>n+e.amount,0);return {revenue,cogs,gross:revenue-cogs,expenses,net:revenue-cogs-expenses,stock:l.batches.reduce((n,b)=>n+cost(b.remaining??0,b.price),0),purchased:source.batches.filter(b=>!b.opening&&b.date>=from&&b.date<=to).reduce((n,b)=>n+cost(b.quantity,b.price),0),loss:l.adjustments.filter(a=>a.date>=from).reduce((n,a)=>n+(a.loss??0),0)};}

export type InventoryMetrics = {
 stockCents:number; staleCents:number; stale:boolean|null;
 turnoverDays:number|null; markupPercent:number|null;
 soldCostCents:number; revenueCents:number; datedCostCents:number;
 weightedDays:string; incompleteDates:boolean;
 averageDailyQuantity:number|null; observationDays:number;
 leadTimeDays:number|null; reorderPointQuantity:number|null; recommendedOrderQuantity:number|null;
};
export type InventoryAnalytics = {products:Record<string,InventoryMetrics>;groups:{name:string;metrics:InventoryMetrics}[];from:string;to:string;stockAsOf:string};

// FIFO holding time, weighted by actual allocated cost. Monetary arithmetic stays integer.
// Unknown purchase dates and inventory surpluses cannot establish a purchase-to-sale interval.
export function inventoryAnalytics(source:Ledger,from:string,to:string,now=today(source.settings.timezone)):InventoryAnalytics {
 const clean={...source,batches:source.batches.filter(b=>!b.id.startsWith('adjustment:'))};
 const l=calculate(clean,now), end=to<now?to:now;
 const batches=new Map(l.batches.map(b=>[b.id,b])), sales=new Map(l.sales.filter(s=>s.date>=from&&s.date<=end).map(s=>[s.id,s]));
 const products:Record<string,InventoryMetrics>=Object.create(null);
 const finish=(m:InventoryMetrics)=>{
  m.turnoverDays=m.datedCostCents>0&&!m.incompleteDates?Number(BigInt(m.weightedDays)*100n/BigInt(m.datedCostCents))/100:null;
  m.markupPercent=m.soldCostCents>0?Number((BigInt(m.revenueCents)-BigInt(m.soldCostCents))*10000n/BigInt(m.soldCostCents))/100:null;
 };
 for(const p of l.products){
  const stock=l.batches.filter(b=>b.productId===p.id&&(b.remaining??0)>0);
  const stale=stock.filter(b=>b.dateKnown&&!b.id.startsWith('adjustment:')&&days(b.date,now)>l.settings.staleDays);
  const history=l.batches.filter(b=>b.productId===p.id).map(b=>b.date).sort();
  const observationDays=history.length?Math.min(30,days(history[0],now)+1):0;
  const recent=l.sales.filter(s=>s.productId===p.id&&days(s.date,now)<observationDays);
  const m:InventoryMetrics={stockCents:exactSum(stock.map(b=>cost(b.remaining??0,b.price))),staleCents:exactSum(stale.map(b=>cost(b.remaining??0,b.price))),stale:stale.length?true:stock.some(b=>!b.dateKnown||b.id.startsWith('adjustment:'))?null:false,turnoverDays:null,markupPercent:null,soldCostCents:0,revenueCents:0,datedCostCents:0,weightedDays:'0',incompleteDates:false,averageDailyQuantity:observationDays?exactSum(recent.map(s=>s.quantity))/observationDays:null,observationDays,leadTimeDays:p.replenishment?.leadTimeDays??null,reorderPointQuantity:null,recommendedOrderQuantity:null};
  const sold=[...sales.values()].filter(s=>s.productId===p.id);m.soldCostCents=exactSum(sold.map(s=>s.cost??0));m.revenueCents=exactSum(sold.map(s=>s.revenue??0));products[p.id]=m;
 }
 for(const a of l.allocations){const s=sales.get(a.saleId);if(!s)continue;const b=batches.get(a.batchId),m=products[s.productId];if(!b||!b.dateKnown||b.id.startsWith('adjustment:')){m.incompleteDates=true;continue;}m.datedCostCents=exactSum([m.datedCostCents,a.cost]);m.weightedDays=String(BigInt(m.weightedDays)+BigInt(a.cost)*BigInt(days(b.date,s.date)));}
 Object.values(products).forEach(finish);
 const groups=[...new Set(l.products.map(p=>p.category))].map(name=>{
  const members=l.products.filter(p=>p.category===name).map(p=>products[p.id]);
  const m:InventoryMetrics={...members[0],stockCents:exactSum(members.map(m=>m.stockCents)),staleCents:exactSum(members.map(m=>m.staleCents)),stale:members.some(m=>m.stale===true)?true:members.some(m=>m.stale===null)?null:false,soldCostCents:exactSum(members.map(m=>m.soldCostCents)),revenueCents:exactSum(members.map(m=>m.revenueCents)),datedCostCents:exactSum(members.map(m=>m.datedCostCents)),weightedDays:String(members.reduce((n,m)=>n+BigInt(m.weightedDays),0n)),incompleteDates:members.some(m=>m.incompleteDates),averageDailyQuantity:null,observationDays:0,leadTimeDays:null};finish(m);return {name,metrics:m};
 });
 return {products,groups,from,to:end,stockAsOf:now};
}

export function mutate(original:Ledger, input:Record<string,unknown>):Ledger {
 const l=structuredClone(original), kind=textValue(input.kind,true), id=textValue(input.id)||crypto.randomUUID(),createdAt=new Date(Math.max(Date.now(),...([...l.batches,...l.sales,...l.adjustments].map(e=>Date.parse(e.createdAt)+1)))).toISOString(), now=today(l.settings.timezone);
 let p=l.products.find(p=>p.id===input.productId);
 if(['purchase','opening','adjustment'].includes(kind)&&input.productId==='__new__'){
  const unit=input.newProductUnit==='kg'?'kg':input.newProductUnit==='pcs'?'pcs':null;if(!unit)throw Error('Выберите кг или шт. для нового товара.');
  const category=textValue(input.newProductCategory),productId=crypto.randomUUID();
  p={id:productId,name:textValue(input.newProductName,true),category,unit,price:input.newProductPrice?fixed(input.newProductPrice,2,true):input.salePrice?fixed(input.salePrice,2,true):0,archived:false,createdAt,updatedAt:createdAt};
  l.products.push(p);if(category&&!l.categories.some(c=>c.name===category))l.categories.push({id:crypto.randomUUID(),name:category});
 }
 const getProduct=()=>{if(!p||p.archived)throw Error('Выберите действующий товар или добавьте новый.');return p;};
 if(['purchase','opening','sale','adjustment'].includes(kind)&&[...l.batches,...l.sales,...l.adjustments].some(e=>e.id===id))throw Error('Эта операция уже существует.');
 if(kind==='updateOpening'){const batch=l.batches.find(b=>b.id===id&&b.opening);if(!batch)throw Error('Начальный остаток не найден.');const product=l.products.find(p=>p.id===batch.productId);if(!product)throw Error('Товар не найден.');const hasLaterHistory=l.batches.some(b=>b.productId===product.id&&b.id!==batch.id)||l.sales.some(s=>s.productId===product.id)||l.adjustments.some(a=>a.productId===product.id);if(hasLaterHistory)throw Error('После этого остатка уже есть движения. Измените количество через «Взвесить».');const unit=input.unit==='kg'?'kg':input.unit==='pcs'?'pcs':null;if(!unit)throw Error('Выберите кг или шт.');product.name=textValue(input.name,true);product.category=textValue(input.category);product.unit=unit;product.price=input.salePrice?fixed(input.salePrice,2,true):0;product.updatedAt=createdAt;batch.date=dateValue(input.date,now);batch.dateKnown=input.dateKnown!==false;batch.quantity=quantity(input.quantity,product);batch.price=fixed(input.price,2);batch.note=textValue(input.note,false,1000);if(product.category&&!l.categories.some(c=>c.name===product.category))l.categories.push({id:crypto.randomUUID(),name:product.category});}
 else if(kind==='deleteProduct'){const product=l.products.find(p=>p.id===id);if(!product)throw Error('Товар не найден.');const hasHistory=l.batches.some(b=>b.productId===id&&!b.opening)||l.sales.some(s=>s.productId===id)||l.adjustments.some(a=>a.productId===id);if(hasHistory)throw Error('Удалить товар с продажами, закупками или корректировками нельзя. Обнулите остаток и перенесите товар в архив.');l.batches=l.batches.filter(b=>b.productId!==id);l.products=l.products.filter(p=>p.id!==id);}
 else if(kind==='product'){const old=l.products.find(p=>p.id===id);const unit=input.unit==='kg'?'kg':input.unit==='pcs'?'pcs':null;if(!unit)throw Error('Выберите кг или шт.');if(old&&old.unit!==unit&&(l.batches.some(b=>b.productId===id)||l.sales.some(s=>s.productId===id)||l.adjustments.some(a=>a.productId===id)))throw Error('Единицу товара с историей менять нельзя.');const row:Product={id,name:textValue(input.name,true),category:textValue(input.category),unit,price:input.price?fixed(input.price,2,true):0,archived:old?.archived??false,createdAt:old?.createdAt??createdAt,updatedAt:createdAt};l.products=l.products.filter(p=>p.id!==id).concat(row);if(row.category&&!l.categories.some(c=>c.name===row.category))l.categories.push({id:crypto.randomUUID(),name:row.category});}
 else if(kind==='archive'){const product=l.products.find(p=>p.id===id);if(!product)throw Error('Товар не найден.');if(!product.archived&&calculate(l).batches.some(b=>b.productId===id&&(b.remaining??0)>0))throw Error('Перед архивированием остаток должен быть нулевым.');product.archived=!product.archived;}
 else if(kind==='purchase'||kind==='opening'){const product=getProduct();l.batches.push({id,productId:product.id,date:dateValue(input.date,now),dateKnown:input.dateKnown!==false,quantity:quantity(input.quantity,product),price:fixed(input.price,2),supplier:textValue(input.supplier),expiry:input.expiry?dateValue(input.expiry,'2100-12-31'):'',note:textValue(input.note,false,1000),opening:kind==='opening',createdAt});if(input.expiry&&String(input.expiry)<String(input.date))throw Error('Срок годности не может быть раньше закупки.');if(kind==='opening'&&input.salePrice)product.price=fixed(input.salePrice,2,true);}
 else if(kind==='sale'){const product=getProduct();l.sales.push({id,productId:product.id,date:dateValue(input.date,now),quantity:quantity(input.quantity,product),price:fixed(input.price,2),note:textValue(input.note,false,1000),createdAt});}
 else if(kind==='adjustment'){const product=getProduct();const current=calculate(l).batches.filter(b=>b.productId===product.id).reduce((n,b)=>n+(b.remaining??0),0);const q=quantity(input.quantity,product,true);l.adjustments.push({id,productId:product.id,date:now,quantity:q,price:q>current?fixed(input.price,2):0,reason:textValue(input.reason,true),createdAt});}
 else if(kind==='expense'){const old=l.expenses.find(e=>e.id===id);const row:Expense={id,name:textValue(input.name,true),category:textValue(input.category,true),amount:fixed(input.amount,2),date:dateValue(input.date,now),recurring:input.recurring===true,note:textValue(input.note,false,1000),sourceId:old?.sourceId??'',createdAt:old?.createdAt??createdAt};l.expenses=l.expenses.filter(e=>e.id!==id).concat(row);if(!l.expenseCategories.some(c=>c.name===row.category))l.expenseCategories.push({id:crypto.randomUUID(),name:row.category});}
 else if(kind==='repeatExpense'){const e=l.expenses.find(e=>e.id===id);if(!e?.recurring)throw Error('Постоянный расход не найден.');const root=e.sourceId||e.id;if(l.expenses.some(x=>(x.id===root||x.sourceId===root)&&x.date.slice(0,7)===now.slice(0,7)))throw Error('Этот расход уже добавлен в текущий месяц.');l.expenses.push({...e,id:crypto.randomUUID(),sourceId:root,date:now,createdAt});}
 else if(kind==='deleteExpense'){l.expenses=l.expenses.filter(e=>e.id!==id);}
 else if(kind==='settings'){l.settings={name:textValue(input.name,true),owner:textValue(input.owner,true),staleDays:Number(input.staleDays),timezone:textValue(input.timezone,true)};if(!Number.isInteger(l.settings.staleDays)||l.settings.staleDays<1||l.settings.staleDays>365)throw Error('Порог: от 1 до 365 дней.');try{today(l.settings.timezone);}catch{throw Error('Неизвестный часовой пояс.');}}
 else throw Error('Неизвестная операция.');
 if(kind==='product'){
  const row=l.products.find(p=>p.id===id)!;
  const old=original.products.find(p=>p.id===id);
  row.replenishment=old?.replenishment;
  if(input.leadTimeDays!==undefined||input.preferredSupplier!==undefined){
   const raw=input.leadTimeDays??old?.replenishment?.leadTimeDays??'';
   const leadTimeDays=raw===''?null:Number(raw);
   if(leadTimeDays!==null&&(!Number.isInteger(leadTimeDays)||leadTimeDays<0||leadTimeDays>365))throw Error('Срок поставки: от 0 до 365 дней.');
   row.replenishment={supplier:textValue(input.preferredSupplier??old?.replenishment?.supplier),leadTimeDays};
  }
 }
 calculate(l);return l;
}
