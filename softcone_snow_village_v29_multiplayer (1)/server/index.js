const express=require('express');
const http=require('http');
const {Server}=require('socket.io');
const fs=require('fs');
const path=require('path');
const app=express(),server=http.createServer(app),io=new Server(server,{maxHttpBufferSize:2e6});
const root=path.join(__dirname,'../softcone_snow_village_v28');
const dataPath=process.env.DATA_PATH||path.join(__dirname,'village-data.json');
let saved={wishes:[],cones:[]};try{const v=JSON.parse(fs.readFileSync(dataPath,'utf8'));saved={wishes:v.wishes||[],cones:v.cones||[]}}catch{}
let timer;function persist(){clearTimeout(timer);timer=setTimeout(()=>fs.writeFile(dataPath,JSON.stringify(saved),e=>e&&console.error(e)),350)}
const players=new Map(),clean=s=>String(s||'').replace(/[<>]/g,'').slice(0,40),finite=(n,def=50)=>Number.isFinite(Number(n))?Math.max(0,Math.min(100,Number(n))):def;
function playerList(){return [...players.values()].map(({uid,nick,character,x,y})=>({uid,nick,character,x,y}))}
function broadcastPlayers(){io.emit('world:players',playerList())}
app.use(express.static(root));app.get('/',(_,res)=>res.sendFile(path.join(root,'index.html')));
io.on('connection',socket=>{
 socket.emit('world:snapshot',{...saved,players:playerList()});
 socket.on('player:join',d=>{if(!d||typeof d!=='object')return;const uid=clean(d.uid).slice(0,64);if(!uid)return;socket.data.uid=uid;players.set(socket.id,{uid,nick:clean(d.nick).slice(0,14),character:Math.max(1,Math.min(17,Number(d.character)||1)),x:finite(d.x),y:finite(d.y)});broadcastPlayers()});
 socket.on('player:move',d=>{const p=players.get(socket.id);if(!p||!d)return;p.x=finite(d.x,p.x);p.y=finite(d.y,p.y);broadcastPlayers()});
 socket.on('wish:replace',items=>{if(!socket.data.uid||!Array.isArray(items))return;const own=saved.wishes.filter(x=>x.uid===socket.data.uid);const incoming=items.filter(x=>x&&x.uid===socket.data.uid&&Array.isArray(x.pts)&&x.pts.length<=1200&&JSON.stringify(x).length<30000).slice(0,100).map(x=>({...x,message:clean(x.message).slice(0,180),nick:clean(x.nick).slice(0,14)}));saved.wishes=[...saved.wishes.filter(x=>x.uid!==socket.data.uid),...incoming].slice(-1200);persist();io.emit('world:wishes',saved.wishes)});
 socket.on('cones:replace',items=>{if(!socket.data.uid||!Array.isArray(items))return;const incoming=items.filter(x=>x&&x.uid===socket.data.uid&&typeof x.img==='string'&&x.img.startsWith('data:image/png;base64,')&&x.img.length<850000).slice(0,30).map(x=>({...x,x:finite(x.x),y:finite(x.y)}));saved.cones=[...saved.cones.filter(x=>x.uid!==socket.data.uid),...incoming].slice(-150);persist();io.emit('world:cones',saved.cones)});
 socket.on('disconnect',()=>{players.delete(socket.id);broadcastPlayers()});
});
server.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Softcone multiplayer listening on',process.env.PORT||3000));
