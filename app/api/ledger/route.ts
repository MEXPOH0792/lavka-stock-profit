import { getChatGPTUser } from '../../chatgpt-auth';
import { readLedger, writeLedger } from '../../../db/store';
import { calculate, mutate, summary, today, inventoryAnalytics } from '../../../lib/ledger';
import { demoLedger } from '../../../lib/demo';
const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 try{const user=await getChatGPTUser();if(!user)return reply({error:'Войдите в приложение.'},401);const url=new URL(request.url),demo=url.searchParams.get('demo')==='1';const {ledger,revision}=demo?{ledger:demoLedger(),revision:0}:await readLedger(user.userId);const now=today(ledger.settings.timezone),month=url.searchParams.get('month')||now.slice(0,7),period=url.searchParams.get('period')||'month';if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month<'2000-01'||month>'2100-12')return reply({error:'Некорректный месяц.'},400);let from=month+'-01',to=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10);if(period==='today'){from=now;to=now;}if(period==='week'){const d=new Date(now);d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));from=d.toISOString().slice(0,10);to=now;}return reply({ledger:calculate(ledger),revision,analytics:inventoryAnalytics(ledger,from,to,now),summary:summary(ledger,from,to),now,from,to,demo});
 }catch(e){console.error(e);return reply({error:'Не удалось загрузить учёт. Попробуйте ещё раз.'},503);}
}
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(!origin||origin!==new URL(request.url).origin)return reply({error:'Недопустимый источник запроса.'},403);
 const user=await getChatGPTUser();if(!user)return reply({error:'Войдите в приложение.'},401);
 try{const raw=await request.text();if(raw.length>16000)return reply({error:'Слишком большой запрос.'},413);const body=JSON.parse(raw);const {ledger,revision}=await readLedger(user.userId);if(body.revision!==revision)return reply({error:'Данные изменились в другой вкладке. Обновите страницу и повторите операцию.'},409);
 let updated;try{updated=mutate(ledger,body);}catch(e){return reply({error:e instanceof Error?e.message:'Проверьте поля формы.'},400);}
 const calculated=calculate(updated);updated.allocations=calculated.allocations;
 try{await writeLedger(user.userId,revision,ledger,updated);}catch(e){console.error(e);return reply({error:'Сохранение не выполнено. Обновите данные перед повторной попыткой.'},409);}return reply({ok:true});
 }catch(e){console.error(e);return reply({error:'Не удалось сохранить операцию. Введённые данные сохранены в форме.'},503);}
}
