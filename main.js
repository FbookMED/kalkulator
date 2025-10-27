/* =========================================================
 * FbookMED POS - main.js (PART 1/2)
 * Yadro: helperlar, storage, ombor, savat, kassa bilan sotish,
 * moliya, hisobot bazasi, qidiruv, UI init.
 * =======================================================*/

/* ---------- Helper va util ---------- */
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const openModal  = (id) => { const m = document.getElementById(id); if(!m) return; m.style.display='flex'; m.classList.add('show'); };
const closeModal = (id) => { const m = document.getElementById(id); if(!m) return; m.style.display='none'; m.classList.remove('show'); };
$$('[data-close]').forEach(b => b.addEventListener('click', () => closeModal(b.dataset.close)));

const todayStr = (d=new Date()) => d.toISOString().slice(0,10);
const fmt = (n) => (Number(n)||0).toLocaleString('uz-UZ');

/* ---------- Storage kalitlari ---------- */
const STORE = {
  INV:'pos_inv_v2',
  REGS:'pos_regs_v2',
  SALES:'pos_sales_v2',
  FIN:'pos_fin_v2',
  RAW_STDS:'pos_raw_stds_v2',
  RAW_INV:'pos_raw_inv_v2',
  RCPT:'pos_rcpt_cfg_v2',
  PRINT_PRICE:'pos_print_price_v2',
  ORDER_BOARD:'pos_order_board_v2',
  SEQ_SALE:'pos_seq_sale_v2',
  SEQ_BOARD:'pos_seq_board_v2'
};

const jget = (k, fb) => { try{ const v=localStorage.getItem(k); return v?JSON.parse(v):fb; }catch{ return fb; } };
const jset = (k, v) => { try{ localStorage.setItem(k, JSON.stringify(v)); }catch{} };

/* ---------- Ma’lumotlar (initial) ---------- */
let INV = jget(STORE.INV, [
  {sku:'K1001', name:'Anatomiya A5 qattiq muqova', price:50000, stock:12},
  {sku:'K1002', name:'Farmakologiya B5 yumshoq',   price:75000, stock:5},
  {sku:'R2001', name:'A4 oq-qora 100 varaq',       price:12000, stock:40},
  {sku:'A3001', name:'Spiral A5 (100 dona)',       price:90000, stock:3},
]);

let REGISTERS = jget(STORE.REGS, [
  {id:'cash', name:'Naqd',   type:'Naqd',   balance:0},
  {id:'uz',   name:'Uzcard', type:'Uzcard', balance:0},
  {id:'humo', name:'Humo',   type:'Humo',   balance:0},
  {id:'visa', name:'Visa',   type:'Visa',   balance:0},
]);

let SALES_LOG = jget(STORE.SALES, []);   // {date, orderNo, items:[{name,qty,price}]}
let FIN_LOG   = jget(STORE.FIN,   []);   // {date, orderNo, registerId, amount, kind}
let RAW_STDS  = jget(STORE.RAW_STDS, []); // Part-2 da ishlatiladi
let RAW_INV   = jget(STORE.RAW_INV,  []); // Part-2 da ishlatiladi

let PRINT_PRICE = jget(STORE.PRINT_PRICE, [
  {min:1,   max:100,   color:2000, mono:1000},
  {min:101, max:500,   color:1800, mono:900},
  {min:501, max:99999, color:1500, mono:700},
]);

let ORDER_BOARD = jget(STORE.ORDER_BOARD, []); // Part-2 (status board)
let SEQ_SALE  = Number(localStorage.getItem(STORE.SEQ_SALE)  || '1');
let SEQ_BOARD = Number(localStorage.getItem(STORE.SEQ_BOARD) || '1');

/* ---------- Saqlash ---------- */
function saveAll(){
  jset(STORE.INV, INV);
  jset(STORE.REGS, REGISTERS);
  jset(STORE.SALES, SALES_LOG);
  jset(STORE.FIN, FIN_LOG);
  jset(STORE.RAW_STDS, RAW_STDS);
  jset(STORE.RAW_INV, RAW_INV);
  jset(STORE.PRINT_PRICE, PRINT_PRICE);
  jset(STORE.ORDER_BOARD, ORDER_BOARD);
  localStorage.setItem(STORE.SEQ_SALE,  String(SEQ_SALE));
  localStorage.setItem(STORE.SEQ_BOARD, String(SEQ_BOARD));
}

/* =========================================================
 *                      OMBOR / INVENTORY
 * =======================================================*/
function renderInventory(q=''){
  const s = (q||'').toLowerCase().trim();
  const rows = INV
    .filter(x => !s || x.name.toLowerCase().includes(s) || x.sku.toLowerCase().includes(s))
    .map(x => `
      <tr onclick="addToCartName('${x.name.replace(/'/g,'&#39;')}', ${x.price}, 1)">
        <td>${x.sku}</td>
        <td>${x.name}</td>
        <td>${fmt(x.price)}</td>
        <td>${fmt(x.stock)}</td>
      </tr>
    `).join('');
  const tb = $('#invBody');
  if (tb) tb.innerHTML = rows || `<tr><td colspan="4" style="text-align:center;color:#78909c">Ombor bo‘sh</td></tr>`;
}
$('#btnSearch')?.addEventListener('click', () => renderInventory($('#q').value));
$('#q')?.addEventListener('input', (e)=>renderInventory(e.target.value));

/* Quick stock in (modaldagi ro‘yxat uchun) — Part-2 da bog‘lanadi */
function renderStockList(){
  const tb = $('#stockListBody'); if(!tb) return;
  tb.innerHTML = INV.map(x=>`
    <tr>
      <td>${x.sku}</td>
      <td>${x.name}</td>
      <td>${fmt(x.price)}</td>
      <td>${fmt(x.stock)}</td>
      <td>
        <input id="qi_${x.sku}" type="number" value="1" min="1" style="width:90px">
        <button class="btn s" onclick="quickStockIn('${x.sku}')">+ Kirim</button>
      </td>
    </tr>
  `).join('');
}
window.quickStockIn = (sku)=>{
  const inp = $(`#qi_${sku}`); if(!inp) return;
  const n = Math.max(1, Number(inp.value||0));
  const i = INV.findIndex(x=>x.sku===sku);
  if(i>-1){
    INV[i].stock += n;
    inp.value = '1';
    renderStockList();
    renderInventory($('#q')?.value||'');
    saveAll();
  }
};

/* Omborga yangi tovar kiritish (modal mStock -> Kirim tab) — Part-2 da UI bog‘lanadi */
$('#btnStock')?.addEventListener('click', ()=>{ openModal('mStock'); showStockTab('kirim'); });
$('#btnStockClear')?.addEventListener('click', ()=>{
  $('#st_sku').value=''; $('#st_name').value=''; $('#st_price').value=''; $('#st_qty').value='1';
});
$('#btnStockIn')?.addEventListener('click', ()=>{
  const sku=($('#st_sku').value||'').trim();
  const name=($('#st_name').value||'').trim();
  const price=Number($('#st_price').value||0);
  const qty=Math.max(1, Number($('#st_qty').value||0));
  if(!sku || !name || price<=0){ alert('Ma’lumotni to‘g‘ri kiriting'); return; }
  const i=INV.findIndex(x=>x.sku.toLowerCase()===sku.toLowerCase());
  if(i>-1){ INV[i].stock+=qty; INV[i].name=name; INV[i].price=price; }
  else { INV.push({sku,name,price,stock:qty}); }
  renderInventory($('#q')?.value||''); renderStockList();
  $('#stockMsg').textContent='Kirim saqlandi ✅';
  saveAll();
});

