'use strict';
const cloneData=x=>JSON.parse(JSON.stringify(x));
const DEFAULT_LINES=cloneData(ECON_LINES),DEFAULT_ASSETS=cloneData(ASSET_FIELDS),DEFAULT_DEBTS=cloneData(DEBT_FIELDS);
const DEFAULT_BASE_CATEGORIES=cloneData(BASE_CATS),DEFAULT_INCOME_CATEGORIES=cloneData(INCOME_CATS),DEFAULT_INV_CATEGORY=cloneData(INV);
const DEFAULT_GROUPS=[{id:'income',name:'Entrate',role:'income'},{id:'fixed',name:'Spese fisse necessarie',role:'fixed'},{id:'necessary',name:'Spese variabili necessarie',role:'necessary'},{id:'saving',name:'Accantonamenti',role:'saving'},{id:'discretionary',name:'Spese discrezionali',role:'discretionary'}];
const ROLES={income:'Entrate (+)',fixed:'Spese fisse necessarie (−)',necessary:'Spese variabili necessarie (−)',saving:'Trasferimenti agli investimenti (− dal bilancio)',discretionary:'Spese discrezionali (−)'};
const roleKind=r=>r==='income'?'in':r==='saving'?'inv':'out';
function defaultLayout(o){return {title:'Spese',subtitle:'Bilancio mensile',tagline:'',planLabel:'Piano',actualLabel:'Registrato',residualLabel:'Reddito residuo',finalLabel:'Risultato finale',netLabel:'Patrimonio netto',hideZero:false,groups:cloneData(DEFAULT_GROUPS),lines:cloneData(DEFAULT_LINES).map(x=>({...x,semantic:x.id==='mortgage'?'loan':''})),categories:[...cloneData(DEFAULT_BASE_CATEGORIES),...cloneData(o.customCats||[])].map(x=>({...x,kind:'out'})).concat(cloneData(DEFAULT_INCOME_CATEGORIES).map(x=>({...x,kind:'in'})),[{...cloneData(DEFAULT_INV_CATEGORY),kind:'inv'}]),assets:DEFAULT_ASSETS.map(([id,name])=>({id,name,depreciable:id==='car'})),debts:DEFAULT_DEBTS.map(([id,name])=>({id,name})),goals:[{id:'current',name:'Liquidità corrente',asset:'liquidity',months:4},{id:'emergency',name:'Fondo emergenze',asset:'emergency',months:12}]}}
function ensureLayout(o){if(!o.layout)o.layout=defaultLayout(o);return o}
function applyLayout(o){const c=o.layout;ECON_LINES.splice(0,ECON_LINES.length,...cloneData(c.lines));ASSET_FIELDS.splice(0,ASSET_FIELDS.length,...c.assets.map(x=>[x.id,x.name]));DEBT_FIELDS.splice(0,DEBT_FIELDS.length,...c.debts.map(x=>[x.id,x.name]));}
function groupRole(id){return db.layout.groups.find(g=>g.id===id)?.role||'necessary'}
function groupOrder(c){const phases=['income','fixed','necessary','saving','discretionary'];return phases.flatMap(role=>c.groups.filter(g=>g.role===role))}
function classifyBeforeLayout(o){[...o.tx,...o.fixed].forEach(x=>{if(!x.budgetLine)x.budgetLine=economicLine(x)})}
ensureLayout(db);classifyBeforeLayout(db);applyLayout(db);
const inferLegacyLine=economicLine;
economicLine=function(x){const exact=ECON_LINES.find(l=>l.id===x.budgetLine&&l.kind===x.kind);if(exact)return exact.id;const guess=inferLegacyLine(x);return ECON_LINES.some(l=>l.id===guess&&l.kind===x.kind)?guess:ECON_LINES.find(l=>l.kind===x.kind)?.id};
budgetTotals=function(values){const r={income:0,fixed:0,necessary:0,saving:0,discretionary:0};ECON_LINES.forEach(l=>{const role=groupRole(l.group);r[role]+=Number(values[l.id])||0});Object.keys(r).forEach(k=>r[k]=roundMoney(r[k]));r.essential=roundMoney(r.fixed+r.necessary);r.residual=roundMoney(r.income-r.essential);r.final=roundMoney(r.residual-r.saving-r.discretionary);r.beforeSaving=roundMoney(r.final+r.saving);return r};
function loanTotal(values){return roundMoney(ECON_LINES.filter(l=>l.semantic==='loan').reduce((n,l)=>n+(values[l.id]||0),0))}
function validateLayout(c){const str=(v,n)=>typeof v==='string'&&v.length<=n,id=v=>typeof v==='string'&&/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/.test(v)&&!['constructor','prototype','__proto__'].includes(v),unique=a=>new Set(a.map(x=>x.id)).size===a.length; if(!c||typeof c!=='object'||!['title','subtitle','tagline','planLabel','actualLabel','residualLabel','finalLabel','netLabel'].every(k=>str(c[k],160)))return false;
 if(!Array.isArray(c.groups)||!c.groups.length||c.groups.length>100||!unique(c.groups)||!c.groups.every(g=>id(g.id)&&str(g.name,100)&&Object.keys(ROLES).includes(g.role)))return false;
 if(!Array.isArray(c.lines)||c.lines.length>500||!unique(c.lines)||!c.lines.every(l=>id(l.id)&&str(l.name,100)&&['in','out','inv'].includes(l.kind)&&c.groups.some(g=>g.id===l.group&&roleKind(g.role)===l.kind)&&(!l.semantic||l.semantic==='loan'&&l.kind==='out')))return false;
 if(!['in','out','inv'].every(kind=>c.lines.some(l=>l.kind===kind&&!l.hidden&&!c.groups.find(g=>g.id===l.group)?.hidden)))return false;
 if(!Array.isArray(c.categories)||c.categories.length>500||!unique(c.categories)||!c.categories.every(x=>id(x.id)&&str(x.name,100)&&str(x.e,20)&&/^#[0-9a-f]{6}$/i.test(x.c)&&['in','out','inv'].includes(x.kind)))return false;
 if(!['in','out','inv'].every(kind=>c.categories.some(x=>x.kind===kind&&!x.hidden)))return false;
 for(const k of ['assets','debts'])if(!Array.isArray(c[k])||c[k].length>200||!unique(c[k])||!c[k].every(x=>id(x.id)&&str(x.name,100)))return false;
 if(new Set(c.assets.concat(c.debts).map(x=>x.id)).size!==c.assets.length+c.debts.length)return false;
 // Legacy fields overlap on 'mortgage' only across separate line/wealth namespaces; wealth ids may not shadow metadata.
 if(c.assets.concat(c.debts).some(x=>['baseExpenses','currentMonths','emergencyMonths','monthlyDepreciation','goalMonths','goalTargets'].includes(x.id)))return false;
 if(c.assets.filter(x=>x.depreciable).length>1)return false;
 if(!Array.isArray(c.goals)||c.goals.length>100||!unique(c.goals)||!c.goals.every(x=>id(x.id)&&str(x.name,100)&&c.assets.some(a=>a.id===x.asset)&&isAmount(x.months)&&x.months<=120))return false;return true;
}
const fallbackValidator=validFinanceBackup;
validFinanceBackup=function(o){
 if(!o?.layout){const oldLines=cloneData(ECON_LINES),oldAssets=cloneData(ASSET_FIELDS),oldDebts=cloneData(DEBT_FIELDS);try{ECON_LINES.splice(0,ECON_LINES.length,...DEFAULT_LINES);ASSET_FIELDS.splice(0,ASSET_FIELDS.length,...DEFAULT_ASSETS);DEBT_FIELDS.splice(0,DEBT_FIELDS.length,...DEFAULT_DEBTS);return fallbackValidator(o)}finally{ECON_LINES.splice(0,ECON_LINES.length,...oldLines);ASSET_FIELDS.splice(0,ASSET_FIELDS.length,...oldAssets);DEBT_FIELDS.splice(0,DEBT_FIELDS.length,...oldDebts)}}
 const c=o.layout;if(o.easterEgg!==undefined&&(!o.easterEgg||typeof o.easterEgg.enabled!=='boolean'||!Number.isInteger(o.easterEgg.oneIn)||o.easterEgg.oneIn<1||o.easterEgg.oneIn>1000))return false;if(!validateLayout(c)||!Array.isArray(o.tx)||!Array.isArray(o.fixed)||o.tx.length>100000||o.fixed.length>10000)return false;
 const str=(v,n)=>typeof v==='string'&&v.length<=n,validBase=x=>x&&str(x.id,100)&&['in','out','inv'].includes(x.kind)&&c.categories.some(cat=>cat.id===x.cat&&cat.kind===x.kind)&&c.lines.some(l=>l.id===x.budgetLine&&l.kind===x.kind);
 if(!o.tx.every(x=>validBase(x)&&isDay(x.date)&&isAmount(x.amount)&&str(x.note||'',1000)))return false;
 if(!o.fixed.every(x=>validBase(x)&&str(x.name,1000)&&['m','y'].includes(x.freq)&&isMonth(x.from)&&(!x.to||isMonth(x.to)&&x.to>=x.from)&&Array.isArray(x.amounts)&&x.amounts.length&&x.amounts.every(a=>isMonth(a.from)&&isAmount(a.amount))))return false;
 if(new Set(o.tx.concat(o.fixed).map(x=>x.id)).size!==o.tx.length+o.fixed.length)return false;
 for(const key of ['plans','monthMeta','wealth']){const set=o[key]||{};if(typeof set!=='object'||Array.isArray(set))return false;for(const [ym,v]of Object.entries(set)){if(!isMonth(ym)||!v||typeof v!=='object'||Array.isArray(v))return false;
 if(key==='plans'&&!Object.entries(v).every(([id,n])=>c.lines.some(l=>l.id===id)&&isAmount(n)))return false;
 if(key==='monthMeta'&&!Object.entries(v).every(([id,n])=>['principal','depreciation'].includes(id)&&isAmount(n)))return false;
 if(key==='wealth'){if(!c.assets.concat(c.debts).every(a=>isAmount(v[a.id]??0)))return false;for(const id of ['baseExpenses','monthlyDepreciation','currentMonths','emergencyMonths'])if(v[id]!==undefined&&!isAmount(v[id]))return false;for(const k of ['goalMonths','goalTargets'])if(v[k]!==undefined&&(!v[k]||typeof v[k]!=='object'||Array.isArray(v[k])||!Object.entries(v[k]).every(([id,n])=>c.goals.some(g=>g.id===id)&&isAmount(n)&&(k!=='goalMonths'||n<=120))))return false;}
 }}return true;
};
function mergeLineData(o,from,to){o.tx.concat(o.fixed).forEach(x=>{if(x.budgetLine===from)x.budgetLine=to});Object.values(o.plans||{}).forEach(v=>{if(Object.hasOwn(v,from)){v[to]=roundMoney((v[to]||0)+v[from]);delete v[from]}});o.layout.lines=o.layout.lines.filter(x=>x.id!==from)}
function mergeCategoryData(o,from,to){o.tx.concat(o.fixed).forEach(x=>{if(x.cat===from)x.cat=to});o.layout.categories=o.layout.categories.filter(x=>x.id!==from);o.customCats=(o.customCats||[]).filter(x=>x.id!==from)}
function mergeWealthData(o,from,to,type){Object.values(o.wealth||{}).forEach(v=>{if(Object.hasOwn(v,from)){v[to]=roundMoney((v[to]||0)+v[from]);delete v[from]}});o.layout.goals.forEach(g=>{if(g.asset===from)g.asset=to});o.layout[type]=o.layout[type].filter(x=>x.id!==from)}
