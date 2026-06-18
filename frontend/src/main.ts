import './style.css';
import { AptosClient } from 'aptos';
import QRCodeStyling from 'qr-code-styling';
import { MODULE_ADDRESS, MODULE_NAME, STRUCT_CEDRA, STRUCT_WALLET, NODE_URL } from './config';

type AptosWallet = {
  connect: () => Promise<{ address: string }>;
  isConnected?: () => Promise<boolean>;
  account?: () => Promise<{ address: string }>;
  signAndSubmitTransaction: (args: any) => Promise<{ hash: string }> & { lastSubmittedTransaction?: any };
};

const client = new AptosClient(NODE_URL);
let wallet: AptosWallet | null = null;

const $ = (id: string) => document.getElementById(id)!;
const addressEl = $('address');
const balanceEl = $('balance');
const toEl = $('to') as HTMLInputElement;
const amountEl = $('amount') as HTMLInputElement;
const txStatusEl = $('tx-status');
const btnConnect = $('btn-connect');
const btnRefresh = $('btn-refresh');
const btnSend = $('btn-send');

function cedraWalletTypeTag(): string {
  return `${MODULE_ADDRESS}::${MODULE_NAME}::${STRUCT_WALLET}<${MODULE_ADDRESS}::${MODULE_NAME}::${STRUCT_CEDRA}>`;
}

async function ensureWallet(): Promise<AptosWallet> {
  if (wallet) return wallet;
  const w = (window as any).aptos as AptosWallet | undefined;
  if (!w) throw new Error('Не знайдено сумісного гаманця Aptos (наприклад, Petra).');
  wallet = w;
  return w;
}

async function connectWallet() {
  const w = await ensureWallet();
  const res = await w.connect();
  addressEl.textContent = res.address;
  await publishIfNeeded(res.address);
  updateQr(res.address);
  await refreshBalance();
}

async function resourceExists(addr: string): Promise<boolean> {
  try {
    const res = await client.getAccountResource(addr, cedraWalletTypeTag());
    return Boolean(res);
  } catch {
    return false;
  }
}

async function publishIfNeeded(addr: string) {
  const exists = await resourceExists(addr);
  if (exists) return;
  const w = await ensureWallet();
  const payload = {
    type: 'entry_function_payload',
    function: `${MODULE_ADDRESS}::${MODULE_NAME}::publish_balance_cedra`,
    type_arguments: [] as string[],
    arguments: [] as any[]
  };
  const tx = await w.signAndSubmitTransaction({ payload });
  await client.waitForTransaction(tx.hash);
}

async function refreshBalance() {
  const addr = addressEl.textContent;
  if (!addr || addr === '—') return;
  try {
    const res: any = await client.getAccountResource(addr, cedraWalletTypeTag());
    const value = res.data.token.value ?? 0;
    balanceEl.textContent = String(value);
  } catch {
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
      type_arguments: [] as string[],
      arguments: [to, amount]
    };
    const tx = await w.signAndSubmitTransaction({ payload });
    txStatusEl.textContent = 'Надсилання...';
    await client.waitForTransaction(tx.hash);
    txStatusEl.textContent = 'Готово ✅';
    await refreshBalance();
  } catch (e: any) {
    txStatusEl.textContent = `Помилка: ${e?.message ?? String(e)}`;
  }
}

function updateQr(address: string) {
  const container = document.getElementById('qrcode')?.parentElement as HTMLElement;
  if (!container) return;
  container.querySelectorAll('svg, canvas').forEach((n) => n.remove());
  const qr = new QRCodeStyling({
    width: 220,
    height: 220,
    data: address,
    dotsOptions: { color: '#0b2c6a' },
    backgroundOptions: { color: '#ffffff' }
  });
  qr.append(container);
}

btnConnect.addEventListener('click', () => void connectWallet());
btnRefresh.addEventListener('click', () => void refreshBalance());
btnSend.addEventListener('click', () => void sendCedra());

(async () => {
  try {
    const w = (window as any).aptos as AptosWallet | undefined;
    if (w && (await w.isConnected?.())) {
      wallet = w;
      const acc = await w.account?.();
      if (acc?.address) {
        addressEl.textContent = acc.address;
        await publishIfNeeded(acc.address);
        updateQr(acc.address);
        await refreshBalance();
      }
    }
  } catch {}
})();

