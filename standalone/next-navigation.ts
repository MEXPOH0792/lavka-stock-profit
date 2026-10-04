import {useEffect,useState} from 'react';

function currentPath(){const value=location.hash.slice(1);return value.startsWith('/')?value:'/';}

export function usePathname(){
 const [path,setPath]=useState(currentPath);
 useEffect(()=>{const update=()=>setPath(currentPath());addEventListener('hashchange',update);return()=>removeEventListener('hashchange',update);},[]);
 return path;
}