/* Stock modal tab switching (kirim/list/raw) — raw Part-2 da to‘liq */
function showStockTab(which){
  $('#tabKirim')?.classList.toggle('active', which==='kirim');
  $('#tabList') ?.classList.toggle('active', which==='list');
  $('#tabRaw')  ?.classList.toggle('active', which==='raw');
  $('#stockKirim').style.display = which==='kirim'?'block':'none';
  $('#stockList') .style.display = which==='list' ?'block':'none';
  $('#stockRaw')  .style.display = which==='raw'  ?'block':'none';
  if(which==='list') renderStockList();
  if(which==='raw')  { /* Part-2: xomashyo bilan to‘ldiriladi */ }
}
$$('[data-stocktab]').forEach(b=>b.addEventListener('click',()=>showStockTab(b.dataset.stocktab)));

/* =========================================================
 *                         SAVAT / CART
 * =======================================================*/
const CART = new Map(); // id -> {id,name,price,qty,disc,raw_usage?}

function addToCartName(name, price, qty){
  const id = 'I'+Date.now().toString(36)+Math.floor(Math.random()*1e5);
  CART.set(id, {id, name, price, qty, disc:0});
  renderCart();
}
window.addToCartName = addToCartName;

function chgQty(id, d){
  const it = CART.get(id); if(!it) return;
  it.qty = Math.max(0, (it.qty||0) + d);
  if(!it.qty) CART.delete(id);
  renderCart();
}
window.chgQty = chgQty;

function chgDisc(id,v){
  const it = CART.get(id); if(!it) return;
  it.disc = Math.max(0, Number(v)||0);
  renderCart();
}
window.chgDisc = chgDisc;

function cartTotal(){
  let total=0;
  CART.forEach(it=>{
    const sum = it.price*it.qty - Number(it.disc||0);
    total += Math.max(0,sum);
  });
  return total;
}

function renderCart(){
  let i=1,total=0;
  const rows = [...CART.values()].map(it=>{
    const sum = it.price*it.qty - Number(it.disc||0);
    total += Math.max(0,sum);
    return `
      <tr>
        <td>${i++}</td>
        <td>${it.name}</td>
        <td>${fmt(it.price)}</td>
        <td>
          <button class="btn s" style="padding:4px 8px" onclick="chgQty('${it.id}',-1)">−</button>
          <span style="display:inline-block;min-width:28px;text-align:center">${it.qty}</span>
          <button class="btn" style="padding:4px 8px" onclick="chgQty('${it.id}',1)">+</button>
        </td>
        <td><input type="number" min="0" value="${Number(it.disc||0)}"
          oninput="chgDisc('${it.id}',this.value)"
          style="width:90px;padding:6px;border:1px solid #cfd8dc;border-radius:8px"></td>
        <td>${fmt(Math.max(0,sum))}</td>
      </tr>
    `;
  }).join('');

  const body = $('#cartBody');
  if(body){
    body.innerHTML = rows || `<tr><td colspan="6" style="text-align:center;color:#78909c;padding:20px">🛒 Savat bo‘sh</td></tr>`;
  }
  const totalEl = $('#totalSum');
  if(totalEl) totalEl.innerText = fmt(total);
}
$('#btnCartClear')?.addEventListener('click', ()=>{ CART.clear(); renderCart(); });

/* =========================================================
 *                      MOLIYA / REGISTERS
 * =======================================================*/
$('#btnFinance')?.addEventListener('click', ()=>{ openModal('mFinance'); renderFinance(); });

