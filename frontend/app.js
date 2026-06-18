// Minimal Aptos wallet + custom Move module UI for Cedra token

const MODULE_ADDRESS = '0xWallet'; // replace at runtime if needed
const MODULE_NAME = 'Wallet::My_Wallet';
const STRUCT_WALLET = 'Wallet';
const STRUCT_CEDRA = 'Cedra';

const client = new aptos.AptosClient('https://fullnode.mainnet.aptoslabs.com/v1');
let wallet = null; // Petra / Any Wallet adapter via window.aptos

const $ = (id) => document.getElementById(id);
const addressEl = $('address');
const balanceEl = $('balance');
const toEl = $('to');
const amountEl = $('amount');
const txStatusEl = $('tx-status');

const btnConnect = $('btn-connect');
const btnRefresh = $('btn-refresh');
const btnSend = $('btn-send');

async function ensureWallet() {
  if (wallet) return wallet;
  if (window.aptos && typeof window.aptos.connect === 'function') {
    wallet = window.aptos;
    return wallet;
  }
  throw new Error('Не знайдено сумісного гаманця Aptos (наприклад, Petra).');
}

async function connectWallet() {
  const w = await ensureWallet();
  const res = await w.connect();
  addressEl.textContent = res.address;
  await publishIfNeeded(res.address);
  updateQr(res.address);
  await refreshBalance();
}

function cedraWalletTypeTag() {
  return `${MODULE_ADDRESS}::${MODULE_NAME}::${STRUCT_WALLET}<${MODULE_ADDRESS}::${MODULE_NAME}::${STRUCT_CEDRA}>`;
}

async function resourceExists(addr) {
  try {
    const res = await client.getAccountResource(addr, cedraWalletTypeTag());
    return Boolean(res);
  } catch (e) {
    return false;
  }
}

async function publishIfNeeded(addr) {
  const exists = await resourceExists(addr);
  if (exists) return;
  const w = await ensureWallet();
  const payload = {
    type: 'entry_function_payload',
    function: `${MODULE_ADDRESS}::${MODULE_NAME}::publish_balance_cedra`,
    type_arguments: [],
    arguments: []
  };
  await w.signAndSubmitTransaction({ payload });
  await waitForLastTxn();
}

async function waitForLastTxn() {
  const w = await ensureWallet();
  const pending = await w.signAndSubmitTransaction.lastSubmittedTransaction;
  // Fallback: simply wait small delay
  await new Promise((r) => setTimeout(r, 2000));
}

async function refreshBalance() {
  try {
    const addr = addressEl.textContent;
    if (!addr || addr === '—') return;
    const res = await client.getAccountResource(addr, cedraWalletTypeTag());
    const value = res.data.token.value || 0;
    balanceEl.textContent = String(value);
  } catch (e) {
    balanceEl.textContent = '0';
  }
}

async function sendCedra() {
  txStatusEl.textContent = '';
  try {
    const w = await ensureWallet();
    const to = toEl.value.trim();
    const amount = parseInt(amountEl.value, 10) || 0;
    if (!to || amount <= 0) throw new Error('Введіть адресу та суму.');
    const payload = {
      type: 'entry_function_payload',
      function: `${MODULE_ADDRESS}::${MODULE_NAME}::transfer_cedra`,
      type_arguments: [],
      arguments: [to, amount]
    };
    const tx = await w.signAndSubmitTransaction({ payload });
    txStatusEl.textContent = 'Надсилання...';
    await client.waitForTransaction(tx.hash);
    txStatusEl.textContent = 'Готово ✅';
    await refreshBalance();
  } catch (e) {
    txStatusEl.textContent = `Помилка: ${e.message || e}`;
  }
}

function updateQr(address) {
  try {
    const canvas = document.getElementById('qrcode');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // simple text QR via library if available
    if (window.QRCodeStyling) {
      const qr = new window.QRCodeStyling({
        width: 220,
        height: 220,
        data: address,
        dotsOptions: { color: '#0b2c6a' },
        backgroundOptions: { color: '#ffffff' }
      });
      qr.append(canvas.parentElement); // library appends element; ensure not duplicated
      // Prevent duplicates: remove canvas element since lib appends its own
      canvas.remove();
    } else {
      ctx.fillStyle = '#999';
      ctx.fillText(address, 10, 110);
    }
  } catch {}
}

btnConnect.addEventListener('click', connectWallet);
btnRefresh.addEventListener('click', refreshBalance);
btnSend.addEventListener('click', sendCedra);

// Auto-init if wallet is already connected
(async () => {
  try {
    if (window.aptos && (await window.aptos.isConnected?.())) {
      wallet = window.aptos;
      const addr = await wallet.account().then((a)=>a.address);
      addressEl.textContent = addr;
      await publishIfNeeded(addr);
      updateQr(addr);
      await refreshBalance();
    }
  } catch {}
})();

