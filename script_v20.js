function triggerHaptic() {
  if (window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(40);
  }
}

// Security & Utility
function escapeHTML(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>'"]/g, 
    tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag])
  );
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// --- Global O'zgaruvchilar va Xavfsiz Storage ---
function getStorage(key, defaultVal = []) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultVal;
  } catch (e) {
    console.error("Storage error:", e);
    return defaultVal;
  }
}

function setStorage(key, val) {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error("Storage save error:", e);
  }
}

let basket = getStorage('calcBasket', []);
let fbookProducts = [];

// --- DATABASE CONFIGURATION ---
const DATABASE_MODE = "firebase"; // "local", "firebase", "php"

const firebaseConfig = {
  apiKey: "AIzaSyB7lFHADoRhwb3sZT0D3KtoXOdFcKYjZkM",
  authDomain: "fbookmed-38285.firebaseapp.com",
  databaseURL: "https://fbookmed-38285-default-rtdb.firebaseio.com",
  projectId: "fbookmed-38285",
  storageBucket: "fbookmed-38285.firebasestorage.app",
  messagingSenderId: "594571267124",
  appId: "1:594571267124:web:77be87a2654e8f146f0e61"
};

if (DATABASE_MODE === "firebase") {
  if (typeof firebase !== 'undefined' && !firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
}

const DataService = {
  async fetchProducts() {
    if (DATABASE_MODE === "firebase") {
       try {
           const snapshot = await firebase.database().ref('products').once('value');
           const data = snapshot.val();
           if (!data) return [];
           return Object.keys(data).map(key => ({ ...data[key], id: key })).reverse();
       } catch (e) { console.error(e); return []; }
    }
    if (DATABASE_MODE === "php") {
       try {
           const res = await fetch('backend/api.php');
           return await res.json() || [];
       } catch (e) { console.error(e); return []; }
    }
    // LocalStorage (default)
    return getStorage('fbookProducts', []);
  },
  
  async saveProduct(product) {
    if (DATABASE_MODE === "firebase") {
       const ref = firebase.database().ref('products');
       if (product.id && typeof product.id === 'string' && product.id.startsWith('-')) {
           await ref.child(product.id).update(product);
       } else {
           const pWithoutId = {...product};
           delete pWithoutId.id;
           await ref.push(pWithoutId);
       }
       return true;
    }
    if (DATABASE_MODE === "php") {
       try {
           await fetch('backend/api.php', {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify(product)
           });
           return true;
       } catch(e) { console.error(e); return false; }
    }
    // LocalStorage
    let list = getStorage('fbookProducts', []);
    if (product.id) {
       const idx = list.findIndex(p => p.id == product.id);
       if (idx !== -1) list[idx] = product;
       else list.unshift({...product, id: Date.now()});
    } else {
       list.unshift({...product, id: Date.now()});
    }
    setStorage('fbookProducts', list);
    return true;
  },
  
  async deleteProduct(id) {
    if (DATABASE_MODE === "firebase") {
       await firebase.database().ref('products/' + id).remove();
       return true;
    }
    if (DATABASE_MODE === "php") {
       try {
           await fetch('backend/api.php?id=' + id, { method: 'DELETE' });
           return true;
       } catch(e) { console.error(e); return false; }
    }
    // LocalStorage
    let list = getStorage('fbookProducts', []);
    list = list.filter(p => p.id != id);
    setStorage('fbookProducts', list);
    return true;
  }
};

// Dark Mode logic
function toggleDarkMode() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('darkMode', isDark);
  
  // Menyu ichidagi ikonka
  const menuIcon = document.getElementById('darkModeIconMenu');
  if (menuIcon) menuIcon.textContent = isDark ? '☀️' : '🌙';
}

function showModal(id) {
  if (id === 'cabinet') {
    navigateTo('cabinet');
    return;
  }
  if (id === 'basket') {
    navigateTo('basket');
    return;
  }
  const m = document.getElementById(id + 'Modal');
  if (m) m.style.display = 'flex';
}

function closeModal(id) {
  if (id === 'cabinet' || id === 'basket') {
    navigateTo('calculator');
    return;
  }
  const m = document.getElementById(id + 'Modal');
  if (m) m.style.display = 'none';
}

// Single Page Application (SPA) Navigation
function navigateTo(viewId) {
  triggerHaptic();

  // Barcha view'larni yashirish
  const views = document.querySelectorAll('.app-view');
  views.forEach(v => v.classList.remove('active-view'));

  // Kerakli view'ni ko'rsatish
  const targetView = document.getElementById(viewId + 'View');
  if (targetView) {
    targetView.classList.add('active-view');
  }

  // Navigatsiya tugmalarini yangilash (Bottom nav)
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(item => item.classList.remove('active'));
  
  const activeBtn = document.getElementById('btn-' + viewId);
  if (activeBtn) activeBtn.classList.add('active');

  // Sahifani tepaga qaytarish
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // View'ga mos mantiqiy funksiyalarni chaqirish
  if (viewId === 'basket') renderBasket();
  if (viewId === 'cabinet') renderProfile();
  if (viewId === 'market') renderMarket();
  if (viewId === 'admin') renderAdminProducts();
}

function saveToHistory(data) {
  let history = getStorage('calcHistory', []);

  // Agar oxirgi yozuv bir xil tanlovlarga ega bo'lsa (faqat sahifa farq qilsa),
  // uni yangi qiymat bilan ALMASHTIR (yangi yozuv qo'shma)
  const isSameSelection = history.length > 0 &&
    history[0].tarif  === data.tarif  &&
    history[0].format === data.format &&
    history[0].muqova === data.muqova &&
    history[0].rang   === data.rang;

  if (isSameSelection) {
    history[0] = { ...data, date: history[0].date }; // sanani saqlab qoldik
  } else {
    history.unshift({ ...data, date: new Date().toLocaleString() });
    if (history.length > 10) history = history.slice(0, 10); // Professional limit: 10 ta
  }

  setStorage('calcHistory', history);
  renderHistory();
}

// Debounced version of saveToHistory to optimize performance
const debouncedSaveToHistory = debounce(saveToHistory, 800);

// basket tepada init bo'ldi

function updateBasketBadge() {
  const badgeNav = document.getElementById('navBasketBadge');
  const badgeBottom = document.getElementById('bottomBasketBadge');
  const count = basket.length;

  if (badgeNav) {
    badgeNav.textContent = count;
    badgeNav.style.display = count ? 'flex' : 'none';
  }
  if (badgeBottom) {
    badgeBottom.textContent = count;
    badgeBottom.style.display = count ? 'flex' : 'none';
  }
}

function addToBasket() {
  triggerHaptic();
  const res = updatePrice();
  if (!res) {
    showAlert("Iltimos, avval barcha maydonlarni to'ldiring!");
    return;
  }

  const item = { ...res, id: Date.now() };
  basket.push(item);
  localStorage.setItem('calcBasket', JSON.stringify(basket));
  updateBasketBadge();
  showToast("✅ Savatga qo'shildi!");

  // Button feedback
  const btn = document.getElementById('addBasketBtn');
  if (btn) {
    btn.classList.add('pulse-once');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<span>✅ Qo\'shildi</span>';
    setTimeout(() => {
      btn.classList.remove('pulse-once');
      btn.innerHTML = originalText;
      
      // Sahifa sonini tozalash va narxni reset qilish
      // Barchasini tozalash (yangi mantiq)
      doResetCalculator(false);
    }, 1500);
  } else {
    doResetCalculator(false);
  }
}


function clearFullBasket() {
  showConfirmModal("Savatdagi barcha kitoblarni o'chirib tashlaysizmi? <br><small style='font-size:12px;opacity:0.75;'>(Ushbu amalni ortga qaytarib bo'lmaydi)</small>", () => {
    basket = [];
    localStorage.removeItem('calcBasket');
    renderBasket();
    updateBasketBadge();
    showToast("🗑 Savat bo'shatildi");
    navigateTo('calculator');
  });
}