function renderFinance(){
  const tb = $('#finList'); if(!tb) return;
  tb.innerHTML = REGISTERS.map((r,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${r.name}</td>
      <td>${r.type}</td>
      <td>${fmt(r.balance)}</td>
    </tr>
  `).join('');
}
$('#btnAddRegister')?.addEventListener('click', ()=>{
  const name = ($('#fin_name').value||'').trim();
  const type = $('#fin_type').value;
  const bal  = Math.max(0, Number($('#fin_balance').value||0));
  if(!name){ alert('Kassa nomini kiriting'); return; }
  REGISTERS.push({id:'reg_'+Date.now().toString(36), name, type, balance:bal});
  $('#fin_name').value=''; $('#fin_balance').value='0';
  renderFinance(); saveAll();
});

/* =========================================================
 *             SOTISH → KASSA TANLASH (MODAL)
 * =======================================================*/
$('#btnSell')?.addEventListener('click', openSellRegisterModal);

function openSellRegisterModal(){
  if(!CART.size){ alert('Chek bo‘sh'); return; }
  document.getElementById('mSellReg')?.remove();

  const regOpts = REGISTERS.map(r=>`<option value="${r.id}">${r.name} (${r.type})</option>`).join('');
  const total = fmt(cartTotal());

  const div = document.createElement('div');
  div.className = 'modal';
  div.id = 'mSellReg';
  div.innerHTML = `
    <div class="box">
      <div class="head">
        <h3>Sotishni yakunlash</h3>
        <button class="x" onclick="closeModal('mSellReg')">Yopish</button>
      </div>
      <div class="body">
        <p style="font-weight:700">Chek jami: <span style="color:#0d47a1">${total}</span> so‘m</p>
        <div class="grid">
          <div>
            <label>Qaysi kassaga tushdi?</label>
            <select id="sell_register" class="sel">${regOpts}</select>
          </div>
        </div>
        <div class="row-actions" style="margin-top:12px">
          <button class="btn" id="btnConfirmSell">✅ Tasdiqlash</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(div);
  openModal('mSellReg');

  $('#btnConfirmSell').onclick = ()=>{
    const regId = $('#sell_register').value;
    if(!regId){ alert('Kassani tanlang'); return; }
    finalizeSaleWithRegister(regId);
  };
}

function finalizeSaleWithRegister(regId){
  if(!CART.size){ alert('Chek bo‘sh'); return; }

  /* 1) Tayyor tovar zaxirasi tekshiruvi */
  const insuff = [];
  CART.forEach(it=>{
    const i = INV.findIndex(x=>x.name===it.name);
    if(i>-1 && (INV[i].stock||0) < (it.qty||0)){
      insuff.push(`${it.name}: mavjud ${fmt(INV[i].stock)}`);
    }
  });
  if(insuff.length){ alert('Zaxira yetmaydi:\n- '+insuff.join('\n- ')); return; }

  /* 2) Xomashyo yetarlilik (agar bor bo‘lsa) — Part-2 da xomashyo bilan band bo‘ladi.
        Bu qism Part-2 da haqiqiy tekshiruv va chiqimga ega bo‘ladi. */

  /* 3) Tayyor tovar zaxirasidan ayirish */
  CART.forEach(it=>{
    const i = INV.findIndex(x=>x.name===it.name);
    if(i>-1) INV[i].stock -= it.qty;
  });

  /* 4) Xomashyo chiqimi (Part-2 da) */

  /* 5) Savdo logi + kassaga tushum */
  const items = [...CART.values()].map(x=>({name:x.name, qty:x.qty, price:x.price, disc: x.disc||0}));
  const orderNo = SEQ_SALE++;
  SALES_LOG.push({date:todayStr(), orderNo, items});

  const totalAmount = cartTotal();
  const reg = REGISTERS.find(r=>r.id===regId);
  if(reg){ reg.balance += totalAmount; }
  FIN_LOG.push({date:todayStr(), orderNo, registerId: regId, amount: totalAmount, kind: 'sale'});

  CART.clear();
  renderCart();
  renderInventory($('#q')?.value||'');
  renderFinance();
  closeModal('mSellReg');
  alert('Sotildi ✅');
  saveAll();
}

/* =========================================================
 *                        HISOBOT (bazasi)
 *   (To‘liq filtr/grafik/CSV – Part-2 da yakunlanadi)
 * =======================================================*/
$('#btnReport')?.addEventListener('click', ()=>{
  openModal('mReport');
  fillReportRegisters();
  refreshReport();
});

function fillReportRegisters(){
  const sel = $('#repRegister'); if(!sel) return;
  const cur = sel.value;
  sel.innerHTML = ['<option value="">(hammasi)</option>']
    .concat(REGISTERS.map(r=>`<option value="${r.id}">${r.name}</option>`))
    .join('');
  if(cur) sel.value = cur;
}
let FILTER_FROM=null, FILTER_TO=null, FILTER_REG='', FILTER_PROD='';

$('#btnApply')?.addEventListener('click', ()=>{
  FILTER_FROM = $('#dateFrom').value || null;
  FILTER_TO   = $('#dateTo').value   || null;
  FILTER_REG  = $('#repRegister').value || '';
  FILTER_PROD = ($('#repProduct').value||'').trim().toLowerCase();
  refreshReport();
});
$('#btnReset')?.addEventListener('click', ()=>{
  $('#dateFrom').value=''; $('#dateTo').value='';
  $('#repRegister').value=''; $('#repProduct').value='';
  FILTER_FROM=null; FILTER_TO=null; FILTER_REG=''; FILTER_PROD='';
  refreshReport();
});

function inRange(d){
  if(FILTER_FROM && d<FILTER_FROM) return false;
  if(FILTER_TO   && d>FILTER_TO)   return false;
  return true;
}
function salesFiltered(){
  let base = SALES_LOG.filter(s=>inRange(s.date));
  if(FILTER_REG){
    const byReg = new Set(FIN_LOG.filter(f=>f.registerId===FILTER_REG).map(f=>f.orderNo));
    base = base.filter(s=>byReg.has(s.orderNo));
  }
  if(FILTER_PROD){
    base = base.filter(s=>s.items.some(i=>i.name.toLowerCase().includes(FILTER_PROD)));
  }
  return base;
}
const sumOrder = (items)=>items.reduce((t,i)=>t + i.price*i.qty - (i.disc||0), 0);
const totalQty = (items)=>items.reduce((t,i)=>t + i.qty, 0);

function renderChecksTable(){
  const tb = $('#checksBody'); if(!tb) return;
  const rows = salesFiltered()
    .sort((a,b)=>a.date.localeCompare(b.date))
    .map(s=>{
      const names=[...new Set(s.items.map(i=>i.name))].join(', ');
      return `<tr>
        <td>${s.date}</td>
        <td>${s.orderNo}</td>
        <td>${names}</td>
        <td>${fmt(sumOrder(s.items))}</td>
        <td>${fmt(totalQty(s.items))}</td>
      </tr>`;
    }).join('');
  tb.innerHTML = rows || `<tr><td colspan="5" style="text-align:center;color:#78909c">Ma’lumot yo‘q</td></tr>`;
}

/* Grafik va KPI — Part-2 da to‘liq */
function refreshReport(){
  renderChecksTable();
  $('#kpiRange') && ($('#kpiRange').innerText = fmt(salesFiltered().reduce((t,s)=>t+sumOrder(s.items),0)));
  $('#kpiOrders')&& ($('#kpiOrders').innerText = salesFiltered().length.toString());
  const ym = new Date().toISOString().slice(0,7);
  const monthSum = SALES_LOG.filter(s=>s.date.startsWith(ym)).reduce((t,s)=>t+sumOrder(s.items),0);
  $('#kpiMonth') && ($('#kpiMonth').innerText = fmt(monthSum));
  // Charts -> Part-2 (Chart.js bilan)
}

/* CSV eksport — Part-2 da to‘liq */
$('#btnCSV')?.addEventListener('click', exportCSV);
function exportCSV(){
  const header=['sana','chek_no','mahsulotlar','jami_summa','umumiy_soni'];
  const lines=[header.join(',')];
  salesFiltered().forEach(s=>{
    const names=[...new Set(s.items.map(i=>i.name))].join(' ');
    lines.push([s.date, s.orderNo, `"${names.replace(/"/g,'""')}"`, sumOrder(s.items), totalQty(s.items)].join(','));
  });
  const blob=new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=`hisobot_${(FILTER_FROM||'all')}_${(FILTER_TO||'all')}.csv`;
  document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
}

/* =========================================================
 *            ⋯ menyu (Narxlar/Parametr/...) – kirish
 * =======================================================*/
(function initMoreMenu(){
  const btnMore=$('#btnMore'), moreMenu=$('#moreMenu'); if(!btnMore||!moreMenu) return;
  btnMore.addEventListener('click',e=>{
    e.stopPropagation();
    const show = moreMenu.hasAttribute('hidden');
    $$('.dropdown').forEach(d=>d.setAttribute('hidden',''));
    if(show) moreMenu.removeAttribute('hidden'); else moreMenu.setAttribute('hidden','');
  });
  document.addEventListener('click', ()=>moreMenu.setAttribute('hidden',''));

  // Oynalarni ochish
  const bind=(btn,modal,after)=>{
    const b=document.getElementById(btn);
    if(b) b.addEventListener('click', e=>{
      e.stopPropagation(); moreMenu.setAttribute('hidden',''); openModal(modal); if(after) after();
    });
  };
  bind('btnPriceStd','mPrice', ()=>{/* Part-2: renderPrintPriceTable() */});
  bind('btnParam','mParam');
  bind('btnRawStd','mRawStd', ()=>{/* Part-2: renderRawStdTable() va boshqalar */});
  bind('btnRcptCfg','mRcptCfg', ()=>{/* Part-2: rcpt config formini to‘ldirish */});
})();

/* =========================================================
 *               Mobil sidebar toggler (☰)
 * =======================================================*/
(function sidebarToggle(){
  const sidebar = document.querySelector('.sidebar');
  const btn = document.getElementById('btnSidebar');
  const scrim = document.getElementById('scrim');
  if(!sidebar || !btn || !scrim) return;

  const close = ()=>{ sidebar.classList.remove('open'); scrim.setAttribute('hidden',''); };
  const open  = ()=>{ sidebar.classList.add('open'); scrim.removeAttribute('hidden'); };

  btn.addEventListener('click', ()=>{ if(sidebar.classList.contains('open')) close(); else open(); });
  scrim.addEventListener('click', close);
  window.addEventListener('resize', ()=>{ if(window.innerWidth > 900){ close(); } });
})();

/* =========================================================
 *                         INIT
 * =======================================================*/
window.addEventListener('DOMContentLoaded', ()=>{
  renderInventory('');
  renderCart();
  // moliya ro‘yxati hisobot modalida ham ishlatiladi
  const repSel=$('#repRegister');
  if(repSel){
    repSel.innerHTML = ['<option value="">(hammasi)</option>']
      .concat(REGISTERS.map(r=>`<option value="${r.id}">${r.name}</option>`))
      .join('');
  }
  window.addEventListener('beforeunload', saveAll);
});

/* ===== PART 1 tugadi — PART 2 da:
   - Buyurtma holati doskasi (statuslar, izoh)
   - Raspechatka (narx oraliqlari, qatorlar, savatga qo‘shish)
   - Kitob buyurtmasi (tarif/format/muqova/rang)
   - Xomashyo standartlari + kirim va FIFO chiqim
   - Chek: sozlamalar, modal, print/rasm/nusxa
   - Chart.js grafiklari (kunlik va top mahsulotlar)
===========================================================*/
/* =========================================================
 * FbookMED POS - main.js (PART 2/2)
 * Modullar: Buyurtma holati, Raspechatka, Kitob buyurtmasi,
 * Xomashyo (standart+kirim), Chek (print/rasm/nusxa/sozlamalar),
 * Kalkulyator, Chart.js grafiklari, qolgan bog‘lanishlar.
 * =======================================================*/

/* ===================== BUYURTMA HOLATI (BOARD) ===================== */
const STATUS_KEYS = ['buyurtma','chiqazildi','muqovalashda','tayyor','yetkazishda','olib_ketildi','bekor_qilindi'];
let CURRENT_STATUS='buyurtma';

$('#btnStatus')?.addEventListener('click', ()=>{ openModal('mStatus'); renderStatus(); });
$('#statusTabs')?.addEventListener('click', (e)=>{
  if(!e.target.matches('.st-btn')) return;
  $$('#statusTabs .st-btn').forEach(b=>b.classList.remove('active'));
  e.target.classList.add('active');
  CURRENT_STATUS=e.target.dataset.st;
  renderStatus();
});

function renderStatus(){
  const wrap = $('#statusList'); if(!wrap) return;
  const list = ORDER_BOARD.filter(o=>o.status===CURRENT_STATUS);
  if(!list.length){ wrap.innerHTML='<div class="small" style="text-align:center;color:#78909c">Hozircha buyurtma yo‘q</div>'; return; }
  wrap.innerHTML = list.map(o=>{
    const cnt=o.items.reduce((s,x)=>s+x.qty,0), itemsTxt=o.items.map(x=>`${x.name} (${x.qty}x)`).join(', ')||'—';
    const idx=STATUS_KEYS.indexOf(o.status); const next=STATUS_KEYS[Math.min(idx+1,STATUS_KEYS.length-1)]; const prev=STATUS_KEYS[Math.max(idx-1,0)];
    return `<div class="card">
      <h4>#${o.id} — ${o.title} <span class="badge">${o.status}</span></h4>
      <div class="small">Buyurtma: ${o.orderNo} · Sana: ${o.createdAt.slice(0,10)} · Soni: ${cnt} · Jami: ${fmt(o.total)} so‘m</div>
      <div class="small">Avans: ${fmt(o.prepay||0)} so‘m ${o.prepayRegister?('· '+o.prepayRegister):''}</div>
      <div style="margin-top:6px">${itemsTxt}</div>
      <div class="note">
        <input class="inp" id="note_${o.id}" value="${(o.note||'').replace(/"/g,'&quot;')}" placeholder="Izoh...">
        <button class="btn s" onclick="saveNote(${o.id})">Izohni saqlash</button>
      </div>
      <div class="row-actions">
        <button class="btn s" onclick="moveStatus(${o.id},'${prev}')">⟵ Oldinga</button>
        <button class="btn" onclick="moveStatus(${o.id},'${next}')">Keyingi ⟶</button>
        <select class="sel" onchange="moveStatus(${o.id}, this.value)">${STATUS_KEYS.map(k=>`<option value="${k}" ${k===o.status?'selected':''}>${k}</option>`).join('')}</select>
        <button class="btn" onclick="deleteOrder(${o.id})">O‘chirish</button>
      </div></div>`;
  }).join('');
}
window.saveNote=(id)=>{ const i=ORDER_BOARD.findIndex(o=>o.id===id); if(i<0)return; ORDER_BOARD[i].note=$(`#note_${id}`).value||''; saveAll(); alert('Izoh saqlandi ✅'); };
window.moveStatus=(id,st)=>{ const i=ORDER_BOARD.findIndex(o=>o.id===id); if(i<0)return; ORDER_BOARD[i].status=st; saveAll(); renderStatus(); };
window.deleteOrder=(id)=>{ const i=ORDER_BOARD.findIndex(o=>o.id===id); if(i<0)return; if(confirm('O‘chirish?')){ ORDER_BOARD.splice(i,1); saveAll(); renderStatus(); } };

/* ===================== RASPECHATKA (PRINT) ===================== */
function renderPrintPriceTable(){
  const tb = $('#pricePrintBody'); if(!tb) return;
  tb.innerHTML = PRINT_PRICE.map((r,i)=>`
    <tr>
      <td><input class="inp" type="number" min="1" value="${r.min}" id="pp_min_${i}"></td>
      <td><input class="inp" type="number" min="1" value="${r.max}" id="pp_max_${i}"></td>
      <td><input class="inp" type="number" min="0" value="${r.color}" id="pp_col_${i}"></td>
      <td><input class="inp" type="number" min="0" value="${r.mono}"  id="pp_mono_${i}"></td>
      <td><button class="btn s" onclick="delPrintPrice(${i})">O‘chirish</button></td>
    </tr>`).join('');
}
window.delPrintPrice=(i)=>{ PRINT_PRICE.splice(i,1); renderPrintPriceTable(); saveAll(); };
$('#btnPricePrintAdd')?.addEventListener('click',()=>{ PRINT_PRICE.push({min:1,max:1,color:0,mono:0}); renderPrintPriceTable(); saveAll(); });
$('#btnPricePrintSave')?.addEventListener('click',()=>{
  const rows=[...document.querySelectorAll('#pricePrintBody tr')];
  const next=[];
  for(let i=0;i<rows.length;i++){
    next.push({
      min:+$(`#pp_min_${i}`).value||1,
      max:+$(`#pp_max_${i}`).value||1,
      color:+$(`#pp_col_${i}`).value||0,
      mono:+$(`#pp_mono_${i}`).value||0
    });
  }
  next.sort((a,b)=>a.min-b.min);
  PRINT_PRICE=next; saveAll(); alert('Raspechatka narxlari saqlandi ✅');
});

function pricePerList(qty,isColor){
  const t=PRINT_PRICE.find(x=>qty>=x.min && qty<=x.max) || PRINT_PRICE[PRINT_PRICE.length-1];
  return isColor ? t.color : t.mono;
}
$('#btnPrint')?.addEventListener('click',()=>{ openModal('mPrint'); if(!$('#printBody').children.length) addPrintRow(); });

function rawPaperOptions(){
  return RAW_STDS.map(r=>`<option value="${r.code}">${r.type} ${r.attr} ${r.size}</option>`).join('') || '<option value="">— standart yo‘q —</option>';
}
function addPrintRow(){
  const tb=$('#printBody'); const tr=document.createElement('tr');
  tr.innerHTML=`<td><input class="inp p_name" placeholder="Masalan: Referat"></td>
    <td><input class="inp p_list" type="number" min="1" value="10"></td>
    <td><select class="sel p_color"><option>Rangli</option><option>Oq qora</option></select></td>
    <td><input class="inp p_copy" type="number" min="1" value="1"></td>
    <td><select class="sel p_mat">${rawPaperOptions()}</select></td>
    <td class="p_unit">0</td>
    <td class="p_sum">0</td>
    <td><button class="btn s" style="padding:6px 10px">O‘chirish</button></td>`;
  tb.appendChild(tr);
  tr.querySelector('.p_list').oninput =()=>calcPrintRow(tr);
  tr.querySelector('.p_color').onchange=()=>calcPrintRow(tr);
  tr.querySelector('.p_copy').oninput =()=>calcPrintRow(tr);
  tr.querySelector('.p_mat').onchange =()=>calcPrintRow(tr);
  tr.querySelector('button').onclick  =()=>tr.remove();
  calcPrintRow(tr);
}
$('#btnPrintAddRow')?.addEventListener('click',addPrintRow);
function calcPrintRow(tr){
  const list=+tr.querySelector('.p_list').value||0;
  const copies=+tr.querySelector('.p_copy').value||0;
  const isColor=(tr.querySelector('.p_color').value==='Rangli');
  const unit=pricePerList(list,isColor);
  const sum=unit*list*copies;
  tr.querySelector('.p_unit').innerText=fmt(unit);
  tr.querySelector('.p_sum').innerText =fmt(sum);
}
function addPrintToCart(){
  const rows=[...document.querySelectorAll('#printBody tr')]; if(!rows.length){alert('Qator qo‘shing');return}
  let ok=0;
  rows.forEach(tr=>{
    calcPrintRow(tr);
    const name=(tr.querySelector('.p_name').value||'Raspechatka').trim();
    const list=+tr.querySelector('.p_list').value||0;
    const copies=+tr.querySelector('.p_copy').value||0;
    const isColor=(tr.querySelector('.p_color').value==='Rangli');
    const unit=pricePerList(list,isColor);
    const qty=copies;
    const price=unit*list;
    const matCode = tr.querySelector('.p_mat').value || null;
    if(unit>0 && list>0 && copies>0){
      const id='I'+Date.now().toString(36)+Math.floor(Math.random()*1e5);
      const raw_usage = matCode ? [{code: matCode, pcs_per_unit: list}] : [];
      CART.set(id,{id, name:`${name} (${isColor?'rangli':'oq qora'}, ${list} list)`, price, qty, disc:0, raw_usage});
      ok++;
    }
  });
  if(!ok){alert('Ma’lumot to‘liq emas');return}
  renderCart();
  closeModal('mPrint');
}
$('#btnPrintAddToCart')?.addEventListener('click',addPrintToCart);

/* ===================== KITOB BUYURTMASI ===================== */
const T={
  "Standart":{"A4":{"Oq qora":170,"Rangli":220,"muqova":{"Qattiq muqovali":40000,"Yumshoq muqovali":20000,"Oddiy muqovali":5000,"Muqovasiz":0}},
              "A5":{"Oq qora":85,"Rangli":110,"muqova":{"Qattiq muqovali":30000,"Yumshoq muqovali":10000,"Oddiy muqovali":2000,"Muqovasiz":0}},
              "B5":{"Oq qora":170,"Rangli":220,"muqova":{"Qattiq muqovali":35000,"Yumshoq muqovali":20000,"Oddiy muqovali":3000,"Muqovasiz":0}}},
  "Optom":{"A4":{"Oq qora":120,"Rangli":140,"muqova":{"Qattiq muqovali":30000,"Yumshoq muqovali":15000,"Oddiy muqovali":2000,"Muqovasiz":0}},
           "A5":{"Oq qora":60,"Rangli":70,"muqova":{"Qattiq muqovali":20000,"Yumshoq muqovali":10000,"Oddiy muqovali":1000,"Muqovasiz":0}},
           "B5":{"Oq qora":120,"Rangli":140,"muqova":{"Qattiq muqovali":25000,"Yumshoq muqovali":15000,"Oddiy muqovali":2000,"Muqovasiz":0}}},
  "Maxsus":{"A4":{"Oq qora":150,"Rangli":150,"muqova":{"Qattiq muqovali":35000,"Yumshoq muqovali":20000,"Oddiy muqovali":5000,"Muqovasiz":0}},
            "A5":{"Oq qora":75,"Rangli":75,"muqova":{"Qattiq muqovali":25000,"Yumshoq muqovali":10000,"Oddiy muqovali":2000,"Muqovasiz":0}},
            "B5":{"Oq qora":150,"Rangli":150,"muqova":{"Qattiq muqovali":30000,"Yumshoq muqovali":20000,"Oddiy muqovali":3000,"Muqovasiz":0}}}
};
function pagesPerSheet(bookFormat, materialSize){
  const fmt = String(bookFormat||'').toUpperCase();
  const mat = String(materialSize||'').toUpperCase();
  if(fmt==='A4'){ if(mat==='A3') return 4; if(mat==='A4') return 2; }
  if(fmt==='A5'){ if(mat==='A4') return 4; if(mat==='A5') return 2; }
  if(fmt==='B5'){ return 2; }
  return 1;
}
const getRawStdByCode = (code)=> RAW_STDS.find(x=>x.code===code) || null;

$('#btnBookOrder')?.addEventListener('click',()=>openModal('mOrder'));
$('#btnAddRow')?.addEventListener('click',addOrderRow);
$('#btnAddToCart')?.addEventListener('click',addOrderToCart);

function addOrderRow(){
  const tb=$('#orderBody'); const tr=document.createElement('tr');
  tr.innerHTML=`<td><input class="inp name" placeholder="Kitob nomi"></td>
    <td><input class="inp page" type="number" min="1" value="200"></td>
    <td><select class="sel tarif"><option>Standart</option><option>Optom</option><option>Maxsus</option></select></td>
    <td><select class="sel fmt"><option>A4</option><option>A5</option><option>B5</option></select></td>
    <td><select class="sel cov"><option>Qattiq muqovali</option><option>Yumshoq muqovali</option><option>Oddiy muqovali</option><option>Muqovasiz</option></select></td>
    <td><select class="sel col"><option>Oq qora</option><option>Rangli</option></select></td>
    <td><select class="sel mat">${rawPaperOptions()}</select></td>
    <td class="unit">0</td>
    <td><input class="inp qty" type="number" min="1" value="1"></td>
    <td class="sum">0</td>
    <td><button class="btn s" style="padding:6px 10px">O‘chirish</button></td>`;
  tb.appendChild(tr);
  ['tarif','fmt','cov','col','mat'].forEach(c=>tr.querySelector(`.${c}`).onchange=()=>calcRow(tr));
  tr.querySelector('.page').oninput=()=>calcRow(tr);
  tr.querySelector('.qty').oninput =()=>calcRow(tr);
  tr.querySelector('button').onclick=()=>tr.remove();
  calcRow(tr);
}
function calcRow(tr){
  const p=+tr.querySelector('.page').value||0, q=+tr.querySelector('.qty').value||0;
  const t=tr.querySelector('.tarif').value, f=tr.querySelector('.fmt').value, c=tr.querySelector('.cov').value, r=tr.querySelector('.col').value;
  let unit=0; try{ unit=Math.max(0, T[t][f][r]*p + T[t][f]['muqova'][c]); }catch(e){ unit=0; }
  tr.querySelector('.unit').innerText=fmt(unit);
  tr.querySelector('.sum').innerText=fmt(unit*q);
}
function addOrderToCart(){
  const rows=[...document.querySelectorAll('#orderBody tr')]; 
  if(!rows.length){alert('Qator qo‘shing');return}
  let ok=0;
  rows.forEach(tr=>{
    calcRow(tr);
    const name =(tr.querySelector('.name').value||'Kitob buyurtmasi').trim();
    const pages=+tr.querySelector('.page').value||0;
    const fmtSel  = (tr.querySelector('.fmt').value||'').toUpperCase();
    const qty  = +tr.querySelector('.qty').value||0;
    const unit = +tr.querySelector('.unit').innerText.replace(/[^\d]/g,'')||0;
    const matCode = tr.querySelector('.mat')?.value || null;
    const matStd  = matCode ? getRawStdByCode(matCode) : null;
    const matSize = (matStd?.size || '').toUpperCase();

    if(unit>0 && qty>0){
      const pps = matStd ? pagesPerSheet(fmtSel, matSize) : 1;
      const sheetsPerBook = Math.ceil(pages / pps);
      const raw_usage = matStd ? [{ code: matStd.code, pcs_per_unit: sheetsPerBook }] : [];
      const id='I'+Date.now().toString(36)+Math.floor(Math.random()*1e5);
      CART.set(id,{id, name:`${name} (${fmtSel}, ${pages} sahifa)`, price:unit, qty, disc:0, raw_usage});
      ok++;
    }
  });
  if(!ok){alert('Ma’lumot to‘liq emas');return}
  renderCart();
  closeModal('mOrder');
}

/* ===================== XOMASHYO (STANDART + KIRIM) ===================== */
function rawCode({type,attr,size}){ return (type+'_'+attr+'_'+size).toLowerCase().replace(/\s+/g,'-'); }
function renderRawStdTable(){
  const tb = $('#rawStdBody'); if(!tb) return;
  tb.innerHTML = RAW_STDS.map(r=>`
    <tr>
      <td>${r.code}</td><td>${r.type}</td><td>${r.attr}</td><td>${r.size}</td>
      <td>${r.unit}</td><td>${r.pack_size}</td>
      <td><button class="btn s" onclick="delRawStd('${r.code}')">O‘chirish</button></td>
    </tr>`).join('') || `<tr><td colspan="7" style="text-align:center;color:#78909c">Hali standart yo‘q</td></tr>`;
  fillRawStdSelects();
}
window.delRawStd=(code)=>{ const i=RAW_STDS.findIndex(r=>r.code===code); if(i>-1){ RAW_STDS.splice(i,1); saveRawStores(); renderRawStdTable(); renderRawList(); } };
function fillRawStdSelects(){
  const sel = $('#raw_std_select');
  if(!sel) return;
  sel.innerHTML = RAW_STDS.map(r=>`<option value="${r.code}">${r.type} ${r.attr} ${r.size}</option>`).join('') || '<option value="">— standart yo‘q —</option>';
}
function renderRawList(){
  const tb = $('#rawListBody'); if(!tb) return;
  const map = new Map(); RAW_INV.forEach(x=>map.set(x.code,(map.get(x.code)||0)+(x.stock_pcs||0)));
  tb.innerHTML = RAW_STDS.map(s=>{
    const stock = map.get(s.code)||0;
    return `<tr>
      <td>${s.code}</td>
      <td>${s.type} ${s.attr} ${s.size}</td>
      <td>${s.unit}</td>
      <td>${s.pack_size}</td>
      <td>${fmt(stock)}</td>
    </tr>`;
  }).join('') || `<tr><td colspan="5" style="text-align:center;color:#78909c">Hali xomashyo yo‘q</td></tr>`;
}
function saveRawStores(){ jset(STORE.RAW_STDS, RAW_STDS); jset(STORE.RAW_INV, RAW_INV); }

$('#btnRawStd')?.addEventListener('click',()=>{ openModal('mRawStd'); renderRawStdTable(); });
$('#btnRawStdAdd')?.addEventListener('click', ()=>{
  const type=($('#rs_type').value||'').trim(), attr=($('#rs_attr').value||'').trim(), size=($('#rs_size').value||'').trim();
  const unit=$('#rs_unit').value; const pack=Math.max(1, Number($('#rs_pack').value||1));
  if(!type||!attr||!size){ alert('Tip/xususiyat/o‘lcham kiriting'); return; }
  const code = rawCode({type,attr,size});
  if(RAW_STDS.some(r=>r.code===code)){ alert('Bu standart allaqachon bor'); return; }
  RAW_STDS.push({code,type,attr,size,unit,pack_size:pack});
  saveRawStores(); renderRawStdTable();
});
$('#btnRawStdSave')?.addEventListener('click', ()=>{ saveRawStores(); alert('Xomashyo standartlari saqlandi ✅'); closeModal('mRawStd'); });

function syncRawStdFields(){
  const code=$('#raw_std_select').value;
  const s=RAW_STDS.find(x=>x.code===code);
  $('#raw_unit').value = s? s.unit : '';
  $('#raw_pack').value = s? s.pack_size : '';
}
$('#raw_std_select')?.addEventListener('change', syncRawStdFields);
$('#btnRawIn')?.addEventListener('click', ()=>{
  const code=$('#raw_std_select').value;
  const qty =Math.max(1, Number($('#raw_qty').value||0));
  const s=RAW_STDS.find(x=>x.code===code);
  if(!s){ alert('Standartni tanlang'); return; }
  let pcs=qty;
  if(s.unit==='pachka') pcs = qty * s.pack_size;
  const i=RAW_INV.findIndex(x=>x.code===code);
  if(i>-1) RAW_INV[i].stock_pcs += pcs; else RAW_INV.push({code,stock_pcs:pcs});
  saveRawStores(); $('#raw_qty').value='1'; renderRawList(); alert('Xomashyo kirim qilindi ✅');
});
$('#btnRawClear')?.addEventListener('click', ()=>$('#raw_qty').value='1');

/* ===== Sotishni (Part-1 dagi) xomashyo bilan to‘ldirish — override ===== */
function finalizeSaleWithRegister(regId){
  if(!CART.size){ alert('Chek bo‘sh'); return; }

  // 1) tayyor tovar zaxirasi tekshiruvi
  const insuff=[];
  CART.forEach(it=>{
    const i=INV.findIndex(x=>x.name===it.name);
    if(i>-1 && (INV[i].stock||0)<(it.qty||0)){ insuff.push(`${it.name}: mavjud ${fmt(INV[i].stock)}`); }
  });
  if(insuff.length){ alert('Zaxira yetmaydi:\n- '+insuff.join('\n- ')); return; }

  // 2) xomashyo yetarliligini tekshirish
  const rawNeed = new Map(); // code => kerak pcs
  CART.forEach(it=>{
    (it.raw_usage||[]).forEach(u=>{
      const need = (u.pcs_per_unit||0)*(it.qty||0);
      rawNeed.set(u.code,(rawNeed.get(u.code)||0)+need);
    });
  });
  const rawStock = new Map(); RAW_INV.forEach(r=>rawStock.set(r.code,(rawStock.get(r.code)||0)+(r.stock_pcs||0)));
  const lack=[];
  rawNeed.forEach((need,code)=>{
    const have=rawStock.get(code)||0;
    if(have<need){
      const s=RAW_STDS.find(x=>x.code===code);
      lack.push(`${s?(s.type+' '+s.attr+' '+s.size):code}: ${fmt(have)}/${fmt(need)}`);
    }
  });
  if(lack.length){ alert('Xomashyo yetmaydi:\n- '+lack.join('\n- ')); return; }

  // 3) tayyor tovar zaxirasidan ayirish
  CART.forEach(it=>{
    const i=INV.findIndex(x=>x.name===it.name);
    if(i>-1) INV[i].stock -= it.qty;
  });

  // 4) xomashyo zaxirasidan ayirish (FIFO)
  rawNeed.forEach((need,code)=>{
    let left=need;
    RAW_INV.filter(x=>x.code===code).forEach(row=>{
      if(left<=0) return;
      const take=Math.min(row.stock_pcs,left);
      row.stock_pcs -= take;
      left -= take;
    });
  });
  for(let i=RAW_INV.length-1;i>=0;i--){ if(RAW_INV[i].stock_pcs<=0) RAW_INV.splice(i,1); }
  saveRawStores(); renderRawList();

  // 5) savdo logi + kassa
  const items=[...CART.values()].map(x=>({name:x.name,qty:x.qty,price:x.price,disc:x.disc||0}));
  const orderNo = SEQ_SALE++;
  SALES_LOG.push({date:todayStr(), orderNo, items});

  const totalAmount = cartTotal();
  const reg = REGISTERS.find(r=>r.id===regId);
  if(reg) reg.balance += totalAmount;
  FIN_LOG.push({date:todayStr(), orderNo, registerId:regId, amount: totalAmount, kind:'sale'});

  CART.clear(); renderCart(); renderInventory($('#q')?.value||''); renderFinance();
  closeModal('mSellReg'); alert('Sotildi ✅'); saveAll();
}

/* ===================== CHEK (SOZLAMALAR + ACTIONS) ===================== */
const RCPT_DEFAULT = { title:'FbookMED POS', width:320, hfs:16, bfs:11, footer:'Rahmat!' };
function rcptLoad(){ try{const raw=localStorage.getItem(STORE.RCPT); if(!raw) return {...RCPT_DEFAULT}; const p=JSON.parse(raw); return {...RCPT_DEFAULT,...p};}catch{return {...RCPT_DEFAULT};} }
function rcptSave(cfg){ localStorage.setItem(STORE.RCPT, JSON.stringify(cfg)); applyReceiptStyles(); }
function applyReceiptStyles(){
  const cfg = rcptLoad();
  let style = document.getElementById('rcptDyn');
  if(!style){ style = document.createElement('style'); style.id='rcptDyn'; document.head.appendChild(style); }
  style.textContent = `
    .receipt{ width:${cfg.width}px; }
    .receipt h2{ font-size:${cfg.hfs}px; }
    .receipt .meta,
    .receipt th,.receipt td,
    .receipt p{ font-size:${cfg.bfs}px; }
  `;
}
applyReceiptStyles();

$('#btnRcptCfg')?.addEventListener('click', ()=>{
  const cfg = rcptLoad();
  $('#rcpt_title').value  = cfg.title;
  $('#rcpt_width').value  = cfg.width;
  $('#rcpt_hfs').value    = cfg.hfs;
  $('#rcpt_bfs').value    = cfg.bfs;
  $('#rcpt_footer').value = cfg.footer;
  openModal('mRcptCfg');
});
$('#rcptSave')?.addEventListener('click', ()=>{
  const next = {
    title:  ($('#rcpt_title').value || RCPT_DEFAULT.title).trim(),
    width:  Math.min(520, Math.max(220, Number($('#rcpt_width').value||RCPT_DEFAULT.width))),
    hfs:    Math.min(22,  Math.max(10,  Number($('#rcpt_hfs').value||RCPT_DEFAULT.hfs))),
    bfs:    Math.min(16,  Math.max(9,   Number($('#rcpt_bfs').value||RCPT_DEFAULT.bfs))),
    footer: ($('#rcpt_footer').value || RCPT_DEFAULT.footer).trim(),
  };
  rcptSave(next);
  alert('Chek ko‘rinishi saqlandi ✅');
  closeModal('mRcptCfg');
});
$('#rcptReset')?.addEventListener('click', ()=>{
  rcptSave({...RCPT_DEFAULT});
  $('#rcpt_title').value  = RCPT_DEFAULT.title;
  $('#rcpt_width').value  = RCPT_DEFAULT.width;
  $('#rcpt_hfs').value    = RCPT_DEFAULT.hfs;
  $('#rcpt_bfs').value    = RCPT_DEFAULT.bfs;
  $('#rcpt_footer').value = RCPT_DEFAULT.footer;
  alert('Standart ko‘rinishga qaytarildi ♻️');
});

function buildReceiptInnerHTML({title='FbookMED POS',orderNo=null,client=null,items=[]}){
  const cfg=rcptLoad(); const dt=new Date();
  const total=items.reduce((s,i)=>s+i.price*i.qty,0);
  const disc=items.reduce((s,i)=>s+(i.disc||0),0);
  return `
  <h2>${(title&&title.trim())?title:cfg.title}</h2>
  <div class="meta">Sana: ${dt.toLocaleString()}<br>${orderNo?('Buyurtma №: <b>'+orderNo+'</b><br>'):''}${client?('Mijoz: '+client.name+(client.phone?(' · '+client.phone):'')) : ''}</div>
  <table>
    <thead><tr><th>Nomi</th><th class="right">Miqdor</th><th class="right">Narx</th><th class="right">Jami</th></tr></thead>
    <tbody>${items.map(i=>`<tr><td>${i.name}</td><td class="right">${i.qty}</td><td class="right">${fmt(i.price)}</td><td class="right">${fmt(i.price*i.qty-(i.disc||0))}</td></tr>`).join('')}</tbody>
    <tfoot>${disc?`<tr><td colspan="3" class="right">Chegirma</td><td class="right">-${fmt(disc)}</td></tr>`:''}<tr><td colspan="3" class="right">Umumiy</td><td class="right">${fmt(total-disc)}</td></tr></tfoot>
  </table><p>${cfg.footer}</p>`;
}
function buildReceiptText({title='FbookMED POS',orderNo=null,client=null,items=[]}){
  const cfg=rcptLoad(); const dt=new Date();
  const total=items.reduce((s,i)=>s+i.price*i.qty,0);
  const disc=items.reduce((s,i)=>s+(i.disc||0),0);
  const lines=[(title&&title.trim())?title:cfg.title,`Sana: ${dt.toLocaleString()}`];
  if(orderNo)lines.push(`Buyurtma №: ${orderNo}`);
  if(client)lines.push(`Mijoz: ${client.name}${client.phone?(' · '+client.phone):''}`);
  lines.push('','Nomi | Miqdor | Narx | Jami');
  items.forEach(i=>lines.push(`${i.name} | ${i.qty} | ${fmt(i.price)} | ${fmt(i.price*i.qty-(i.disc||0))}`));
  if(disc)lines.push(`Chegirma: -${fmt(disc)}`);
  lines.push(`Umumiy: ${fmt(total-disc)}`, rcptLoad().footer);
  return lines.join('\n');
}
function showReceiptModal({orderNo=null,client=null}={}){
  if(!CART.size){alert('Chek bo‘sh');return;}
  const items=[...CART.values()].map(x=>({name:x.name,qty:x.qty,price:x.price,disc:x.disc||0}));
  $('#receiptContent').innerHTML=buildReceiptInnerHTML({orderNo,client,items});
  const modal=$('#mReceipt'); modal.style.display='flex';
  modal.onclick=e=>{if(e.target.id==='mReceipt') hideReceiptModal();};
  $('#rcptPrint').onclick = ()=>printReceiptStandalone({orderNo,client,items});
  $('#rcptImage').onclick = ()=>saveReceiptAsImage();
  $('#rcptCopy').onclick  = ()=>copyReceiptAsText({orderNo,client,items});
}
function hideReceiptModal(){ $('#mReceipt').style.display='none'; }
function printReceiptStandalone({orderNo=null,client=null,items=[]}){
  const cfg=rcptLoad();
  const html=`<html><head><meta charset="utf-8"><style>
    body{font-family:Arial;margin:0;padding:8px}
    h2{text-align:center;font-size:${cfg.hfs}px;margin:0 0 6px}
    .meta{font-size:${cfg.bfs}px;margin-bottom:6px}
    table{width:${cfg.width}px;border-collapse:collapse}
    th,td{font-size:${cfg.bfs}px;padding:4px;border-bottom:1px dashed #bbb;text-align:left}
    tfoot td{border-top:1px solid #000;font-weight:bold}.right{text-align:right}
    @media print{@page{size:auto;margin:6mm}}
  </style></head><body>
    ${buildReceiptInnerHTML({orderNo,client,items})}
    <script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300);}</script>
  </body></html>`;
  const w=window.open('','PRINT','width=380,height=600'); w.document.write(html); w.document.close(); w.focus();
}
async function saveReceiptAsImage(){
  const node=$('#receiptContent');
  try{
    const canvas=await html2canvas(node,{scale:2,backgroundColor:'#fff'});
    const blob=await new Promise(res=>canvas.toBlob(res,'image/png'));
    if(navigator.clipboard&&window.ClipboardItem){
      try{await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]); alert('✅ Rasm clipboardga nusxalandi'); return;}catch{}
    }
    const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download='chek.png'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    alert('✅ Rasm saqlandi');
  }catch(e){alert('❗ Rasmga aylantirishda xato');}
}
async function copyReceiptAsText({orderNo=null,client=null,items=[]}){
  const txt=buildReceiptText({orderNo,client,items});
  try{await navigator.clipboard.writeText(txt); alert('✅ Nusxa olindi');}
  catch{window.prompt('Matnni qo‘lda nusxalang:',txt);}
}
$('#btnPrintReceipt')?.addEventListener('click',()=>showReceiptModal({orderNo:null,client:null}));

