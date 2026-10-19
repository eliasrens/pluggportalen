import fs from "fs"; import path from "path";
const seen=new Set(); const q=[path.resolve("src/app.js")];
while(q.length){const f=q.pop(); if(seen.has(f))continue; seen.add(f); let s; try{s=fs.readFileSync(f,"utf8")}catch{continue}
 for(const m of s.matchAll(/(?:^|\n)\s*(?:import|export)[^'"\n;]*?from\s*["'](\.[^"']+)["']|(?:^|\n)\s*import\s*["'](\.[^"']+)["']/g)){const p=m[1]||m[2]; q.push(path.resolve(path.dirname(f),p));}}
console.log(seen.size, [...seen].filter(f=>/helskarm/.test(f)));