function showBasketModal() {
  navigateTo('basket');
}

function renderBasket() {
  const container = document.getElementById('basketItems');
  const totalArea = document.getElementById('basketTotalArea');
  const totalValueEl = document.getElementById('basketTotalValue');
  const orderBtn = document.getElementById('basketOrderBtn');
  const clearBtn = document.getElementById('clearBasketBtn');
  
  if (!container) return;
  
  if (basket.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">🛒</span>
        <div style="font-weight:700; font-size:16px; margin-bottom:5px;">Savat hozircha bo'sh</div>
        <div style="font-size:13px; opacity:0.6;">Tanlagan kitoblaringiz shu yerda ko'rinadi</div>
      </div>
    `;
    if (totalArea) totalArea.style.display = 'none';
    if (orderBtn) orderBtn.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'none';
    updateBasketBadge();
    return;
  }

  container.innerHTML = '';
  let totalSum = 0;
  const fragment = document.createDocumentFragment();

  basket.forEach((item, index) => {
    const itemQty = item.kitobSoni || 1;
    let itemTotal = 0;
    
    if (item.totalPrice) {
      itemTotal = item.totalPrice;
    } else {
      const priceNum = parseInt(String(item.price).replace(/[^0-9]/g, ''), 10);
      itemTotal = priceNum;
    }
    
    totalSum += itemTotal;

    const indexBadge = `<span class="basket-item-index">${index + 1}</span>`;
    let titleText, subtitleText;

    if (item.type === 'market') {
      titleText = escapeHTML(item.kitobNomi);
      subtitleText = escapeHTML(item.category || 'Tayyor mahsulot');
    } else {
      const qismText = item.qismSoni > 1 ? ` (${item.qismSoni} qism)` : '';
      titleText = escapeHTML(item.kitobNomi ? item.kitobNomi : `Kitob`);
      subtitleText = `${escapeHTML(item.tarif)}, ${escapeHTML(item.format)}, ${escapeHTML(item.muqova)}${qismText}, ${escapeHTML(item.rang)}, ${item.sahifa} bet`;
    }

    const div = document.createElement('div');
    div.className = 'basket-item';
    div.innerHTML = `
      <div class="basket-item-info">
        <span class="basket-item-title">${indexBadge} ${titleText}</span>
        <span class="basket-item-subtitle">${subtitleText}</span>
      </div>
      <div class="basket-item-actions">
        <div class="basket-item-qty-controls">
          <button class="qty-btn" onclick="changeBasketQuantity(${index}, -1)">-</button>
          <span class="qty-value">${itemQty}</span>
          <button class="qty-btn" onclick="changeBasketQuantity(${index}, 1)">+</button>
        </div>
        <div class="basket-item-price">${itemTotal.toLocaleString()} s.</div>
      </div>
      <button class="remove-basket-item" onclick="removeFromBasket(${index})" title="O'chirish">×</button>
    `;
    fragment.appendChild(div);
  });
  
  container.appendChild(fragment);

  if (totalArea) {
    totalArea.style.display = 'flex';
    totalValueEl.textContent = totalSum.toLocaleString() + " so'm";
  }
  if (orderBtn) orderBtn.style.display = 'flex';
  if (clearBtn) clearBtn.style.display = 'block';
  updateBasketBadge();
}

function changeBasketQuantity(index, delta) {
  triggerHaptic();
  if (basket[index]) {
    let current = basket[index].kitobSoni || 1;
    let newVal = current + delta;
    if (newVal < 1) newVal = 1;
    if (newVal > 1000) newVal = 1000;
    basket[index].kitobSoni = newVal;
    
    // Narxni qayta hisoblash
    if (basket[index].unitPrice) {
      basket[index].totalPrice = basket[index].unitPrice * newVal;
      basket[index].price = basket[index].totalPrice.toLocaleString() + " so'm";
    } else {
      // Eski ma'lumotlar uchun
      const oldQty = current;
      const totalNum = parseInt(String(basket[index].price).replace(/[^0-9]/g, ''), 10);
      const unit = Math.round(totalNum / oldQty);
      basket[index].unitPrice = unit;
      basket[index].totalPrice = unit * newVal;
      basket[index].price = basket[index].totalPrice.toLocaleString() + " so'm";
    }

    localStorage.setItem('calcBasket', JSON.stringify(basket));
    renderBasket();
  }
}

function removeFromBasket(index) {
  basket.splice(index, 1);
  localStorage.setItem('calcBasket', JSON.stringify(basket));
  renderBasket();
  updateBasketBadge();
}

let currentTelegramType = null;

function sendBasketToTelegram() {
  if (basket.length === 0) return;
  currentTelegramType = 'basket';
  
  const user = JSON.parse(localStorage.getItem('fbookUser') || 'null');
  if (user && user.phone) {
    executeTelegramSend(user.phone);
  } else {
    showModal('phone');
  }
}

// --- Telegram Message Builder ---
const TelegramService = {
  formatProductItem: function(item, index, itemQty, unitPrice, totalPrice) {
    if (item.type === 'market') {
      return `${index + 1}. *${escapeHTML(item.kitobNomi)}*\\n` +
             `   🛒 Kategoriya: *${escapeHTML(item.category || '-')}*\\n` +
             `   📦 Miqdor: *${itemQty} ta*\\n` +
             `   💸 Narxi: ${unitPrice.toLocaleString()} * ${itemQty} = *${totalPrice.toLocaleString()} so'm*\\n\\n`;
    } else {
      const qismText = item.qismSoni > 1 ? ` (${item.qismSoni} qism)` : '';
      const titleStr = item.kitobNomi ? `*${escapeHTML(item.kitobNomi)}*` : `*${index + 1}-Kitob*`;
      return `${index + 1}. ${titleStr}\\n` +
             `   ✨ Tarif: *${escapeHTML(item.tarif)}*\\n` +
             `   📐 *${escapeHTML(item.format)}*, *${escapeHTML(item.muqova)}*${qismText}, *${escapeHTML(item.rang)}*\\n` +
             `   📄 *${item.sahifa} bet*, *${itemQty} ta kitob*\\n` +
             `   💸 Narxi: ${unitPrice.toLocaleString()} * ${itemQty} = *${totalPrice.toLocaleString()} so'm*\\n\\n`;
    }
  },
  buildHeader: function(user, phone, title) {
    let text = `📦 *${title}*\\n`;
    if (user && user.name) text += `👤 Buyurtmachi: *${escapeHTML(user.name)}*\\n`;
    if (phone && phone.trim() !== "") text += `📞 Aloqa: ${escapeHTML(phone.trim())}\\n`;
    text += `\\n`;
    return text;
  },
  send: function(text) {
    const url = `https://t.me/FbookMED1?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }
};

function doSendBasketToTelegram(phone) {
  const user = JSON.parse(localStorage.getItem('fbookUser') || 'null');
  let text = TelegramService.buildHeader(user, phone, 'YANGI SAVAT BUYURTMASI');
  
  let totalSum = 0;
  basket.forEach((item, index) => {
    const itemQty = item.kitobSoni || 1;
    const unitPrice = item.unitPrice || Math.round(parseInt(String(item.price).replace(/[^0-9]/g, ''), 10) / itemQty);
    const totalPrice = unitPrice * itemQty;
    totalSum += totalPrice;
    
    text += TelegramService.formatProductItem(item, index, itemQty, unitPrice, totalPrice);
  });

  text += `-------------------------\\n` +
          `💰 *JAMI: ${totalSum.toLocaleString()} so'm*`;

  TelegramService.send(text);

  // Savat va formani tozalash
  setTimeout(() => {
    basket = [];
    localStorage.removeItem('calcBasket');
    renderBasket();
    updateBasketBadge();
    doResetCalculator(false);
    navigateTo('calculator');
  }, 1000);
}

