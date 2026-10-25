'use strict';
const ECON_LINES=[
 {id:'salary',name:'Stipendio mensile',kind:'in',group:'income'},
 {id:'other_income',name:'Altre entrate',kind:'in',group:'income'},
 {id:'mortgage',name:'Mutuo · rata intera',kind:'out',group:'fixed'},
 {id:'insurance',name:'Assicurazioni',kind:'out',group:'fixed'},
 {id:'internet',name:'Internet casa',kind:'out',group:'fixed'},
 {id:'phone',name:'Piano telefonico',kind:'out',group:'fixed'},
 {id:'other_fixed',name:'Altre spese fisse necessarie',kind:'out',group:'fixed'},
 {id:'utilities',name:'Utenze',kind:'out',group:'necessary'},
 {id:'groceries',name:'Supermercato',kind:'out',group:'necessary'},
 {id:'other_necessary',name:'Altre spese variabili necessarie',kind:'out',group:'necessary'},
 {id:'pac',name:'PAC / versamenti agli investimenti',kind:'inv',group:'saving'},
 {id:'subscriptions',name:'Abbonamenti discrezionali',kind:'out',group:'discretionary'},
 {id:'goods',name:'Beni e acquisti discrezionali',kind:'out',group:'discretionary'},
 {id:'outings',name:'Uscite, viaggi e svago',kind:'out',group:'discretionary'}];
const roundMoney=n=>Math.round((n+Number.EPSILON)*100)/100;
function economicLine(x){
 const explicit=ECON_LINES.find(l=>l.id===x.budgetLine&&l.kind===x.kind);if(explicit)return explicit.id;
 if(x.kind==='in')return x.cat==='stipendio'?'salary':'other_income';if(x.kind==='inv')return 'pac';
 const name=String(x.name||x.note||'').toLowerCase();
 if(/mutuo/.test(name))return 'mortgage';
 if(x.cat==='assicurazioni'||/assicura/.test(name))return 'insurance';
 if(/internet|fibra|adsl/.test(name))return 'internet';
 if(/telefon|cellular|sim\b/.test(name))return 'phone';
 if(x.cat==='bollette')return 'utilities';if(x.cat==='spesa')return 'groceries';
 if(x.cat==='abbonamenti')return 'subscriptions';
 if(['ristoranti','svago','viaggi'].includes(x.cat))return 'outings';
 if(['abbigliamento','regali'].includes(x.cat))return 'goods';
 return x.src==='fx'||x.freq?'other_fixed':'other_necessary';
}
function budgetTotals(values){
 const r={income:0,fixed:0,necessary:0,saving:0,discretionary:0};
 ECON_LINES.forEach(l=>r[l.group]+=Number(values[l.id])||0);
 Object.keys(r).forEach(k=>r[k]=roundMoney(r[k]));
 r.essential=roundMoney(r.fixed+r.necessary);r.residual=roundMoney(r.income-r.essential);
 r.final=roundMoney(r.residual-r.saving-r.discretionary);
 r.beforeSaving=roundMoney(r.final+r.saving);return r;
}
function economicValues(items){const vals=Object.fromEntries(ECON_LINES.map(l=>[l.id,0]));items.forEach(x=>{const id=economicLine(x);vals[id]+=Math.round(x.amount*100)});Object.keys(vals).forEach(k=>vals[k]=vals[k]/100);return vals}
const ASSET_FIELDS=[['liquidity','Liquidità per spese correnti'],['emergency','Fondo emergenze'],['investments','Investimenti (valore attuale)'],['car','Auto (valore attuale stimato)'],['house','Casa (valore stimato)'],['otherAssets','Altre attività']];
const DEBT_FIELDS=[['mortgage','Capitale residuo del mutuo'],['otherDebt','Altri debiti residui']];
function netWorth(s){const assets=roundMoney(ASSET_FIELDS.reduce((a,[k])=>a+(Number(s[k])||0),0));const debts=roundMoney(DEBT_FIELDS.reduce((a,[k])=>a+(Number(s[k])||0),0));return {assets,debts,net:roundMoney(assets-debts)}}
function monthDistance(a,b){const p=a.split('-').map(Number),q=b.split('-').map(Number);return(q[0]-p[0])*12+q[1]-p[1]}
function expectedWealthChange(result,principal,depreciation){return roundMoney(result.final+result.saving+principal-depreciation)}
function isMonth(v){return typeof v==='string'&&/^\d{4}-(0[1-9]|1[0-2])$/.test(v)}
function isAmount(v){return typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1e12}
function isDay(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(v+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===v}
function validFinanceBackup(o){
 if(!o||!Array.isArray(o.tx)||!Array.isArray(o.fixed)||o.tx.length>100000||o.fixed.length>10000)return false;
 const str=(v,n)=>typeof v==='string'&&v.length<=n;
 const base=x=>x&&str(x.id,100)&&['in','out','inv'].includes(x.kind)&&str(x.cat,100)&&(x.budgetLine===undefined||ECON_LINES.some(l=>l.id===x.budgetLine&&l.kind===x.kind));
 if(!o.tx.every(x=>base(x)&&isDay(x.date)&&isAmount(x.amount)&&str(x.note||'',1000)))return false;
 if(!o.fixed.every(x=>base(x)&&str(x.name,1000)&&['m','y'].includes(x.freq)&&isMonth(x.from)&&(!x.to||isMonth(x.to)&&x.to>=x.from)&&Array.isArray(x.amounts)&&x.amounts.length>0&&x.amounts.every(a=>a&&isMonth(a.from)&&isAmount(a.amount))))return false;
 if(new Set(o.tx.map(x=>x.id)).size!==o.tx.length||new Set(o.fixed.map(x=>x.id)).size!==o.fixed.length)return false;
 if(o.customCats!==undefined&&(!Array.isArray(o.customCats)||!o.customCats.every(c=>c&&str(c.id,100)&&str(c.name,100)&&str(c.e,20)&&/^#[0-9a-f]{6}$/i.test(c.c))))return false;
 for(const key of ['plans','monthMeta','wealth'])if(o[key]!==undefined){if(!o[key]||typeof o[key]!=='object'||Array.isArray(o[key]))return false;for(const [m,v]of Object.entries(o[key])){if(!isMonth(m)||!v||typeof v!=='object'||Array.isArray(v))return false;if(key==='plans'&&!Object.entries(v).every(([id,a])=>ECON_LINES.some(l=>l.id===id)&&isAmount(a)))return false;if(key==='monthMeta'&&!Object.entries(v).every(([id,a])=>['principal','depreciation'].includes(id)&&isAmount(a)))return false;if(key==='wealth'&&!ASSET_FIELDS.concat(DEBT_FIELDS).every(([id])=>isAmount(v[id])) )return false;if(key==='wealth'&&!['monthlyDepreciation','baseExpenses','currentMonths','emergencyMonths'].every(id=>v[id]===undefined||isAmount(v[id])))return false;}}
 return true;
}
