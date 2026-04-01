function triggerHaptic() {
  if (window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(40);
  }
}

// Dark Mode logic
function toggleDarkMode() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('darkMode', isDark);
  
  // Eski ikonka (agar HTMLda qolgan bo'lsa)
  const oldIcon = document.getElementById('darkModeIcon');
  if (oldIcon) oldIcon.textContent = isDark ? '☀️' : '🌙';
  
  // Menyu ichidagi ikonka
  const menuIcon = document.getElementById('darkModeIconMenu');
  if (menuIcon) menuIcon.textContent = isDark ? '☀️' : '🌙';
}

function showModal(id) {
  const m = document.getElementById(id + 'Modal');
  if (m) m.style.display = 'flex';
}

function saveToHistory(data) {
  let history = JSON.parse(localStorage.getItem('calcHistory') || '[]');

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
    if (history.length > 5) history = history.slice(0, 5); // Faqat oxirgi 5 ta
  }

  localStorage.setItem('calcHistory', JSON.stringify(history));
  renderHistory();
}

let basket = JSON.parse(localStorage.getItem('calcBasket') || '[]');

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

function removeFromBasket(id) {
  basket = basket.filter(item => item.id !== id);
  localStorage.setItem('calcBasket', JSON.stringify(basket));
  renderBasket();
  updateBasketBadge();
}

function clearFullBasket() {
  showConfirmModal("Savatdagi barcha kitoblarni o'chirib tashlaysizmi? <br><small style='font-size:12px;opacity:0.75;'>(Ushbu amalni ortga qaytarib bo'lmaydi)</small>", () => {
    basket = [];
    localStorage.removeItem('calcBasket');
    renderBasket();
    updateBasketBadge();
    document.getElementById('basketModal').style.display = 'none';
  });
}

function showBasketModal() {
  renderBasket();
  document.getElementById('basketModal').style.display = 'flex';
}

