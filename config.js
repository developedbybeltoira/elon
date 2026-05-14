/* ══════════════════════════════════════════════════
   CONFIG.JS — Supabase · Constants · Characters · Obstacles
   ══════════════════════════════════════════════════ */

'use strict';

// ─── Supabase ───
const SUPABASE_URL = 'https://vfxuxtisuhkrwxphsble.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZmeHV4dGlzdWhrcnd4cGhzYmxlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2ODUyNzMsImV4cCI6MjA5NDI2MTI3M30.dh3nGIZiwCfgK_h2YHBtl_RAPnYPXQ3h2LrCvr6CFqs';

// ─── Project info ───
const PROJECT = {
  token: '$ECHICK',
  ca: 'Fv1pzrzpmk79Mb15xzRtBsnXSrQxFs4p66UmKNmBhWT',
  twitter: 'https://x.com/Echick_on_wtf',
  tgGroup: 'https://t.me/elon_chicken',
  tgBot: '@elon_chicken',
  gameSlug: 'elonchickengame',
  version: '1.0.0',
  adminPassword: 'Elonbelovedgetit',
  referralsNeeded: 5,
};

// ─── Characters ───
const CHARACTERS = [
  { id:'og',         name:'OG Chicken',         emoji:'🐓', price:0,    ability:'Speed Boost',     abilityVal:1.1, desc:'The original legend',            owned:true },
  { id:'elon',       name:'Elon Chicken',        emoji:'🤖', price:3000, ability:'Magnet Range',    abilityVal:2,   desc:'Fly to the moon' },
  { id:'mafia',      name:'Mafia Chicken',       emoji:'🎩', price:3500, ability:'Coin Multiplier', abilityVal:2,   desc:'Omerta on the streets' },
  { id:'beach',      name:'Beach Chicken',       emoji:'🌊', price:2800, ability:'Dash Ability',    abilityVal:1,   desc:'Miami vibes only' },
  { id:'cowboy',     name:'Cowboy Chicken',      emoji:'🤠', price:3200, ability:'Double Jump',     abilityVal:1,   desc:'Yeehaw across the blockchain' },
  { id:'royal',      name:'Royal Chicken',       emoji:'👑', price:4000, ability:'Shield Duration', abilityVal:1.5, desc:'Born to rule the chain' },
  { id:'golden',     name:'Golden Chicken',      emoji:'✨', price:5000, ability:'Auto Revive',     abilityVal:1,   desc:'Worth its weight in $ECHICK' },
  { id:'space',      name:'Space Chicken',       emoji:'🚀', price:4500, ability:'Flying Mode',     abilityVal:1,   desc:'One giant leap for chickenkind' },
  { id:'samurai',    name:'Samurai Chicken',     emoji:'⚔️', price:4200, ability:'Rage Mode',       abilityVal:1.3, desc:'Code of the bushido' },
  { id:'zombie',     name:'Zombie Chicken',      emoji:'🧟', price:3800, ability:'Double Rewards',  abilityVal:2,   desc:'Undead and unstoppable' },
  { id:'angel',      name:'Angel Chicken',       emoji:'😇', price:4600, ability:'Slow Motion',     abilityVal:1,   desc:'Divine protection' },
  { id:'demon',      name:'Demon Chicken',       emoji:'😈', price:4800, ability:'Turbo Boost',     abilityVal:1.5, desc:'Hell-speed runner' },
  { id:'billionaire',name:'Billionaire Chicken', emoji:'💰', price:6000, ability:'Coin Vacuum',     abilityVal:3,   desc:'Everything is for sale' },
  { id:'pharaoh',    name:'Pharaoh Chicken',     emoji:'🏺', price:5500, ability:'Speed Boost',     abilityVal:1.4, desc:'Ruler of the degen desert' },
  { id:'cyber',      name:'Cyber Chicken',       emoji:'🦾', price:4300, ability:'Magnet Range',    abilityVal:2.5, desc:'Fully upgraded for web3' },
];

// ─── Eggs (shop) ───
const EGGS = [
  { id:'basic',    name:'Basic Egg',    emoji:'🥚',  price:500,  reward:'50–150 Coins',  coins:[50,150]  },
  { id:'golden',   name:'Golden Egg',   emoji:'🌟',  price:2000, reward:'200–800 Coins', coins:[200,800] },
  { id:'moon',     name:'Moon Egg',     emoji:'🌕',  price:5000, reward:'Rare Skin',     coins:[500,1500]},
  { id:'rocket',   name:'Rocket Egg',   emoji:'🚀',  price:8000, reward:'Epic Skin',     coins:[1000,3000]},
];

