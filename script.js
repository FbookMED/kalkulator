// Dark Mode logic
function toggleDarkMode() {
  document.body.classList.toggle('dark');
  const isDark = document.body.classList.contains('dark');
  localStorage.setItem('darkMode', isDark);
  document.getElementById('darkModeIcon').textContent = isDark ? '☀️' : '🌙';
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
    history = history.slice(0, 5); // Faqat oxirgi 5 ta
  }

  localStorage.setItem('calcHistory', JSON.stringify(history));
  renderHistory();
}

function renderHistory() {
  const container = document.getElementById('historyItems');
  if (!container) return;
  const history = JSON.parse(localStorage.getItem('calcHistory') || '[]');
  container.innerHTML = history.length ? '' : '<div style="font-size:12px;opacity:0.6;">Tarix bo\'sh</div>';
  history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `
      <span>${item.format}, ${item.muqova}, ${item.rang}, ${item.sahifa} bet</span>
      <strong>${item.price}</strong>
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

function setBanner(state, valueText, hintText) {
  const banner = document.getElementById('priceBanner');
  const v = document.getElementById('priceValue');
  if (!banner || !v) return;
  banner.classList.remove('err', 'warn');
  if (state) banner.classList.add(state);
  v.textContent = valueText;
  const hintEl = banner.querySelector('.hint');
  if (hintEl) hintEl.textContent = hintText;

  banner.style.animation = 'none';
  void banner.offsetWidth;
  banner.style.animation = 'pulse 0.35s ease-in-out';
}

function updatePrice() {
  const tarif  = document.getElementById('tarif').value;
  const format = document.getElementById('format').value;
  const muqova = document.getElementById('muqova').value;
  const rang   = document.getElementById('rang').value;
  const sahifaInput = document.getElementById('sahifa');
  
  // Validation: Only positive integers
  if (sahifaInput) {
    sahifaInput.value = sahifaInput.value.replace(/[^0-9]/g, '');
  }
  
  const sahifa = parseInt(sahifaInput ? sahifaInput.value : 0, 10);
  const qogozInfo = document.getElementById('qogoz');
  if (qogozInfo) qogozInfo.innerText = "";

  if (!tarif || !format || !muqova || !rang || isNaN(sahifa) || sahifa <= 0) {
    setBanner('err', '—', "Iltimos, barcha maydonlarni to‘ldiring!");
    return;
  }

  const sahifaNarxi = tarifNarxlar?.[tarif]?.[format]?.[rang];
  const muqovaNarxi = tarifNarxlar?.[tarif]?.[format]?.muqova?.[muqova];

  if (typeof sahifaNarxi !== "number" || typeof muqovaNarxi !== "number") {
    setBanner('err', '—', "Tanlovlarda mos narx topilmadi.");
    return;
  }

  const jami = sahifa * sahifaNarxi + muqovaNarxi;
  const jamiYaxlit = yaxlit1000(jami);
  const priceStr = `${jamiYaxlit.toLocaleString()} so‘m`;

  setBanner('', priceStr, "Natija doimiy yangilanadi");

  let extra = "";
  if (sahifa > 900) extra += "⚠️ Diqqat! Sahifa soni 900 tadan oshib ketdi. ";
  if (format === "A4") extra += "Qog'oz o'lchami – 210×297 mm";
  else if (format === "A5") extra += "Qog'oz o'lchami – 148×210 mm";
  else if (format === "B5") extra += "Qog'oz o'lchami – 176×250 mm";

  if (qogozInfo) qogozInfo.innerText = extra.trim();
  const banner = document.getElementById('priceBanner');
  if (sahifa > 900 && banner) banner.classList.add('warn');

  // Debounce orqali tarixga saqlanadi
  return { tarif, format, muqova, rang, sahifa, price: priceStr };
}

function showHistoryModal() {
  renderHistory(); // Eng yangi ma'lumotni ko'rsatadi
  document.getElementById('historyModal').style.display = 'flex';
}

function showModal(type) {
  const modal = document.getElementById(type + 'Modal');
  if (modal) modal.style.display = 'flex';
}

function selectOption(type, value) {
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
  const area = document.getElementById('captureArea');
  if (!area) return;
  const btn = document.querySelector('.save-btn');
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
  } catch (err) {
    console.error('Snapshot error:', err);
    alert('Rasmni saqlashda xatolik yuz berdi.');
  } finally {
    btn.innerHTML = '📸 Rasm qilib saqlash';
  }
}

window.onclick = function(event) {
  ['tarif','format','muqova','rang'].forEach(type => {
    const modal = document.getElementById(type + 'Modal');
    if (modal && event.target === modal) modal.style.display = 'none';
  });
};

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal').forEach(modal => modal.style.display = 'none');
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // Restore Dark Mode
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark');
    document.getElementById('darkModeIcon').textContent = '☀️';
  }

  korsatmaChiqar();
  renderHistory();

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
