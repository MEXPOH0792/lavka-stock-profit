import React from 'react';
import {createRoot} from 'react-dom/client';
import Shop from '../app/shop';
import '../app/globals.css';

document.addEventListener('click',event=>{
 const anchor=(event.target as Element).closest?.('a');
 const href=anchor?.getAttribute('href');
 if(!href?.startsWith('/'))return;
 event.preventDefault();
 location.hash=href;
});

createRoot(document.getElementById('root')!).render(<React.StrictMode><Shop/></React.StrictMode>);