function clearFullHistory() {
  showConfirmModal("Barcha oxirgi hisob-kitoblarni o'chirib tashlaysizmi?", () => {
    localStorage.removeItem('calcHistory');
    renderHistory();
    showToast("🗑 Tarix tozalandi");
  });
}

function restoreFromHistory(index) {
  const history = JSON.parse(localStorage.getItem('calcHistory') || '[]');
  const item = history[index];
  if (!item) return;

  triggerHaptic();

  // 1. Selectlarni to'ldirish
  const ids = ['tarif', 'format', 'muqova', 'rang'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.value = item[id];
      
      // UI (float-value) ni yangilash
      const valEl = document.getElementById(id + 'Value');
      if (valEl) valEl.textContent = item[id];
      
      const btn = document.getElementById(id + 'Btn');
      if (btn) btn.classList.add('filled');
    }
  });

  // 2. Sahifa va Kitob nomi
  const sahifa = document.getElementById('sahifa');
  if (sahifa) sahifa.value = item.sahifa;

  const kitobNomi = document.getElementById('kitobNomi');
  if (kitobNomi) kitobNomi.value = item.kitobNomi || "";

  // 3. Soni va Qismlar
  const kitobSoni = document.getElementById('kitobSoni');
  if (kitobSoni) kitobSoni.value = item.kitobSoni;

  const qismSoni = document.getElementById('qismSoniHidden');
  const qismDisplay = document.getElementById('qismSoniDisplay');
  if (qismSoni) qismSoni.value = item.qismSoni;
  if (qismDisplay) qismDisplay.textContent = item.qismSoni;

  // 4. Modalni yopish va narxni yangilash
  const historyModal = document.getElementById('historyModal');
  if (historyModal) historyModal.style.display = 'none';
  
  // Agar boshqa viewda bo'lsa (Savat yoki Kabinet), Kalkulyatorga qaytaramiz
  navigateTo('calculator');
  updatePrice();
  showToast("🔄 Hisob qayta yuklandi");
}

function addFromHistoryToBasket(index) {
  const history = JSON.parse(localStorage.getItem('calcHistory') || '[]');
  const item = history[index];
  if (!item) return;

  triggerHaptic();
  
  // Savat ob'yekti yaratish (Tarixdagi ma'lumotlar asosida)
  const basketItem = { ...item, id: Date.now() };
  basket.push(basketItem);
  localStorage.setItem('calcBasket', JSON.stringify(basket));
  
  updateBasketBadge();
  showToast("✅ Savatga qayta qo'shildi!");
  closeHistoryModal();
}

function removeFromHistory(index) {
  const history = getStorage('calcHistory', []);
  history.splice(index, 1);
  setStorage('calcHistory', history);
  renderHistory();
  showToast("🗑 Tarixdan o'chirildi");
}