function renderBasket() {
  const container = document.getElementById('basketItems');
  const totalArea = document.getElementById('basketTotalArea');
  const totalValueEl = document.getElementById('basketTotalValue');
  const orderBtn = document.getElementById('basketOrderBtn');
  const clearBtn = document.getElementById('clearBasketBtn');
  
  if (!container) return;
  
  if (basket.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;opacity:0.6;">Savat bo\'sh</div>';
    if (totalArea) totalArea.style.display = 'none';
    if (orderBtn) orderBtn.style.display = 'none';
    if (clearBtn) clearBtn.style.display = 'none';
    return;
  }

  container.innerHTML = '';
  let totalSum = 0;

  basket.forEach((item, index) => {
    const div = document.createElement('div');
    div.className = 'basket-item';
    
    // String narxdan raqamni ajratib olish (jami yaxlit qiymati kerak)
    // script.js dagi updatePrice da bizda butun son narxlari bor edi, lekin savatda biz string saqladik.
    // Bizga raqam ko'rinishidagi narx ham kerak. updatePrice ni res ob'ektiga `rawPrice` qo'shamiz.
    
    const priceNum = parseInt(item.price.replace(/[^0-9]/g, ''), 10);
    totalSum += priceNum;

    const qismText = item.qismSoni > 1 ? ` (${item.qismSoni} qism)` : '';

    const indexBadge = `<span class="basket-item-index">${index + 1}</span>`;
    const titleText = item.kitobNomi ? item.kitobNomi : `Kitob`;
    const subtitleText = `${item.tarif}, ${item.format}, ${item.muqova}${qismText}, ${item.rang}, ${item.sahifa} bet, ${item.kitobSoni} ta kitob`;

    div.innerHTML = `
      <div class="basket-item-info">
        <span class="basket-item-title">${indexBadge} ${titleText}</span>
        <span class="basket-item-subtitle">${subtitleText}</span>
      </div>
      <div class="basket-item-price">${item.price}</div>
      <button class="remove-basket-item" onclick="removeFromBasket(${item.id})">×</button>
    `;
    container.appendChild(div);
  });

  if (totalArea) {
    totalArea.style.display = 'flex';
    totalValueEl.textContent = totalSum.toLocaleString() + " so'm";
  }
  if (orderBtn) orderBtn.style.display = 'flex';
  if (clearBtn) clearBtn.style.display = 'block';
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

function doSendBasketToTelegram(phone) {
  const user = JSON.parse(localStorage.getItem('fbookUser') || 'null');
  let text = `📦 *YANGI SAVAT BUYURTMASI*\n`;
  
  if (user && user.name) {
    text += `👤 Buyurtmachi: *${user.name}*\n`;
  }
  
  if (phone && phone.trim() !== "") {
    text += `📞 Aloqa: ${phone.trim()}\n`;
  }
  text += `\n`;
  let totalSum = 0;

  basket.forEach((item, index) => {
    const priceNum = parseInt(item.price.replace(/[^0-9]/g, ''), 10);
    totalSum += priceNum;

    const qismText = item.qismSoni > 1 ? ` (${item.qismSoni} qism)` : '';
    const titleStr = item.kitobNomi ? `*${item.kitobNomi}*` : `*${index + 1}-Kitob*`;
    
    text += `${index + 1}. ${titleStr}\n` +
            `   ✨ Tarif: *${item.tarif}*\n` +
            `   📐 *${item.format}*, *${item.muqova}*${qismText}, *${item.rang}*\n` +
            `   📄 *${item.sahifa} bet*, *${item.kitobSoni} ta kitob*\n` +
            `   💸 Narxi: *${item.price}*\n\n`;
  });

  text += `-------------------------\n` +
          `💰 *JAMI: ${totalSum.toLocaleString()} so'm*`;

  const url = `https://t.me/FbookMED1?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');

  // Savat va formani tozalash
  setTimeout(() => {
    basket = [];
    localStorage.removeItem('calcBasket');
    renderBasket();
    updateBasketBadge();
    doResetCalculator(false);
    document.getElementById('basketModal').style.display = 'none';
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
    if (el) el.value = item[id];
    
    // UI (float-value) ni yangilash
    const valEl = document.getElementById(id + 'Value');
    if (valEl) valEl.textContent = item[id];
    
    const btn = document.getElementById(id + 'Btn');
    if (btn) btn.classList.add('filled');
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
  closeHistoryModal();
  updatePrice();
  
  showToast("🔄 Hisob qayta yuklandi");
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
    const titleText = item.kitobNomi ? item.kitobNomi : `${item.format} Kitob`;
    const subtitleText = `${item.tarif}, ${item.muqova}, ${item.rang}, ${item.sahifa} bet${qism}`;

    div.innerHTML = `
      <div class="history-info">
        <span class="history-title">${titleText}</span>
        <span class="history-subtitle">${subtitleText}</span>
      </div>
      <div class="history-actions">
        <div class="history-price">${item.price}</div>
        <button class="restore-history-btn" onclick="restoreFromHistory(${index})" title="Qayta yuklash">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
        </button>
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
  return rem > 550 ? (n + (1000 - rem)) : (n - rem);
}

// Kitob soni +/- tugmalari
function changeKitobSoni(delta) {
  triggerHaptic();
  const input = document.getElementById('kitobSoni');
  let val = parseInt(input.value || 1);
  val = Math.max(1, Math.min(9999, val + delta));
  input.value = val;
  const result = updatePrice();
  if (result) saveToHistory(result);
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
  if (result) saveToHistory(result);
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
  if (!state && valueText !== '—') banner.classList.add('success');

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
  const ids = ['tarif', 'format', 'muqova', 'rang'];
  for (let id of ids) {
    const el = document.getElementById(id);
    if (el && el.value !== "") return true;
  }
  const sahifa = document.getElementById('sahifa');
  if (sahifa && sahifa.value !== "") return true;

  const kitobNomi = document.getElementById('kitobNomi');
  if (kitobNomi && kitobNomi.value !== "") return true;

  const kitobSoni = document.getElementById('kitobSoni');
  if (kitobSoni && kitobSoni.value !== "1") return true;

  const qismSoni = document.getElementById('qismSoniHidden');
  if (qismSoni && qismSoni.value !== "1") return true;

  return false;
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
  
  let text = `🚀 *YANGI BUYURTMA*\n`;
  
  if (user && user.name) {
    text += `👤 Buyurtmachi: *${user.name}*\n`;
  }

  if (phone && phone.trim() !== "") {
    text += `📞 Aloqa: ${phone.trim()}\n`;
  }
  
  const titleStr = res.kitobNomi ? `*${res.kitobNomi}*` : `*1-Kitob*`;
  const qismText = res.qismSoni > 1 ? ` (${res.qismSoni} qism)` : '';

  text += `\n` +
          `📦 ${titleStr}\n` +
          `✨ Tarif: *${res.tarif}*\n` +
          `📐 *${res.format}*, *${res.muqova}*${qismText}, *${res.rang}*\n` +
          `📄 *${res.sahifa} bet*, *${res.kitobSoni} ta kitob*\n\n` +
          `💰 *JAMI: ${res.price}*`;

  const url = `https://t.me/FbookMED1?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank');

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

  let sahifa = parseInt(sahifaInput ? sahifaInput.value : 0, 10);
  if (sahifa > 10000) {
    sahifa = 10000;
    if (sahifaInput) sahifaInput.value = "10000";
  }
  const kitobSoni = parseInt(kitobSoniInput ? kitobSoniInput.value : 1, 10) || 1;

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
  return { tarif, format, muqova, rang, sahifa, kitobSoni, qismSoni, price: priceStr, kitobNomi };
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

function showModal(type) {
  const modal = document.getElementById(type + 'Modal');
  if (modal) modal.style.display = 'flex';
}

function selectOption(type, value) {
  triggerHaptic();
  const sel = document.getElementById(type);
  if (sel) sel.value = value;

  const btn = document.getElementById(type + 'Btn');
  const valueEl = document.getElementById(type + 'Value');
  if (valueEl) valueEl.textContent = value;
  if (btn) btn.classList.add('filled');

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
      backgroundColor: getComputedStyle(document.body).backgroundColor,
      useCORS: true
    });
    const link = document.createElement('a');
    link.download = `FbookMED_Hisob_${new Date().getTime()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    
    // Success feedback
    btn.innerHTML = '✅ Rasm saqlandi';
    btn.style.background = 'linear-gradient(135deg, #2e7d32, #4caf50)';
    setTimeout(() => {
      btn.innerHTML = '📸 Rasm';
      btn.style.background = '';
    }, 2000);
  } catch (err) {
    console.error('Snapshot error:', err);
    showAlert('Rasmni saqlashda xatolik yuz berdi.');
    btn.innerHTML = '📸 Rasm';
  }
}

window.onclick = function(event) {
  ['tarif','format','muqova','rang','confirm','phone','alert'].forEach(type => {
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
  if (modal) modal.style.display = 'flex';
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
  if (currentTelegramType === 'basket') {
    doSendBasketToTelegram(phone);
  } else if (currentTelegramType === 'single') {
    doSendToTelegram(phone);
  }
  currentTelegramType = null;
  if (document.getElementById('promptPhone')) {
    document.getElementById('promptPhone').value = "+998 ";
  }
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
        <div class="profile-avatar">${initials}</div>
        <div class="profile-details">
          <div class="profile-name">${user.name}</div>
          <div class="profile-phone">${user.phone}</div>
          <button class="profile-logout-btn" onclick="logoutProfile()">Chiqish 👋</button>
        </div>
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

function closeModal(type) {
  const modal = document.getElementById(type + 'Modal');
  if (modal) modal.style.display = 'none';
}

document.addEventListener('DOMContentLoaded', () => {
  // Restore Dark Mode
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark');
    const oldIcon = document.getElementById('darkModeIcon');
    if (oldIcon) oldIcon.textContent = '☀️';
    const menuIcon = document.getElementById('darkModeIconMenu');
    if (menuIcon) menuIcon.textContent = '☀️';
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
      updatePrice(); // Narxni darhol yangilaydi
      // Tarixni esa 800ms kutib saqlaydi
      clearTimeout(historyTimer);
      historyTimer = setTimeout(() => {
        const result = updatePrice();
        if (result) saveToHistory(result);
      }, 800);
    });
  }

  ['tarif','format','muqova','rang'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', () => {
      if (id === 'tarif') korsatmaChiqar();
      updatePrice();
    });
  });

  // Oxirgi hisoblar modal: overlay div ga click qo'shish
  const histOverlay = document.querySelector('#historyModal .modal-overlay');
  if (histOverlay) {
    histOverlay.addEventListener('click', function() {
      document.getElementById('historyModal').style.display = 'none';
    });
  }

  updatePrice();
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
setInterval(rotateScrollingText, 10000);

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
