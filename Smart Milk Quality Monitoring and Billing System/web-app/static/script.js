// script.js
// Keeps the same localStorage keys so existing data remainsaccessible.
const STORAGE_KEY = "milkRecords_v6";
const USERS_KEY = "milkUsers_v6";
let records = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let users = JSON.parse(localStorage.getItem(USERS_KEY) ||
JSON.stringify({ "admin": { pass: "admin123", email:"admin@example.com" } }));
let currentUser = null;
let currentRole = null;
// EmailJS placeholders — replace these with your values
const EMAILJS_USER = 'YOUR_EMAILJS_PUBLIC_KEY';
const EMAILJS_SERVICE = 'YOUR_SERVICE_ID';
const EMAILJS_TEMPLATE = 'YOUR_TEMPLATE_ID';
let emailjsInitialized = false;
// --- Helpers ---
function formatDate(d = new Date()) { returnd.toLocaleDateString(); }
function rateForQuality(q) { return q === "Excellent" ? 70 : q ==="Good" ? 60 : q === "Average" ? 50 : q === "Poor" ? 40 : 0; }
function saveAll() { localStorage.setItem(STORAGE_KEY,JSON.stringify(records)); }
function saveUsers() { localStorage.setItem(USERS_KEY,JSON.stringify(users)); }
function showMessage(msg, elId = 'message', timeout = 3000) {
const node = document.getElementById(elId);
if (!node) return;
node.innerText = msg;
if (timeout > 0) {
setTimeout(() => { if (node) node.innerText = ''; }, timeout);
}
}
// initialize EmailJS (when needed)
function initEmailJs() {
if (window.emailjs && !emailjsInitialized && EMAILJS_USER !=='YOUR_EMAILJS_PUBLIC_KEY') {
try { emailjs.init(EMAILJS_USER); emailjsInitialized = true; }
catch (e) { console.warn('EmailJS init failed', e); }
}
}
// ----------------- Records -----------------
function addRecord(provider, quality, quantity, isReject = false) {
const rate = isReject ? 0 : rateForQuality(quality);
const total = isReject ? 0 : rate * quantity;
const rec = {
id: Date.now().toString(),
date: formatDate(),
dateISO: new Date().toISOString(),
provider,
quality: isReject ? "Rejected" : quality,
rate,
quantity,
total,
reject: !!isReject
};
records.push(rec);
saveAll();
displayRecords();
showMessage(isReject ? "Rejected record saved!" : "Recordsaved!");
return rec;
}
// ----------------- Rendering -----------------
function displayRecords() {
const tbody = document.querySelector('#recordsTable tbody');
tbody.innerHTML = '';
const viewRecords = (currentRole === "provider") ? records.filter(r=> r.provider === currentUser) : records;
let total = 0;
const monthlyMap = {}; // { 'YYYY-MM' : amount }
viewRecords.forEach(r => {
const tr = document.createElement('tr');
if (r.reject) tr.classList.add("reject-row");
const actionsHTML = (currentRole === 'admin')
? `<div class="row-gap" style="justify-content:center">
<button onclick="delRecord('${r.id}')">Del</button>
<button onclick="editRecord('${r.id}')">Edit</button>
</div>`
: '-';
tr.innerHTML = `
<td>${r.date}</td>
<td>${r.provider}</td>
<td>${r.quality}</td>
<td>₹${r.rate}</td>
<td>${r.quantity}</td>
<td>₹${r.total}</td>
<td>${actionsHTML}</td>
`;
tbody.appendChild(tr);
if (!r.reject) {
total += Number(r.total) || 0;
const d = new Date(r.dateISO);
const key = `${d.getFullYear()}-${String(d.getMonth() +
1).padStart(2, '0')}`; // YYYY-MM
monthlyMap[key] = (monthlyMap[key] || 0) + Number(r.total ||
0);
}
});
// Toggle UI pieces depending on role
if (currentRole === "provider") {
document.getElementById("provBalance").style.display = "block";
document.getElementById("provBalance").innerText = "YourBalance: ₹" + total.toFixed(2);
document.getElementById("balance").style.display = "none";
document.getElementById("adminSettings").style.display =
"none";
document.getElementById("exportBtns").style.display = "none";
// providerName prefilled & readonly
const provInput = document.getElementById('providerName');
if (provInput) { provInput.value = currentUser || '';
provInput.readOnly = true; }
} else {
document.getElementById("balance").innerText = "Total Balance:₹" + total.toFixed(2);
document.getElementById("provBalance").style.display = "none";
document.getElementById("adminSettings").style.display =
"block";
document.getElementById("exportBtns").style.display = "flex";
const provInput = document.getElementById('providerName');
if (provInput) provInput.readOnly = false;
}
// Build and render monthly progress bars
const sortedKeys = Object.keys(monthlyMap).sort();
const labels = sortedKeys.map(k => {
const d = new Date(k + '-01');
return d.toLocaleString(undefined, { month: 'short', year:
'numeric' });
});
const data = sortedKeys.map(k => monthlyMap[k]);
renderMonthlyProgress(labels, data);
}
function renderMonthlyProgress(labels, data) {
const container = document.getElementById('monthlyProgress');
container.innerHTML = '';
if (!labels.length) {
container.innerHTML = '<p class="muted">No monthly data yet.</p>';
return;
}
// find max positive value for scale
const maxPositive = Math.max(...data.map(v => v > 0 ? v : 0), 1);
labels.forEach((label, i) => {
const val = data[i] || 0;
const pct = val > 0 ? Math.round((val / maxPositive) * 100) : 0;
const row = document.createElement('div');
row.className = 'progress-row';
const formatted = (val < 0) ? `−₹${Math.abs(val).toFixed(2)}` : `₹
${val.toFixed(2)}`;
row.innerHTML = `
<div class="progress-label">${label}</div>
<div class="progress-wrap">
<div class="progress-bar">
<div class="progress-fill ${val < 0 ? 'negative' : ''}"
style="width: ${pct}%"></div>
</div>
</div>
<div class="progress-num">${formatted}</div>
`;
container.appendChild(row);
});
}
// ----------------- Admin actions (exposed) -----------------
window.delRecord = function (id) {
if (!confirm('Delete this record?')) return;
records = records.filter(r => r.id !== id);
saveAll(); displayRecords();
};
window.editRecord = function (id) {
const r = records.find(x => x.id === id);
if (!r) return;
if (r.reject) return alert("Rejected record cannot be edited!");
const newQty = prompt('Change quantity (L)', r.quantity);
if (newQty !== null) {
r.quantity = parseFloat(newQty) || 0;
r.total = r.rate * r.quantity;
saveAll(); displayRecords();
}
};
// ----------------- Email send for a saved record -----------------
function sendRecordEmail(rec) {
initEmailJs();
const params = {
provider_name: rec.provider,
date: rec.date,
quality: rec.quality,
quantity: rec.quantity,
total: rec.total
};
if (window.emailjs && EMAILJS_USER !==
'YOUR_EMAILJS_PUBLIC_KEY') {
// Make sure initialized
try {
if (!emailjsInitialized) emailjs.init(EMAILJS_USER);
emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, params)
.then(() => showMessage('Email sent'))
.catch(err => { console.warn('Email send failed', err);
showMessage('Email failed'); });
} catch (e) {
console.warn('EmailJS send error', e);
console.log('EMAIL-SIM', params);
showMessage('Email not sent - EmailJS error');
}
} else {
console.log('EMAIL-SIM (not configured):', params);
showMessage('Saved (email not sent — configure EmailJS inscript.js).');
}
}
// ----------------- Event listeners / UI wiring -----------------
document.getElementById('saveBtn').onclick = () => {
let prov =
document.getElementById("providerName").value.trim();
const q = document.getElementById("quality").value;
const qty =
parseFloat(document.getElementById("quantity").value) || 0;
if (currentRole === 'provider') prov = currentUser || prov;
if (!prov) return alert("Enter provider!");
if (qty <= 0) return alert("Enter valid quantity!");
const rec = addRecord(prov, q, qty, false);
// send email for this record
sendRecordEmail(rec);
};
document.getElementById('saveLocalBtn').onclick = () => {
let prov =
document.getElementById("providerName").value.trim();
const q = document.getElementById("quality").value;
const qty =
parseFloat(document.getElementById("quantity").value) || 0;
if (currentRole === 'provider') prov = currentUser || prov;
if (!prov) return alert("Enter provider!");
if (qty <= 0) return alert("Enter valid quantity!");
addRecord(prov, q, qty, false);
showMessage('Saved locally only');
};
document.getElementById('markRejectBtn').onclick = () => {
let prov =
document.getElementById("providerName").value.trim();
if (currentRole === 'provider') prov = currentUser || prov;
if (!prov) return alert("Enter provider name first!");
addRecord(prov, "Poor", 0, true);
};
document.getElementById('fetchESPBtn').onclick = async () => {
try {
const endpoint = 'http://10.247.97.8:5000/quality';
const res = await fetch(endpoint, { cache: 'no-store' });
let q;
try { const js = await res.json(); q = js.quality || js.q || js.status; }
catch (e) { q = (await res.text()).trim(); }
if (!q) throw new Error('No quality returned');
q = q.charAt(0).toUpperCase() + q.slice(1).toLowerCase();
document.getElementById('quality').value = q;
applyQualityTheme(q);
showMessage('Fetched quality: ' + q, 'message');
} catch (e) {
alert('ESP8266 not reachable or CORS blocked. Ensure device ison same network and returns Access-Control-Allow-Origin: *');
}
};
document.getElementById('quality').addEventListener('change',
(e)=> applyQualityTheme(e.target.value));
function applyQualityTheme(q) {
if (q && q.toLowerCase() === 'poor') {
document.body.classList.add('poor-theme');
document.getElementById('rejectBanner').style.display = 'block';
} else {
document.body.classList.remove('poor-theme');
document.getElementById('rejectBanner').style.display = 'none';
}
}
// ----------------- Login & providers -----------------
document.getElementById('loginBtn').onclick = () => {
const role = document.getElementById('roleSelect').value;
const user = document.getElementById('loginUser').value.trim();
const pass = document.getElementById('loginPass').value.trim();
if (role === 'admin') {
if (users['admin'] && pass === users['admin'].pass) {
currentUser = 'admin'; currentRole = 'admin';
document.getElementById('loginScreen').style.display = 'none';
document.getElementById('app').style.display = 'grid';
document.getElementById('adminSection').style.display =
'block';
document.getElementById('adminSettings').style.display =
'block';
displayRecords();
refreshProviderList();
} else {
showMessage('Wrong admin password!', 'loginMsg');
}
} else {
if (users[user] && pass === users[user].pass) {
currentUser = user; currentRole = 'provider';
document.getElementById('loginScreen').style.display = 'none';
document.getElementById('app').style.display = 'grid';
document.getElementById('adminSection').style.display =
'block';
document.getElementById('adminSettings').style.display =
'none';
displayRecords();
} else {
showMessage('Wrong provider credentials!', 'loginMsg');
}
}
};
// ----------------- Provider management (admin) -----------------
document.getElementById('addProviderBtn').onclick = () => {
const n = document.getElementById('newProvName').value.trim();
const p = document.getElementById('newProvPass').value.trim();
const e = document.getElementById('newProvEmail').value.trim();
if (!n || !p) { alert('Enter provider and password'); return; }
if (n === 'admin') { alert('Cannot use "admin" as provider name');
return; }
users[n] = { pass: p, email: e };
saveUsers();
refreshProviderList();
document.getElementById('newProvName').value = '';
document.getElementById('newProvPass').value = '';
document.getElementById('newProvEmail').value = '';
};
document.getElementById('sendWelcomeBtn').onclick = () => {
const n = document.getElementById('newProvName').value.trim();
const p = document.getElementById('newProvPass').value.trim();
const e = document.getElementById('newProvEmail').value.trim();
if (!n || !p) { showMessage('Enter provider name & password');
return; }
// add provider
users[n] = { pass: p, email: e };
saveUsers();
refreshProviderList();
document.getElementById('newProvName').value = '';
document.getElementById('newProvPass').value = '';
document.getElementById('newProvEmail').value = '';
// send welcome
if (e) sendWelcomeEmail(n, e);
};
function refreshProviderList() {
const ul = document.getElementById('provList');
if (!ul) return;
ul.innerHTML = '';
Object.keys(users).forEach(u => {
if (u !== 'admin') {
const li = document.createElement('li');
li.innerHTML = `${u} (${users[u].email || 'no email'}) <button
onclick="deleteProvider('${u}')">Delete</button>`;
ul.appendChild(li);
}
});
}
window.deleteProvider = function (name) {
if (!confirm('Delete provider and their records?')) return;
records = records.filter(r => r.provider !== name);
delete users[name];
saveAll(); saveUsers();
refreshProviderList(); displayRecords();
};
function sendWelcomeEmail(name, email) {
initEmailJs();
const params = { provider_name: name, provider_email: email,
welcome_msg: 'Welcome to the milk collection system.' };
if (window.emailjs && EMAILJS_USER !==
'YOUR_EMAILJS_PUBLIC_KEY') {
emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, params)
.then(() => showMessage('Welcome email sent'))
.catch(e => { console.warn(e); showMessage('Welcome emailfailed'); });
} else {
console.log('EMAIL-WELCOME(sim):', params);
showMessage('Welcome email not sent - configure EmailJSkeys.');
}
}
//date
function formatDate(d = new Date()) {
// ✅ Always return system date
return d.toLocaleDateString(undefined, { year: 'numeric', month:
'2-digit', day: '2-digit' });
}
function rateForQuality(q){ return q==="Excellent"?70:q==="Good"?
60:q==="Average"?50:q==="Poor"?40:0;}
function saveAll(){ localStorage.setItem(STORAGE_KEY,
JSON.stringify(records)); }
function saveUsers(){ localStorage.setItem(USERS_KEY,
JSON.stringify(users)); }
function showMessage(msg, el='message'){ const
node=document.getElementById(el); if(!node)return;
node.innerText=msg; setTimeout(()=>{ if(node)node.innerText='';
},3000); }