function renderHistory() {
  const container = document.getElementById('historyItems');
  const clearBtn = document.getElementById('clearHistoryBtn');
  if (!container) return;
  
  const history = JSON.parse(localStorage.getItem('calcHistory') || '[]');
  
  if (history.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;opacity:0.6;">Tarix bo\'sh</div>';
    if (clearBtn) clearBtn.style.display = 'none';
    return;
  }

  if (clearBtn) clearBtn.style.display = 'block';
  container.innerHTML = '';

  history.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'history-item';
    
    const qism = item.qismSoni > 1 ? `, ${item.qismSoni} qism` : '';
    const titleText = item.kitobNomi ? item.kitobNomi : `${index + 1}-Kitob`;
    const subtitleText = `${item.tarif}, ${item.format}, ${item.muqova}, ${item.rang}, ${item.sahifa} bet${qism}`;

    div.innerHTML = `
      <div class="history-info">
        <span class="history-title">${titleText}</span>
        <span class="history-subtitle">${subtitleText}</span>
      </div>
      <div class="history-actions">
        <div class="history-price">${item.price}</div>
        <div class="history-btns-row">
          <button class="restore-history-btn" onclick="restoreFromHistory(${index})" title="Qayta yuklash">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
          </button>
          <button class="add-again-history-btn" onclick="addFromHistoryToBasket(${index})" title="Savatga qo'shish">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>
          </button>
          <button class="remove-history-btn" onclick="removeFromHistory(${index})" title="O'chirish">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

const tarifNarxlar = {
  "Standart": {
    "A4": {"Oq qora": 180, "Rangli": 230, "muqova": {"Qattiq muqovali": 45000, "Yumshoq muqovali": 20000, "Simli pereplyot": 15000, "Plastik pereplyot": 10000, "Oddiy muqovali": 7000, "Muqovasiz": 0}},
    "A5": {"Oq qora": 90,  "Rangli": 115, "muqova": {"Qattiq muqovali": 25000, "Yumshoq muqovali": 10000, "Simli pereplyot": 10000, "Plastik pereplyot": 8000,  "Oddiy muqovali": 4000, "Muqovasiz": 0}},
    "B5": {"Oq qora": 180, "Rangli": 230, "muqova": {"Qattiq muqovali": 45000, "Yumshoq muqovali": 20000, "Simli pereplyot": 15000, "Plastik pereplyot": 10000, "Oddiy muqovali": 7000, "Muqovasiz": 0}}
  },
  "Maxsus": {
    "A4": {"Oq qora": 150, "Rangli": 160, "muqova": {"Qattiq muqovali": 40000, "Yumshoq muqovali": 20000, "Simli pereplyot": 10000, "Plastik pereplyot": 8000,  "Oddiy muqovali": 5000, "Muqovasiz": 0}},
    "A5": {"Oq qora": 75,  "Rangli": 80,  "muqova": {"Qattiq muqovali": 20000, "Yumshoq muqovali": 10000, "Simli pereplyot": 10000, "Plastik pereplyot": 8000,  "Oddiy muqovali": 3000, "Muqovasiz": 0}},
    "B5": {"Oq qora": 150, "Rangli": 160, "muqova": {"Qattiq muqovali": 40000, "Yumshoq muqovali": 20000, "Simli pereplyot": 10000, "Plastik pereplyot": 8000,  "Oddiy muqovali": 5000, "Muqovasiz": 0}}
  },
  "Optom": {
    "A4": {"Oq qora": 120, "Rangli": 140, "muqova": {"Qattiq muqovali": 40000, "Yumshoq muqovali": 15000, "Simli pereplyot": 8000,  "Plastik pereplyot": 8000,  "Oddiy muqovali": 3000, "Muqovasiz": 0}},
    "A5": {"Oq qora": 60,  "Rangli": 70,  "muqova": {"Qattiq muqovali": 20000, "Yumshoq muqovali": 10000, "Simli pereplyot": 8000,  "Plastik pereplyot": 7000,  "Oddiy muqovali": 2000, "Muqovasiz": 0}},
    "B5": {"Oq qora": 120, "Rangli": 140, "muqova": {"Qattiq muqovali": 40000, "Yumshoq muqovali": 15000, "Simli pereplyot": 8000,  "Plastik pereplyot": 8000,  "Oddiy muqovali": 3000, "Muqovasiz": 0}}
  }
};

const standartMuqovaYangi = {
  "Qattiq muqovali": { "A4": 40000, "A5": 20000, "B5": 40000 },
  "Yumshoq muqovali": { "A4": 20000, "A5": 10000, "B5": 20000 },
  "Simli pereplyot": { "A4": 10000, "A5": 10000, "B5": 10000 },
  "Plastik pereplyot": { "A4": 8000, "A5": 8000, "B5": 8000 },
  "Oddiy muqovali": { "A4": 5000, "A5": 3000, "B5": 5000 },
  "Muqovasiz": { "A4": 0, "A5": 0, "B5": 0 }
};

const helpTexts = {
  "tarif": `<b>📚 Tariflar bo'yicha tushuntirish:</b><br><br>
            • <b>Standart:</b> Kam miqdordagi (donalik) buyurtmalar uchun mo'ljallangan.<br>
            • <b>Maxsus:</b> 50 tadan ortiq buyurtmalar uchun chegirmali narx.<br>
            • <b>Optom:</b> 100 tadan ortiq buyurtmalar uchun eng arzon (ulgurji) narx.`,
  "format": `<b>📏 Formatlar bo'yicha tushuntirish:</b><br><br>
             • <b>A4:</b> Katta o'lcham (210x297 mm) — jurnallar yoki darsliklar uchun.<br>
             • <b>A5:</b> Standart kitob o'lchami (148x210 mm) — badiiy kitoblar uchun eng ommabop.<br>
             • <b>B5:</b> O'rtacha o'lcham (176x250 mm) — ilmiy adabiyotlar uchun qulay.`
};

function showHelp(type, event) {
  if (event) event.stopPropagation();
  const titleEl = document.getElementById('helpTitle');
  const bodyEl = document.getElementById('helpBody');
  const modal = document.getElementById('helpModal');
  
  if (helpTexts[type]) {
    titleEl.innerHTML = type === 'tarif' ? "Tariflar haqida 📋" : "Formatlar haqida 📏";
    bodyEl.innerHTML = helpTexts[type];
    modal.style.display = 'flex';
  }
}

function calculatePrice(opts) {
  const { tarif, format, muqova, rang, sahifa, kitobSoni, qismSoni } = opts;
  
  const sahifaNarxi = tarifNarxlar?.[tarif]?.[format]?.[rang];
  let muqovaNarxiBitta = tarifNarxlar?.[tarif]?.[format]?.muqova?.[muqova];

  if (tarif === "Standart" && qismSoni >= 2) {
    if (standartMuqovaYangi[muqova] && standartMuqovaYangi[muqova][format] !== undefined) {
      muqovaNarxiBitta = standartMuqovaYangi[muqova][format];
    }
  }

  if (typeof sahifaNarxi !== "number" || typeof muqovaNarxiBitta !== "number") return null;

  const muqovaNarxi = muqovaNarxiBitta * qismSoni;
  const bitta = sahifa * sahifaNarxi + muqovaNarxi;
  const bittaYaxlit = yaxlit1000(bitta);
  const jamiYaxlit = bittaYaxlit * kitobSoni;

  return { bittaYaxlit, jamiYaxlit };
}

function validateForm() {
  const tarif = document.getElementById('tarif').value;
  const format = document.getElementById('format').value;
  const muqova = document.getElementById('muqova').value;
  const rang = document.getElementById('rang').value;
  const sahifa = parseInt(document.getElementById('sahifa').value || 0);

  const isValid = tarif && format && muqova && rang && sahifa > 0;
  
  const btnBasket = document.getElementById('addBasketBtn');
  const btnOrder = document.getElementById('directOrderBtn');
  const btnSave = document.querySelector('.save-btn');

  if (btnBasket) btnBasket.disabled = !isValid;
  if (btnOrder) btnOrder.disabled = !isValid;
  // Rasmni saqlash tugmasini ham isValid bo'lsa enabled qilamiz
}


function korsatmaChiqar() {
  const tarif = document.getElementById('tarif').value;
  const izoh = document.getElementById('izoh');
  if (!izoh) return;
  if (tarif === "Optom") izoh.innerText = "💡 Minimal buyurtma 100 ta";
  else if (tarif === "Maxsus") izoh.innerText = "💼 Minimal buyurtma 50 ta";
  else if (tarif === "Standart") izoh.innerText = "📚 Kam sonli buyurtma (donalik kitob)";
  else izoh.innerText = "";
}

function yaxlit1000(n) {
  const rem = n % 1000;
  if (rem === 0) return n;
  // Agar qoldiq 500 dan katta yoki teng bo'lsa, yuqoriga, aks holda pastga yaxlitlaymiz
  return rem >= 500 ? (n + (1000 - rem)) : (n - rem);
}

// Kitob soni +/- tugmalari
function changeKitobSoni(delta) {
  triggerHaptic();
  const input = document.getElementById('kitobSoni');
  let val = parseInt(input.value || 1);
  val = Math.max(1, Math.min(9999, val + delta));
  input.value = val;
  const result = updatePrice();
  if (result) debouncedSaveToHistory(result);
}

// Qism Dropdown-ni ochish/yopish
function toggleQismDropdown(event) {
  event.stopPropagation();
  const dropdown = document.getElementById('qismDropdown');
  dropdown.classList.toggle('show');
}

// Qism sonini to'g'ridan-to'g'ri o'rnatish (Dropdown orqali)
function setQismSoni(n) {
  const input = document.getElementById('qismSoniHidden');
  const display = document.getElementById('qismSoniDisplay');
  input.value = n;
  display.textContent = n;
  
  // Dropdown-ni yopish
  const dropdown = document.getElementById('qismDropdown');
  if (dropdown) dropdown.classList.remove('show');
  
  const result = updatePrice();
  if (result) debouncedSaveToHistory(result);
}

// Tashqariga bosilganda dropdown-ni yopish
document.addEventListener('mousedown', function(event) {
  const dropdown = document.getElementById('qismDropdown');
  const selectArea = document.querySelector('.qism-select-area');
  
  if (dropdown && dropdown.classList.contains('show')) {
    // Agar bosilgan element selectArea ichida bo'lmasa, yopamiz
    if (!selectArea.contains(event.target)) {
      dropdown.classList.remove('show');
    }
  }
});

function setBanner(state, valueText, hintText, formulaText, perText) {
  const banner = document.getElementById('priceBanner');
  const v = document.getElementById('priceValue');
  if (!banner || !v) return;
  
  banner.classList.remove('err', 'warn');
  if (state) banner.classList.add(state);
  
  const targetNum = parseInt(valueText.replace(/[^0-9]/g, ''), 10);
  if (!isNaN(targetNum) && valueText.includes("so'm") && v.textContent !== '—' && !state) {
    animateNumber(v, targetNum);
  } else {
    v.textContent = valueText;
  }

  const hintEl = document.getElementById('priceHint');
  if (hintEl) hintEl.textContent = hintText;
  const formulaEl = document.getElementById('priceFormula');
  if (formulaEl) formulaEl.textContent = formulaText || 'Narx avtomatik hisoblanadi';
  const perEl = document.getElementById('pricePerBook');
  if (perEl) perEl.textContent = perText || '';

  banner.classList.remove('success');
  if (!state && valueText !== '—') {
     banner.classList.add('success');
     // Success flash effect
     const vEl = document.getElementById('priceValue');
     if (vEl) {
       vEl.style.transform = 'scale(1.1)';
       setTimeout(() => { vEl.style.transform = 'scale(1)'; }, 200);
     }
  }

  banner.style.animation = 'none';
  void banner.offsetWidth;
  banner.style.animation = 'pulse 0.35s ease-in-out';
}

function animateNumber(element, target) {
  let currentText = element.textContent.replace(/[^0-9]/g, '');
  let current = parseInt(currentText) || 0;
  
  if (current === target) return;

  const duration = 400; // ms
  const start = performance.now();

  function updateCount(currentTime) {
    const elapsed = currentTime - start;
    const progress = Math.min(elapsed / duration, 1);
    
    // EaseOutCubic
    const ease = 1 - Math.pow(1 - progress, 3);
    const count = Math.floor(current + (target - current) * ease);
    
    element.textContent = count.toLocaleString() + " so'm";

    if (progress < 1) {
      requestAnimationFrame(updateCount);
    } else {
      element.textContent = target.toLocaleString() + " so'm";
    }
  }
  requestAnimationFrame(updateCount);
}

function isCalculatorDirty() {
  const ids = ['format', 'muqova', 'rang'];
  for (let id of ids) {
    const el = document.getElementById(id);
    if (el && el.value !== "") return true;
  }
  
  const tarif = document.getElementById('tarif');
  if (tarif && tarif.value !== "" && tarif.value !== "Standart") return true;

  const sahifa = document.getElementById('sahifa');
  if (sahifa && sahifa.value !== "") return true;

  const kitobNomi = document.getElementById('kitobNomi');
  if (kitobNomi && kitobNomi.value !== "") return true;

  const kitobSoniInput = document.getElementById('kitobSoni');
  if (kitobSoniInput && kitobSoniInput.value !== "1") return true;

  const qismSoni = document.getElementById('qismSoniHidden');
  if (qismSoni && qismSoni.value !== "1") return true;

  return false;
}

function toggleClearBtnState() {
  const btn = document.querySelector('.clear-btn');
  if (!btn) return;
  const isDirty = isCalculatorDirty();
  if (isDirty) {
    btn.classList.remove('disabled');
  } else {
    btn.classList.add('disabled');
  }
}

function resetCalculator() {
  if (!isCalculatorDirty()) return; // Forma bo'sh bo'lsa hech narsa qilmaydi

  if (basket.length === 0) {
    doResetCalculator();
  } else {
    showConfirmModal("Hozirgi hisob-kitoblarni tozalaysizmi? <br><small style='font-size:12px;opacity:0.75;'>(Savatdagi kitoblar saqlanib qoladi)</small>", doResetCalculator);
  }
}

let currentConfirmAction = null;

function showConfirmModal(text, onApprove) {
  const modal = document.getElementById('confirmModal');
  const textEl = document.getElementById('confirmText');
  if (textEl) textEl.innerHTML = text;
  if (modal) modal.style.display = 'flex';
  currentConfirmAction = onApprove;
}

function confirmDecision(approved) {
  const modal = document.getElementById('confirmModal');
  if (modal) modal.style.display = 'none';
  if (approved && currentConfirmAction) {
    currentConfirmAction();
  }
}

function doResetCalculator(showToastFlag = true) {
  // Inputlarni tozalash
  const ids = ['tarif', 'format', 'muqova', 'rang'];
  ids.forEach(id => {
    const sel = document.getElementById(id);
    if (sel) sel.value = "";
    const btn = document.getElementById(id + 'Btn');
    const valEl = document.getElementById(id + 'Value');
    if (btn) btn.classList.remove('filled');
    if (valEl) valEl.textContent = "";
    
    // Wrapperlarni ham tozalash (aynan Muqova uchun)
    const wrapper = document.getElementById(id + 'Wrapper');
    if (wrapper) wrapper.classList.remove('filled');
  });

  const sahifa = document.getElementById('sahifa');
  if (sahifa) sahifa.value = "";

  const kitobSoni = document.getElementById('kitobSoni');
  if (kitobSoni) kitobSoni.value = "1";

  const qismSoni = document.getElementById('qismSoniHidden');
  const qismDisplay = document.getElementById('qismSoniDisplay');
  if (qismSoni) qismSoni.value = "1";
  if (qismDisplay) qismDisplay.textContent = "1";

  const izoh = document.getElementById('izoh');
  if (izoh) izoh.innerText = "";

  const qogoz = document.getElementById('qogoz');
  if (qogoz) {
    qogoz.innerText = "";
    qogoz.style.display = 'none';
  }

  const kitobNomi = document.getElementById('kitobNomi');
  if (kitobNomi) kitobNomi.value = "";

  // Standart tarifni qayta o'rnatish
  selectOption('tarif', 'Standart');

  updatePrice();
  if (showToastFlag) showToast("🔄 Tozalandi");
}


function sendToTelegram() {
  const res = updatePrice();
  if (!res) {
    showAlert("Iltimos, avval barcha maydonlarni to'ldiring!");
    return;
  }
  currentTelegramType = 'single';
  
  const user = JSON.parse(localStorage.getItem('fbookUser') || 'null');
  if (user && user.phone) {
    executeTelegramSend(user.phone);
  } else {
    showModal('phone');
  }
}

function doSendToTelegram(phone) {
  const res = updatePrice();
  const user = JSON.parse(localStorage.getItem('fbookUser') || 'null');
  
  let text = TelegramService.buildHeader(user, phone, 'YANGI BUYURTMA');
  
  const itemQty = res.kitobSoni || 1;
  const unitPrice = res.unitPrice || Math.round(res.totalPrice / itemQty);
  
  text += TelegramService.formatProductItem(res, 0, itemQty, unitPrice, res.totalPrice);
  
  // Custom single total output
  text += `-------------------------\\n💰 *JAMI: ${res.totalPrice.toLocaleString()} so'm*`;

  TelegramService.send(text);

  // Avtomatik tozalash (Buyurtma bergandan so'ng)
  setTimeout(() => {
    doResetCalculator(false);
  }, 1000);
}


