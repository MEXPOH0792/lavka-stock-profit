import {emptyLedger,mutate,today,type Ledger} from './ledger';
export function demoLedger():Ledger {
 let l=emptyLedger();l.settings.name='Лавка на углу';l.settings.owner='Анна';const now=today();const ago=(n:number)=>{const d=new Date(now);d.setUTCDate(d.getUTCDate()-n);return d.toISOString().slice(0,10);};
 const list=[['Финики Меджул','Сухофрукты','kg','790','420','32','48'],['Миндаль золотой','Орехи','kg','1290','860','18','67'],['Курага натуральная','Сухофрукты','kg','690','380','26','42'],['Кешью жареный','Орехи','kg','1490','940','20','18'],['Изюм тёмный','Сухофрукты','kg','490','230','30','12'],['Паприка копчёная','Специи','kg','1890','1120','6','95'],['Чурчхела','Сладости','pcs','190','95','80','9'],['Фисташки','Орехи','kg','1790','1180','15','24']];
 list.forEach((v,i)=>{l=mutate(l,{kind:'product',id:`p${i}`,name:v[0],category:v[1],unit:v[2],price:v[3]});l=mutate(l,{kind:'purchase',id:`b${i}`,productId:`p${i}`,date:ago(Number(v[6])),quantity:v[5],price:v[4],supplier:'Восточный рынок'});});
 for(let n=7;n>=0;n--)for(let i=0;i<8;i++){l=mutate(l,{kind:'sale',id:`s${n}-${i}`,productId:`p${i}`,date:ago(n),quantity:i===6?'3':i===5?'0.2':String((i%3+1)/2),price:list[i][3]});}
 l=mutate(l,{kind:'expense',id:'e1',name:'Аренда магазина',category:'Аренда',amount:'12000',date:now.slice(0,7)+'-01',recurring:true});l=mutate(l,{kind:'expense',id:'e2',name:'Доставка от поставщика',category:'Доставка',amount:'1800',date:ago(2)});l=mutate(l,{kind:'expense',id:'e3',name:'Пакеты и контейнеры',category:'Упаковка',amount:'950',date:ago(1)});return l;
}
