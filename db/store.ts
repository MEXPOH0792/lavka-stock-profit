import { env } from 'cloudflare:workers';
import { emptyLedger, type Ledger } from '../lib/ledger';
const names=['products','batches','sales','adjustments','expenses','categories','expenseCategories','allocations'] as const;
const tables={products:'products',batches:'purchase_batches',sales:'sales',adjustments:'inventory_adjustments',expenses:'expenses',categories:'categories',expenseCategories:'expense_categories',allocations:'sale_batch_allocations'};
function db():D1Database {if(!env.DB)throw Error('DB unavailable');return env.DB;}
export async function readLedger(owner:string):Promise<{ledger:Ledger;revision:number}>{
 const d=db();await d.prepare('INSERT OR IGNORE INTO users (id, revision, settings) VALUES (?, 0, ?)').bind(owner,JSON.stringify(emptyLedger().settings)).run();
 const rows=await d.batch([d.prepare('SELECT revision, settings FROM users WHERE id=?').bind(owner),...names.map(key=>d.prepare(`SELECT payload FROM ${tables[key]} WHERE owner=?`).bind(owner))]);
 const user=rows[0].results[0] as {revision:number;settings:string};const ledger=emptyLedger();ledger.settings=JSON.parse(user.settings);
 names.forEach((key,i)=>{const items=rows[i+1].results.map(r=>JSON.parse((r as {payload:string}).payload));if(key==='categories'||key==='expenseCategories'){Object.assign(ledger,{[key]:[...ledger[key],...items.filter(item=>!ledger[key].some(c=>c.name===item.name))]});}else Object.assign(ledger,{[key]:items});});return {ledger,revision:user.revision};
}
export async function writeLedger(owner:string,revision:number,before:Ledger,after:Ledger){
 const d=db();const statements=[d.prepare('UPDATE users SET revision=CASE WHEN revision=? THEN revision+1 ELSE -1 END, settings=? WHERE id=?').bind(revision,JSON.stringify(after.settings),owner)];
 for(const key of names){const old=new Map(before[key].map(row=>[row.id,JSON.stringify(row)]));for(const row of after[key]){const payload=JSON.stringify(row);if(old.get(row.id)!==payload)statements.push(d.prepare(`INSERT INTO ${tables[key]} (owner,id,payload) VALUES (?,?,?) ON CONFLICT(owner,id) DO UPDATE SET payload=excluded.payload`).bind(owner,row.id,payload));old.delete(row.id);}for(const id of old.keys())statements.push(d.prepare(`DELETE FROM ${tables[key]} WHERE owner=? AND id=?`).bind(owner,id));}
 await d.batch(statements);
}