function updatePrice() {
  const tarif  = document.getElementById('tarif').value;
  const format = document.getElementById('format').value;
  const muqova = document.getElementById('muqova').value;
  const rang   = document.getElementById('rang').value;
  const sahifaInput = document.getElementById('sahifa');
  const kitobSoniInput = document.getElementById('kitobSoni');
  const qismSoniInput = document.getElementById('qismSoniHidden');
  const kitobNomiInput = document.getElementById('kitobNomi');
  const kitobNomi = kitobNomiInput ? kitobNomiInput.value.trim() : "";

  // Validation: Only positive integers
  if (sahifaInput) {
    sahifaInput.value = sahifaInput.value.replace(/[^0-9]/g, '');
  }

  let sahifaValue = parseInt(sahifaInput ? sahifaInput.value : 0, 10);
  if (isNaN(sahifaValue) || sahifaValue < 1) sahifaValue = 0;
  let sahifa = sahifaValue;

  if (sahifa > 10000) {
    sahifa = 10000;
    if (sahifaInput) sahifaInput.value = "10000";
  }

  let ksValue = parseInt(kitobSoniInput ? kitobSoniInput.value : 1, 10);
  if (isNaN(ksValue) || ksValue < 1) ksValue = 1;
  const kitobSoni = ksValue;

  const qismArea = document.querySelector('.qism-select-area');
  if (qismArea) {
    if (!muqova || muqova === "Muqovasiz") {
      qismArea.classList.add('hidden');
      if (qismSoniInput) qismSoniInput.value = "1";
      const qismDisplay = document.getElementById('qismSoniDisplay');
      if (qismDisplay) qismDisplay.textContent = "1";
    } else {
      qismArea.classList.remove('hidden');
    }
  }

  const qismSoni = parseInt(qismSoniInput ? qismSoniInput.value : 1, 10) || 1;

  // 1. Mantiqiy tekshiruvlarni hisoblash
  const suggestedParts = Math.ceil(sahifa / 900);
  let isWarning = (muqova !== "Muqovasiz" && sahifa > 900 && qismSoni < suggestedParts);

  // 2. UI elementlarini tozalash
  const qogozInfo = document.getElementById('qogoz');
  if (qogozInfo) qogozInfo.innerHTML = ""; // innerText dan innerHTML ga o'zgartirildi

  if (!tarif || !format || !muqova || !rang || isNaN(sahifa) || sahifa <= 0) {
    setBanner('err', '—', "Iltimos, barcha maydonlarni to'ldiring!", 'Narx avtomatik hisoblanadi', '');
    return;
  }

  // 3. Narxni hisoblash
  const prices = calculatePrice({ tarif, format, muqova, rang, sahifa, kitobSoni, qismSoni });
  
  if (!prices) {
    validateForm();
    setBanner('err', '—', "Tanlovlarda mos narx topilmadi.", 'Narx avtomatik hisoblanadi', '');
    return;
  }

  const { bittaYaxlit, jamiYaxlit } = prices;
  const priceStr = `${jamiYaxlit.toLocaleString()} so'm`;

  // 4. Banner ma'lumotlarini tayyorlash
  let formulaText, perText;
  if (kitobSoni > 1) {
    formulaText = `${kitobSoni} × ${bittaYaxlit.toLocaleString()} so'm`;
    perText = `(1 ta = ${bittaYaxlit.toLocaleString()} so'm)`;
  } else if (qismSoni > 1) {
    formulaText = `${qismSoni} qism muqova kiritildi`;
    perText = '';
  } else {
    formulaText = `1 ta kitob narxi`;
    perText = '';
  }

  // 5. Bannerni yangilash (isWarning holati bilan)
  const hintText = "Natija doimiy yangilanadi";
  let bannerState = isWarning ? 'warn' : '';
  
  // Tarif bo'yicha ogohlantirishlar
  let specificHint = hintText;
  if (tarif === "Optom" && kitobSoni < 100) {
    bannerState = 'warn';
    specificHint = "Optom tarif uchun minimal 100 ta kitob kerak!";
  } else if (tarif === "Maxsus" && kitobSoni < 50) {
    bannerState = 'warn';
    specificHint = "Maxsus tarif uchun minimal 50 ta kitob kerak!";
  } else if (tarif === "Standart" && kitobSoni >= 100) {
    bannerState = 'warn';
    specificHint = "💡 Tavsiya: Optom tarifda arzonroq bo'ladi!";
  } else if (tarif === "Standart" && kitobSoni >= 50) {
    bannerState = 'warn';
    specificHint = "💡 Tavsiya: Maxsus tarifda arzonroq bo'ladi!";
  }

  setBanner(bannerState, priceStr, specificHint, formulaText, perText);

  // 6. Qog'oz ma'lumotlarini yangilash
  let extraHtml = "";
  if (isWarning) {
    extraHtml += `⚠️ Sahifa soni ko'p (${sahifa} bet). Sifatli chiqishi uchun kitobni <b>${suggestedParts} ta qismga</b> bo'lib tanlashni tavsiya qilamiz.<br>`;
  }

  if (format === "A4") extraHtml += "📏 Qog'oz o'lchami – 210×297 mm";
  else if (format === "A5") extraHtml += "📏 Qog'oz o'lchami – 148×210 mm";
  else if (format === "B5") extraHtml += "📏 Qog'oz o'lchami – 176×250 mm";

  if (qogozInfo) {
    qogozInfo.innerHTML = extraHtml.trim();
    if (isWarning) {
      qogozInfo.classList.add('warning');
    } else {
      qogozInfo.classList.remove('warning');
    }
    qogozInfo.style.display = extraHtml.trim() ? 'block' : 'none';
  }

  validateForm();
  toggleClearBtnState();
  return { tarif, format, muqova, rang, sahifa, kitobSoni, qismSoni, price: priceStr, unitPrice: bittaYaxlit, totalPrice: jamiYaxlit, kitobNomi };
}