// ----------------- Deduct & Export -----------------
document.getElementById('deductBtn').onclick = () => {
const name =
document.getElementById('deductProv').value.trim();
const amt =
parseFloat(document.getElementById('deductAmt').value);
if (!users[name]) return alert('Provider not found');
const bal = records.filter(r => r.provider === name &&
!r.reject).reduce((s, r) => s + r.total, 0);
if (bal < 10) return alert('Balance below 10000, cannot deduct');
records.push({
id: Date.now().toString(),
date: formatDate(),
dateISO: new Date().toISOString(),
provider: name,
quality: 'Deduction',
rate: 0,
quantity: 0,
total: -amt,
reject: false
});
saveAll(); displayRecords(); showMessage('Deducted ₹' + amt + 'from ' + name);
};
document.getElementById('downloadCSVBtn').onclick = () => {
let csv = 'Date,Provider,Quality,Rate,Quantity,Total\n';
records.forEach(r => csv +=
`${r.date},${r.provider},${r.quality},${r.rate},${r.quantity},${r.total
}\n`);
const blob = new Blob([csv], { type: 'text/csv' });
const a = document.createElement('a');
a.href = URL.createObjectURL(blob);
a.download = 'milk.csv';
a.click();
};
document.getElementById('downloadXLSXBtn').onclick = () => {
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(records);
XLSX.utils.book_append_sheet(wb, ws, 'Milk');
XLSX.writeFile(wb, 'milk.xlsx');
};
document.getElementById('downloadPDFBtn').onclick = () => {
const { jsPDF } = window.jspdf;
const doc = new jsPDF();
let y = 10;
records.forEach(r => {
const text = `${r.date} | ${r.provider} | ${r.quality} |
${r.quantity}L | ₹${r.total}`;
doc.text(text, 10, y);
y += 8;
if (y > 280) { doc.addPage(); y = 10; }
});
doc.save('milk.pdf');
};
// ------------- Init -------------
displayRecords();
refreshProviderList();
applyQualityTheme(document.getElementById('quality').value);