/* ===================== KALKULYATOR ===================== */
$('#btnCalc')?.addEventListener('click',()=>openModal('mKalk'));
$('#btnCalcRun')?.addEventListener('click',()=>{
  const t=$('#k_tarif').value, f=$('#k_fmt').value, c=$('#k_cov').value, r=$('#k_col').value, p=+$('#k_page').value||0, q=+$('#k_qty').value||0;
  const unit=Math.max(0,T[t][f][r]*p + T[t][f]['muqova'][c]), sum=Math.max(0,unit*q);
  $('#k_unit').innerText=fmt(unit); $('#k_sum').innerText=fmt(sum);
});

/* ===================== CHART.JS GRAFIKLAR (Hisobot) ===================== */
function dailySeries(){ const m=new Map(); salesFiltered().forEach(s=>m.set(s.date,(m.get(s.date)||0)+sumOrder(s.items))); const e=[...m.entries()].sort((a,b)=>a[0].localeCompare(b[0])); return {labels:e.map(x=>x[0].slice(5)),sums:e.map(x=>x[1])}; }
function topProducts(n=7){ const m=new Map(); salesFiltered().forEach(s=>s.items.forEach(i=>m.set(i.name,(m.get(i.name)||0)+i.qty))); const a=[...m.entries()].sort((x,y)=>y[1]-x[1]).slice(0,n); return {labels:a.map(x=>x[0]),qtys:a.map(x=>x[1])}; }