function closeHistoryModal() {
  document.getElementById('historyModal').style.display = 'none';
}

function showHistoryModal() {
  renderHistory();
  const modal = document.getElementById('historyModal');
  modal.style.display = 'flex';

  // Keyingi click'da modal content dan tashqarida bosish tekshiriladi
  setTimeout(function() {
    function outsideClick(e) {
      const content = modal.querySelector('.modal-content');
      if (content && !content.contains(e.target)) {
        modal.style.display = 'none';
        document.removeEventListener('mousedown', outsideClick);
      }
    }
    document.addEventListener('mousedown', outsideClick);
  }, 50);
}


function selectOption(type, value) {
  triggerHaptic();
  const sel = document.getElementById(type);
  if (sel) sel.value = value;

  const btn = document.getElementById(type + 'Btn');
  const valueEl = document.getElementById(type + 'Value');
  
  if (btn) {
    btn.classList.add('filled');
    // Premium pulse effect
    btn.classList.remove('pulse-on-select');
    void btn.offsetWidth; // trigger reflow
    btn.classList.add('pulse-on-select');
    
    // Muqova uchun xususan: wrapperga ham pulse beramiz
    if (type === 'muqova') {
      const wrapper = document.getElementById('muqovaWrapper');
      if (wrapper) {
        wrapper.classList.add('filled');
        wrapper.classList.remove('pulse-on-select');
        void wrapper.offsetWidth;
        wrapper.classList.add('pulse-on-select');
      }
    }
  }
  
  if (valueEl) valueEl.textContent = value;

  const modal = document.getElementById(type + 'Modal');
  if (modal) modal.style.display = 'none';
  if (type === 'tarif') korsatmaChiqar();
  const result = updatePrice();
  if (result) saveToHistory(result);
}