// ─── Powerups ───
const POWERUPS = [
  { id:'magnet',   emoji:'🧲', name:'Moon Magnet',     duration:6000, color:'#60a5fa' },
  { id:'turbo',    emoji:'⚡', name:'Turbo Egg Boost', duration:5000, color:'#f5c842' },
  { id:'rocket',   emoji:'🚀', name:'Elon Rocket',     duration:7000, color:'#ff8c42' },
  { id:'shield',   emoji:'🛡️', name:'Diamond Shield',  duration:8000, color:'#a78bfa' },
  { id:'slow',     emoji:'🌀', name:'Slow Motion',     duration:5000, color:'#34d399' },
  { id:'vacuum',   emoji:'🌪️', name:'Coin Vacuum',     duration:6000, color:'#fbbf24' },
  { id:'fly',      emoji:'🪁', name:'Flying Mode',     duration:7000, color:'#38bdf8' },
  { id:'rage',     emoji:'🔥', name:'Rage Mode',       duration:5000, color:'#f87171' },
  { id:'double',   emoji:'✖️', name:'Double Rewards',  duration:8000, color:'#4ade80' },
];

// ─── Obstacles ───
const OBSTACLES = [
  { type:'rocket',   emoji:'🚀', w:50, h:70,  score:15, label:'Rocket!' },
  { type:'car',      emoji:'🚗', w:70, h:45,  score:10, label:'Watch out!' },
  { type:'laser',    emoji:'⚡', w:80, h:30,  score:20, label:'Laser!' },
  { type:'drone',    emoji:'🚁', w:60, h:50,  score:18, label:'Drone!' },
  { type:'cage',     emoji:'🪤', w:55, h:65,  score:25, label:'Cage!' },
  { type:'meme',     emoji:'💣', w:45, h:45,  score:12, label:'Meme Bomb!' },
  { type:'satellite',emoji:'🛸', w:65, h:55,  score:20, label:'Satellite!' },
  { type:'cone',     emoji:'🚧', w:40, h:55,  score:8,  label:'Cone!' },
  { type:'barrel',   emoji:'🛢️', w:45, h:55,  score:8,  label:'Barrel!' },
  { type:'man',      emoji:'🧍', w:40, h:80,  score:15, label:'Watch it!' },
  { type:'rug',      emoji:'🪞', w:80, h:30,  score:30, label:'RUG PULL!' },
  { type:'gap',      emoji:'',   w:80, h:0,   score:5,  label:''          },
  { type:'box',      emoji:'📦', w:55, h:55,  score:8,  label:'Box!' },
  { type:'sign',     emoji:'🪧', w:40, h:70,  score:10, label:'Sign!' },
  { type:'debris',   emoji:'💥', w:50, h:50,  score:22, label:'Debris!' },
];

// ─── Environments ───
const ENVIRONMENTS = [
  { id:'miami',  name:'Miami Beach',  sky:'#ff7043,#ff8c42,#ffb347', road:'#444', accent:'#ff6b35' },
  { id:'tokyo',  name:'Tokyo Cyber',  sky:'#1a1a2e,#16213e,#0f3460', road:'#333', accent:'#00d4ff' },
  { id:'yacht',  name:'Yacht Island', sky:'#0077b6,#0096c7,#48cae4', road:'#8b7355', accent:'#48cae4' },
  { id:'space',  name:'Space',        sky:'#000005,#0d0d14,#1a0533', road:'#1a1a2e', accent:'#a78bfa' },
];

// ─── Popup messages ───
const POPUPS = [
  '🐓 Elon Chicken!','🚀 To The Moon!','💰 $ECHICK!',
  '🔥 On Fire!','⚡ Speed Run!','👑 King Chicken!',
  '💎 Diamond Hands!','🌕 Moon Soon!','🎯 Combo!',
  '🤑 Bag Secured!','🦅 Free Range!','🌪️ Unstoppable!',
];

// ─── Anti-cheat constants ───
const ANTICHEAT = {
  maxCoinsPerSecond: 8,
  maxScorePerSecond: 200,
  maxDistancePerSecond: 20,
  sessionTimeout: 30 * 60 * 1000, // 30 min
};

window.ECHICK_CONFIG = { SUPABASE_URL, SUPABASE_ANON, PROJECT, CHARACTERS, EGGS, POWERUPS, OBSTACLES, ENVIRONMENTS, POPUPS, ANTICHEAT };