(function hookChartsIntoReport(){
  const _orig = refreshReport;
  window.dailyChart = null; window.topChart = null;
  refreshReport = function(){
    _orig(); // KPI va jadval
    if(typeof Chart==='undefined') return;
    const d=dailySeries(), t=topProducts(7);
    const dcanvas = document.getElementById('dailyChart');
    const tcanvas = document.getElementById('topChart');
    if(!dcanvas || !tcanvas) return;

    if(window.dailyChart) window.dailyChart.destroy();
    if(window.topChart)   window.topChart.destroy();

    window.dailyChart = new Chart(dcanvas.getContext('2d'), {
      type:'bar',
      data:{ labels:d.labels, datasets:[{ label:'Savdo (so‘m)', data:d.sums }] },
      options:{ plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
    });
    window.topChart = new Chart(tcanvas.getContext('2d'), {
      type:'bar',
      data:{ labels:t.labels, datasets:[{ label:'Sotilgan dona', data:t.qtys }] },
      options:{ plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true, precision:0}} }
    });
  };
})();

/* ===================== INIT qo‘shimcha ===================== */
window.addEventListener('DOMContentLoaded', ()=>{
  // Xomashyo UI’larini yangilash
  renderRawStdTable(); renderRawList();
  // Narxlar oynasiga tayyorla
  // (dropdown orqali ochilganda ham renderlanadi)
});