async function saveAsImage() {
  // Narx hisoblanmagan bo'lsa rasm saqlanmasin
  const priceValue = document.getElementById('priceValue');
  const btn = document.querySelector('.save-btn');
  if (!priceValue || priceValue.textContent.trim() === '—') {
    showAlert("Iltimos, avval barcha maydonlarni to'ldiring!");
    return;
  }

  const area = document.getElementById('captureArea');
  if (!area) return;
  btn.textContent = '⏱ Yuklanmoqda...';
  
  try {
    const canvas = await html2canvas(area, {
      scale: 2,
      backgroundColor: "#f4f7f9",
      useCORS: true,
      logging: false
    });
    
    const link = document.createElement('a');
    link.download = `FbookMED_Hisob_${new Date().getTime()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    // Success feedback
    showToast('✅ Rasm muvaffaqiyatli saqlandi!');
    btn.innerHTML = '✅ Saqlandi';
    btn.classList.add('btn-success');
    setTimeout(() => {
      btn.innerHTML = '📸 Rasm';
      btn.classList.remove('btn-success');
    }, 2000);
  } catch (err) {
    console.error('Snapshot error:', err);
    showToast('❌ Rasmni saqlashda xatolik!');
    btn.innerHTML = '📸 Rasm';
  }
}

window.onclick = function(event) {
  ['tarif','format','muqova','rang','confirm','phone','alert','address'].forEach(type => {
    const modal = document.getElementById(type + 'Modal');
    if (modal && event.target === modal) modal.style.display = 'none';
  });

  // Oxirgi hisoblar modali uchun tashqarida bosib yopish
  const historyModal = document.getElementById('historyModal');
  if (historyModal && (event.target === historyModal || event.target.classList.contains('modal-overlay'))) {
    historyModal.style.display = 'none';
  }
  
  const basketModal = document.getElementById('basketModal');
  if (basketModal && (event.target === basketModal || event.target.classList.contains('modal-overlay'))) {
    basketModal.style.display = 'none';
  }
};

function showAlert(message) {
  const textEl = document.getElementById('alertText');
  if (textEl) textEl.textContent = message;
  const modal = document.getElementById('alertModal');
  if (modal) {
    modal.style.display = 'flex';
    const content = modal.querySelector('.modal-content');
    if (content) {
      content.classList.remove('shake-error');
      void content.offsetWidth;
      content.classList.add('shake-error');
    }
  }
}

function closeAlert() {
  const modal = document.getElementById('alertModal');
  if (modal) modal.style.display = 'none';
}

function submitPhone() {
  const input = document.getElementById('promptPhone');
  const phone = input ? input.value.trim() : "";
  const modal = document.getElementById('phoneModal');
  if (modal) modal.style.display = 'none';
  executeTelegramSend(phone);
}

function cancelPhone() {
  const modal = document.getElementById('phoneModal');
  if (modal) modal.style.display = 'none';
  executeTelegramSend("");
}

function executeTelegramSend(phone) {
  const btn = document.getElementById('basketOrderBtn');
  if (btn) btn.classList.add('btn-loading');

  setTimeout(() => {
    if (currentTelegramType === 'basket') {
      doSendBasketToTelegram(phone);
    } else if (currentTelegramType === 'single') {
      doSendToTelegram(phone);
    }
    currentTelegramType = null;
    
    if (btn) btn.classList.remove('btn-loading');
    
    if (document.getElementById('promptPhone')) {
      document.getElementById('promptPhone').value = "+998 ";
    }
  }, 1200); // 1.2 soniya animatsiya uchun
}

function initPhoneInput(id) {
  const input = document.getElementById(id);
  if (!input) return;

  // Boshlang'ich qiymat
  if (!input.value || !input.value.startsWith('+998 ')) {
    input.value = "+998 ";
  }

  input.addEventListener('input', function(e) {
    let value = input.value;
    
    // Prefix o'chib ketishini oldini olish
    if (!value.startsWith('+998 ')) {
      input.value = "+998 " + value.replace(/^\+998\s*/, '');
    }

    // +998 dan keyingi raqamlarni olish
    let numbers = input.value.slice(5).replace(/\D/g, '');

    // Smart paste: Agar buferda 998901234567 bo'lsa
    if (numbers.startsWith('998') && numbers.length > 9) {
      numbers = numbers.slice(3); // 998 ni olib tashlaymiz
    }

    numbers = numbers.slice(0, 9); // Max 9 ta raqam (90 123 45 67)

    // Formatlash: +998 XX XXX XX XX
    let formatted = "+998 ";
    if (numbers.length > 0) {
      formatted += numbers.slice(0, 2);
    }
    if (numbers.length > 2) {
      formatted += " " + numbers.slice(2, 5);
    }
    if (numbers.length > 5) {
      formatted += " " + numbers.slice(5, 7);
    }
    if (numbers.length > 7) {
      formatted += " " + numbers.slice(7, 9);
    }

    input.value = formatted;
  });

  // Backspace bosganda +998 ni o'chirib yubormaslik
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Backspace' && input.value.length <= 5) {
      e.preventDefault();
    }
  });
}


document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
  }
});

// --- Profil Mantiqi ---
function renderProfile() {
  const container = document.getElementById('cabinetProfileSection');
  if (!container) return;

  const user = JSON.parse(localStorage.getItem('fbookUser') || 'null');

  if (user) {
    // Kirilgan holat
    const initials = user.name.charAt(0).toUpperCase();
    container.innerHTML = `
      <div class="profile-card">
        <div class="profile-main-row">
          <div class="profile-avatar">${initials}</div>
          <div class="profile-details">
            <div class="profile-name">${user.name}</div>
            <div class="profile-phone">${user.phone}</div>
          </div>
          <button class="profile-edit-trigger" onclick="editProfile()" title="Tahrirlash">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          </button>
        </div>
        <button class="profile-logout-btn" onclick="logoutProfile()">Chiqish 👋</button>
      </div>
    `;
  } else {
    // Kirilmagan holat
    container.innerHTML = `
      <button class="login-prompt-btn" onclick="showModal('profile')">
        <span>👤</span> Profilga kirish
      </button>
    `;
  }
}

function saveProfile() {
  const name = document.getElementById('profileName').value.trim();
  const phone = document.getElementById('profilePhone').value.trim();

  if (!name || !phone) {
    showAlert("Iltimos, ismingiz va telefoningizni kiriting!");
    return;
  }

  const user = { name, phone };
  localStorage.setItem('fbookUser', JSON.stringify(user));
  
  closeModal('profile');
  renderProfile();
  showToast("✅ Profil saqlandi!");
}

function logoutProfile() {
  showConfirmModal("Profilni o'chirib, tizimdan chiqasizmi?", () => {
    localStorage.removeItem('fbookUser');
    renderProfile();
    showToast("👋 Tizimdan chiqildi");
  });
}

function editProfile() {
  const user = JSON.parse(localStorage.getItem('fbookUser') || 'null');
  if (user) {
    document.getElementById('profileName').value = user.name;
    document.getElementById('profilePhone').value = user.phone;
    // navigateTo('calculator'); // Ixtiyoriy: Kabinetda turib tahrirlayverishi mumkin
    showModal('profile');  // Haqiqiy modalni ochish
  }
}


document.addEventListener('DOMContentLoaded', () => {
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark');
    const menuIcon = document.getElementById('darkModeIconMenu');
    if (menuIcon) menuIcon.textContent = '☀️';
  }

  // Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .catch(err => { /* SW failed */ });
    });
  }

  korsatmaChiqar();
  renderHistory();
  updateBasketBadge();
  initPhoneInput('promptPhone');
  initPhoneInput('profilePhone');
  renderProfile(); // Profilni yuklash

  ['tarif','format','muqova','rang'].forEach(type => {
    const sel = document.getElementById(type);
    if (!sel) return;
    const val = sel.value;
    const btn = document.getElementById(type + 'Btn');
    const valueEl = document.getElementById(type + 'Value');
    if (val) {
      if (btn) btn.classList.add('filled');
      if (valueEl) valueEl.textContent = val;
    }
  });

  // Odatiy holatda "Standart" tarifini tanlab qo'yish
  const tarifSel = document.getElementById('tarif');
  if (tarifSel && tarifSel.value === "") {
    selectOption('tarif', 'Standart');
  }

  const sahifaEl = document.getElementById('sahifa');
  let historyTimer = null;
  if (sahifaEl) {
    sahifaEl.addEventListener('input', () => {
      updatePrice();
      clearTimeout(historyTimer);
      historyTimer = setTimeout(() => {
        const result = updatePrice();
        if (result) saveToHistory(result);
      }, 800);
    });
    // Auto-fix empty or 0 on blur
    sahifaEl.addEventListener('blur', () => {
      if (sahifaEl.value === "" || parseInt(sahifaEl.value) < 1) {
        // if empty user might still be thinking, but let's keep it healthy
      }
      updatePrice();
    });
  }

  const ksInputEl = document.getElementById('kitobSoni');
  if (ksInputEl) {
    ksInputEl.addEventListener('blur', () => {
      if (ksInputEl.value === "" || parseInt(ksInputEl.value) < 1) {
        ksInputEl.value = "1";
        updatePrice();
      }
    });
  }

  ['tarif','format','muqova','rang'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => {
      if (id === 'tarif') korsatmaChiqar();
      updatePrice();
    });
  });

  const knEl = document.getElementById('kitobNomi');
  if (knEl) {
    knEl.addEventListener('input', () => {
      clearTimeout(historyTimer);
      historyTimer = setTimeout(() => {
        const result = updatePrice();
        if (result) saveToHistory(result);
      }, 1000);
    });
  }

  // Oxirgi hisoblar modal: overlay div ga click qo'shish
  const histOverlay = document.querySelector('#historyModal .modal-overlay');
  if (histOverlay) {
    histOverlay.addEventListener('click', function() {
      document.getElementById('historyModal').style.display = 'none';
    });
  }

  updatePrice();
  toggleClearBtnState();
});

const messages = [
  { text: "Eng arzon va sifatli chop etish", class: "", isLink: false },
  { text: "Telegram orqali buyurtma bering", class: "telegram", isLink: true, href: "https://t.me/FbookMED1" }
];
let msgIndex = 0;

function rotateScrollingText() {
  msgIndex = (msgIndex + 1) % messages.length;
  const current = messages[msgIndex];
  const oldElem = document.getElementById("scrollingText");
  if (!oldElem) return;
  const newElem = document.createElement(current.isLink ? "a" : "div");
  newElem.id = "scrollingText";
  newElem.className = "scrolling-text " + (current.class || "");
  newElem.textContent = current.text;
  if (current.isLink) {
    newElem.href = current.href;
    newElem.target = "_blank";
    newElem.style.textDecoration = "none";
    newElem.style.color = "inherit";
    newElem.style.fontWeight = "800";
  }
  oldElem.replaceWith(newElem);
}
setInterval(rotateScrollingText, 20000);

function showToast(message, duration = 2500) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => {
      if (toast.parentNode === container) {
        container.removeChild(toast);
      }
    }, 300);
  }, duration);
}

// ==========================================
// Admin Panel Functions
// ==========================================
function checkAdminPassword() {
  const pwd = document.getElementById('adminPassword').value;
  if (pwd === 'fbook2026') {
    document.getElementById('adminPassword').value = '';
    closeModal('adminAuth');
    navigateTo('admin');
  } else {
    showAlert("Parol noto'g'ri!");
  }
}

document.getElementById('adminProdFile')?.addEventListener('change', function(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(evt) {
      document.getElementById('adminProdFile').setAttribute('data-base64', evt.target.result);
    };
    reader.readAsDataURL(file);
  } else {
    document.getElementById('adminProdFile').removeAttribute('data-base64');
  }
});

function getProductImage() {
  const fileInput = document.getElementById('adminProdFile');
  const linkInput = document.getElementById('adminProdLink');
  
  if (fileInput && fileInput.getAttribute('data-base64')) {
    return fileInput.getAttribute('data-base64');
  }
  if (linkInput && linkInput.value.trim() !== '') {
    return linkInput.value.trim();
  }
  return 'logo.png';
}

async function saveAdminProduct() {
  const name = document.getElementById('adminProdName').value.trim();
  const price = document.getElementById('adminProdPrice').value.trim();
  const category = document.getElementById('adminProdCategory').value.trim();
  const desc = document.getElementById('adminProdDesc').value.trim();
  const editId = document.getElementById('adminEditId').value;
  
  if (!name || !price || !category) {
    showAlert("Iltimos, nom, narx va kategoriyani kiriting!");
    return;
  }
  
  document.getElementById('adminProdName').disabled = true; // Qotib turish uchun
  
  const imgUrl = getProductImage();
  const prodObj = {
    id: editId || null,
    name: name,
    price: parseInt(price),
    category: category,
    desc: desc,
    image: imgUrl
  };
  
  await DataService.saveProduct(prodObj);
  fbookProducts = await DataService.fetchProducts(); // yangilaymiz
  
  document.getElementById('adminProdName').disabled = false;
  
  resetAdminForm();
  renderAdminProducts();
  showToast("✅ Mahsulot saqlandi!");
}

function resetAdminForm() {
  if(document.getElementById('adminProdName')) {
    document.getElementById('adminProdName').value = '';
    document.getElementById('adminProdPrice').value = '';
    document.getElementById('adminProdCategory').value = 'Kitoblar';
    document.getElementById('adminProdDesc').value = '';
    document.getElementById('adminProdLink').value = '';
    const fileInput = document.getElementById('adminProdFile');
    if (fileInput) {
      fileInput.value = '';
      fileInput.removeAttribute('data-base64');
    }
    document.getElementById('adminEditId').value = '';
  }
}

function deleteAdminProduct(id) {
  showConfirmModal("Buni haqiqatan o'chirmoqchimisiz?", async () => {
    await DataService.deleteProduct(id);
    fbookProducts = await DataService.fetchProducts();
    renderAdminProducts();
    showToast("🗑 Mahsulot o'chirildi");
  });
}

function editAdminProduct(id) {
  const prod = fbookProducts.find(p => p.id === id);
  if (prod) {
    document.getElementById('adminProdName').value = prod.name;
    document.getElementById('adminProdPrice').value = prod.price;
    document.getElementById('adminProdCategory').value = prod.category || 'Kitoblar';
    document.getElementById('adminProdDesc').value = prod.desc || '';
    document.getElementById('adminEditId').value = prod.id;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function renderAdminProducts() {
  const container = document.getElementById('adminProductsContainer');
  const countSpan = document.getElementById('adminProdCount');
  if (!container) return;
  
  countSpan.textContent = fbookProducts.length;
  container.innerHTML = '';
  
  if (fbookProducts.length === 0) {
    container.innerHTML = '<div style="text-align:center; padding:15px; opacity:0.6;">Hozircha mahsulot yo\'q</div>';
    return;
  }
  
  const fragment = document.createDocumentFragment();
  fbookProducts.forEach(prod => {
    const div = document.createElement('div');
    div.className = 'admin-list-item';
    div.innerHTML = `
      <img src="${escapeHTML(prod.image)}" alt="img" />
      <div class="admin-list-info">
        <div class="admin-list-title">${escapeHTML(prod.name)}</div>
        <div class="admin-list-price">${prod.price.toLocaleString()} so'm</div>
      </div>
      <div class="admin-list-actions">
        <button onclick="editAdminProduct(${prod.id})">✏️</button>
        <button class="del-btn" onclick="deleteAdminProduct(${prod.id})">🗑</button>
      </div>
    `;
    fragment.appendChild(div);
  });
  
  container.appendChild(fragment);
}

// ==========================================
// Market View Functions
// ==========================================
function renderMarket() {
  const grid = document.getElementById('marketGrid');
  if (!grid) return;
  
  grid.innerHTML = '';
  if (fbookProducts.length === 0) {
    grid.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px 20px; opacity:0.7;">Market vaqtinchalik bo\'sh. Kuting, tovarlar qo\'shiladi.</div>';
    return;
  }
  
  const fragment = document.createDocumentFragment();
  fbookProducts.forEach(prod => {
    const div = document.createElement('div');
    div.className = 'market-card';
    div.innerHTML = `
      <div class="market-img-wrap" onclick="showProductDetails(${prod.id})">
        <img src="${escapeHTML(prod.image)}" alt="Img" loading="lazy" />
      </div>
      <div class="market-cat">${escapeHTML(prod.category || 'Kategoriya')}</div>
      <div class="market-title">${escapeHTML(prod.name)}</div>
      <div class="market-price">${prod.price.toLocaleString()} s.</div>
      <button class="btn-add-tomarket" onclick="addToBasketFromMarket(${prod.id}, event)">Savatchaga</button>
    `;
    fragment.appendChild(div);
  });
  
  grid.appendChild(fragment);
}

function showProductDetails(id) {
  const prod = fbookProducts.find(p => p.id === id);
  if (!prod) return;
  
  document.getElementById('productModalImg').src = prod.image;
  document.getElementById('productModalTitle').textContent = prod.name;
  document.getElementById('productModalCategory').textContent = prod.category || 'Kategoriya';
  document.getElementById('productModalPrice').textContent = prod.price.toLocaleString() + " so'm";
  document.getElementById('productModalDesc').innerHTML = escapeHTML(prod.desc || 'Tavsif kiritilmagan.').replace(/\\n/g, '<br>');
  
  const addBtn = document.getElementById('productModalAddBtn');
  addBtn.onclick = () => {
    addToBasketFromMarket(id);
    closeModal('product');
  };
  
  showModal('product');
}

function addToBasketFromMarket(id, event) {
  if (event) event.stopPropagation();
  triggerHaptic();
  
  const prod = fbookProducts.find(p => p.id === id);
  if (!prod) return;
  
  const existing = basket.find(b => b.type === 'market' && b.prodId === id);
  if (existing) {
    existing.kitobSoni += 1;
    existing.totalPrice = existing.unitPrice * existing.kitobSoni;
  } else {
    basket.push({
      id: Date.now(),
      type: 'market',
      prodId: id,
      kitobNomi: prod.name,
      category: prod.category || 'Katalog',
      kitobSoni: 1,
      unitPrice: prod.price,
      totalPrice: prod.price,
      price: prod.price.toLocaleString() + " so'm"
    });
  }
  
  setStorage('calcBasket', basket);
  updateBasketBadge();
  showToast("✅ Savatga qo'shildi!");
  
  if (event && event.target) {
    const btn = event.target;
    btn.classList.add('added');
    const oldHtml = btn.innerHTML;
    btn.innerHTML = '✅ Labbay!';
    setTimeout(() => {
      btn.classList.remove('added');
      btn.innerHTML = oldHtml;
    }, 1500);
  }
}

// Initial render Market on load
async function loadInitialData() {
  try {
    fbookProducts = await DataService.fetchProducts();
  } catch (err) {
    console.error("Failed to fetch products:", err);
    fbookProducts = [];
  }
  renderMarket();
  const adminViewMatch = document.getElementById('adminProductsContainer');
  if (adminViewMatch) {
     renderAdminProducts();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadInitialData();
});
