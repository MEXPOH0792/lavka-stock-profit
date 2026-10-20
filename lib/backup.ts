import type {Ledger} from './ledger';

const MAX_BACKUP_SIZE=2_000_000;

function isLedger(value:unknown):value is Ledger{
 if(!value||typeof value!=='object')return false;
 const row=value as Partial<Ledger>;
 return ['products','batches','sales','adjustments','expenses','allocations','categories','expenseCategories'].every(key=>Array.isArray(row[key as keyof Ledger]))&&!!row.settings&&typeof row.settings==='object';
}

export function createBackup(ledger:Ledger):string{
 return JSON.stringify({version:1,savedAt:new Date().toISOString(),ledger});
}

export function readBackup(text:string):Ledger{
 if(!text||text.length>MAX_BACKUP_SIZE)throw Error('Файл слишком большой или пустой.');
 let parsed:unknown;try{parsed=JSON.parse(text);}catch{throw Error('Это не файл «Лавки».');}
 const payload=parsed as {version?:unknown;ledger?:unknown};
 if(payload.version!==1||!isLedger(payload.ledger))throw Error('Это не файл «Лавки».');
 return structuredClone(payload.ledger);
}
