#!/usr/bin/env node
// AI Signal — Email delivery via QQ SMTP

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { config as loadEnv } from 'dotenv';
import { createTransport } from 'nodemailer';

const USER_DIR = join(homedir(), '.ai-signal');
const CONFIG_PATH = join(USER_DIR, 'config.json');
const ENV_PATH = join(USER_DIR, '.env');
const LAST_SENT_PATH = join(USER_DIR, '.last-sent');
const LOG_PATH = join(USER_DIR, 'cron.log');
const COOLDOWN_MS = 4 * 60 * 60 * 1000;

// -- Read input --------------------------------------------------------------

async function getDigestText() {
  const args = process.argv.slice(2);

  const msgIdx = args.indexOf('--message');
  if (msgIdx !== -1 && args[msgIdx + 1]) return args[msgIdx + 1];

  const fileIdx = args.indexOf('--file');
  if (fileIdx !== -1 && args[fileIdx + 1]) return await readFile(args[fileIdx + 1], 'utf-8');

  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf-8');
}

// -- Logging ------------------------------------------------------------------

async function logDelivery(status, message) {
  const line = `[${new Date().toISOString()}] ${status}: ${message}\n`;
  try { await writeFile(LOG_PATH, line, { flag: 'a', encoding: 'utf-8' }); } catch {}
  if (status === 'ERROR') process.stderr.write(line);
}

// -- Email (QQ SMTP) ----------------------------------------------------------

async function sendEmail(text, toEmail) {
  const isHtml = text.trim().match(/^<(!DOCTYPE|html)/i);
  const fromEmail = process.env.QQ_EMAIL || '2575244383@qq.com';
  const authCode = process.env.QQ_SMTP_AUTH;
  if (!authCode) throw new Error('QQ_SMTP_AUTH not found in .env');

  const transporter = createTransport({
    host: 'smtp.qq.com', port: 465, secure: true,
    auth: { user: fromEmail, pass: authCode }
  });

  const mailOptions = {
    from: `"AI Signal · 信号" <${fromEmail}>`,
    to: toEmail,
    subject: `📡 AI Signal | ${new Date().toLocaleDateString('zh-CN', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
    })}`
  };

  if (isHtml) {
    mailOptions.html = text;
    mailOptions.text = text.replace(/<[^>]*>/g, ' ').replace(/\s{2,}/g, '\n').trim().slice(0, 5000);
  } else {
    mailOptions.text = text;
  }

  const info = await transporter.sendMail(mailOptions);
  await logDelivery('OK', `Email sent to ${toEmail} (id: ${info.messageId})`);
}

// -- Cooldown -----------------------------------------------------------------

async function checkCooldown(force) {
  if (force) return true;
  try {
    if (!existsSync(LAST_SENT_PATH)) return true;
    const lastSent = parseInt(await readFile(LAST_SENT_PATH, 'utf-8'), 10);
    if (isNaN(lastSent)) return true;
    const elapsed = Date.now() - lastSent;
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
      console.log(JSON.stringify({ status: 'skipped', reason: `Cooldown: retry in ${remaining}min. Use --force.` }));
      return false;
    }
  } catch {}
  return true;
}

async function recordSent() {
  try { await writeFile(LAST_SENT_PATH, String(Date.now()), 'utf-8'); } catch {}
}

// -- Main ---------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');

  loadEnv({ path: ENV_PATH });

  let config = {};
  if (existsSync(CONFIG_PATH)) config = JSON.parse(await readFile(CONFIG_PATH, 'utf-8'));

  const delivery = config.delivery || { method: 'stdout' };
  const digestText = await getDigestText();

  if (!digestText || digestText.trim().length === 0) {
    console.log(JSON.stringify({ status: 'skipped', reason: 'Empty digest text' }));
    return;
  }

  if (delivery.method === 'email' && !dryRun) {
    if (!(await checkCooldown(force))) return;
  }

  try {
    if (delivery.method === 'email') {
      const toEmail = delivery.email;
      if (!toEmail) throw new Error('delivery.email not found in config.json');
      if (dryRun) {
        console.log(JSON.stringify({ status: 'dry-run', message: `Would send to ${toEmail}` }));
      } else {
        await sendEmail(digestText, toEmail);
        await recordSent();
        console.log(JSON.stringify({ status: 'ok', message: `Digest sent to ${toEmail}` }));
      }
    } else {
      // stdout fallback
      const isHtml = digestText.trim().match(/^<(!DOCTYPE|html)/i);
      if (isHtml) {
        console.log(digestText.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\n{3,}/g, '\n\n').trim());
      } else {
        console.log(digestText);
      }
    }
  } catch (err) {
    console.log(JSON.stringify({ status: 'error', message: err.message }));
    process.exit(1);
  }
}

main();
