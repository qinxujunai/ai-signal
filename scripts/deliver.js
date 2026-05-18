#!/usr/bin/env node

// ============================================================================
// Follow Builders — Delivery Script
// ============================================================================
// Sends a digest to the user via their chosen delivery method.
// Supports: Telegram bot, Email (via Resend), or stdout (default).
//
// Usage:
//   echo "digest text" | node deliver.js
//   node deliver.js --message "digest text"
//   node deliver.js --file /path/to/digest.txt
//
// The script reads delivery config from ~/.follow-builders/config.json
// and API keys from ~/.follow-builders/.env
//
// Delivery methods:
//   - "telegram": sends via Telegram Bot API (needs TELEGRAM_BOT_TOKEN + chat ID)
//   - "email": sends via Resend API (needs RESEND_API_KEY + email address)
//   - "stdout" (default): just prints to terminal
// ============================================================================

import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { config as loadEnv } from 'dotenv';

// -- Constants ---------------------------------------------------------------

// Config dir: ~/.ai-signal (primary) with ~/.follow-builders fallback
const NEW_USER_DIR = join(homedir(), '.ai-signal');
const LEGACY_USER_DIR = join(homedir(), '.follow-builders');
const USER_DIR = existsSync(NEW_USER_DIR) ? NEW_USER_DIR : LEGACY_USER_DIR;
const CONFIG_PATH = join(USER_DIR, 'config.json');
const ENV_PATH = join(USER_DIR, '.env');
const LAST_SENT_PATH = join(USER_DIR, '.last-sent');
const COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 hours

// -- Read input --------------------------------------------------------------

// The digest text can come from stdin, --message flag, or --file flag
async function getDigestText() {
  const args = process.argv.slice(2);

  // Check --message flag
  const msgIdx = args.indexOf('--message');
  if (msgIdx !== -1 && args[msgIdx + 1]) {
    return args[msgIdx + 1];
  }

  // Check --file flag
  const fileIdx = args.indexOf('--file');
  if (fileIdx !== -1 && args[fileIdx + 1]) {
    return await readFile(args[fileIdx + 1], 'utf-8');
  }

  // Read from stdin
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

// -- Telegram Delivery -------------------------------------------------------

// Sends the digest via Telegram Bot API.
// The user creates a bot via @BotFather and provides the token.
// The chat ID is obtained when the user sends their first message to the bot.
async function sendTelegram(text, botToken, chatId) {
  // Telegram has a 4096 character limit per message.
  // If the digest is longer, we split it into chunks.
  const MAX_LEN = 4000;
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_LEN) {
      chunks.push(remaining);
      break;
    }
    // Try to split at a newline near the limit
    let splitAt = remaining.lastIndexOf('\n', MAX_LEN);
    if (splitAt < MAX_LEN * 0.5) splitAt = MAX_LEN;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  for (const chunk of chunks) {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: chunk,
          parse_mode: 'Markdown',
          disable_web_page_preview: true
        })
      }
    );

    if (!res.ok) {
      const err = await res.json();
      // If Markdown parsing fails, retry without parse_mode
      if (err.description && err.description.includes("can't parse")) {
        await fetch(
          `https://api.telegram.org/bot${botToken}/sendMessage`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: chunk,
              disable_web_page_preview: true
            })
          }
        );
      } else {
        throw new Error(`Telegram API error: ${err.description}`);
      }
    }

    // Small delay between chunks to avoid rate limiting
    if (chunks.length > 1) await new Promise(r => setTimeout(r, 500));
  }
}

// -- Logging ------------------------------------------------------------------

const LOG_PATH = join(USER_DIR, 'cron.log');

async function logDelivery(status, message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${status}: ${message}\n`;
  try {
    await writeFile(LOG_PATH, line, { flag: 'a', encoding: 'utf-8' });
  } catch {}
  if (status === 'ERROR') process.stderr.write(line);
}

// -- Email Delivery (QQ SMTP) ------------------------------------------------

import { createTransport } from 'nodemailer';

async function sendEmailQQ(text, toEmail) {
  const isHtml = text.trim().match(/^<(!DOCTYPE|html)/i);
  const fromEmail = process.env.QQ_EMAIL || '2575244383@qq.com';
  const authCode = process.env.QQ_SMTP_AUTH;
  if (!authCode) throw new Error('QQ_SMTP_AUTH not found in .env');

  const transporter = createTransport({
    host: 'smtp.qq.com',
    port: 465,
    secure: true,
    auth: { user: fromEmail, pass: authCode }
  });

  const subject = `📡 AI Signal | ${new Date().toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
  })}`;

  const mailOptions = {
    from: `"AI Signal · 信号" <${fromEmail}>`,
    to: toEmail,
    subject
  };

  if (isHtml) {
    mailOptions.html = text;
    mailOptions.text = text.replace(/<[^>]*>/g, ' ').replace(/\s{2,}/g, '\n').trim().slice(0, 5000);
  } else {
    mailOptions.text = text;
  }

  const info = await transporter.sendMail(mailOptions);
  await logDelivery('OK', `Email sent to ${toEmail} (id: ${info.messageId})`);
  return info;
}

// -- Main --------------------------------------------------------------------

// -- Cooldown ----------------------------------------------------------------

async function checkCooldown(force) {
  if (force) return true;
  try {
    if (!existsSync(LAST_SENT_PATH)) return true;
    const lastSent = parseInt(await readFile(LAST_SENT_PATH, 'utf-8'), 10);
    if (isNaN(lastSent)) return true;
    const elapsed = Date.now() - lastSent;
    if (elapsed < COOLDOWN_MS) {
      const remaining = Math.ceil((COOLDOWN_MS - elapsed) / 60000);
      console.log(JSON.stringify({
        status: 'skipped',
        reason: `Cooldown: last email sent ${Math.round(elapsed / 60000)}min ago, retry in ${remaining}min. Use --force to override.`
      }));
      return false;
    }
  } catch {}
  return true;
}

async function recordSent() {
  try {
    await writeFile(LAST_SENT_PATH, String(Date.now()), 'utf-8');
  } catch {}
}

// -- Main --------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');

  // Load env and config
  loadEnv({ path: ENV_PATH });

  let config = {};
  if (existsSync(CONFIG_PATH)) {
    config = JSON.parse(await readFile(CONFIG_PATH, 'utf-8'));
  }

  const delivery = config.delivery || { method: 'stdout' };
  const digestText = await getDigestText();

  await logDelivery('RUN', `method=${delivery.method} force=${force} file=${args.includes('--file') ? args[args.indexOf('--file') + 1] : 'stdin'}`);

  if (!digestText || digestText.trim().length === 0) {
    console.log(JSON.stringify({ status: 'skipped', reason: 'Empty digest text' }));
    return;
  }

  // Cooldown check for email/telegram delivery (skip for stdout)
  if ((delivery.method === 'email' || delivery.method === 'telegram') && !dryRun) {
    if (!(await checkCooldown(force))) return;
  }

  try {
    switch (delivery.method) {
      case 'telegram': {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        const chatId = delivery.chatId;
        if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN not found in .env');
        if (!chatId) throw new Error('delivery.chatId not found in config.json');
        if (dryRun) {
          console.log(JSON.stringify({ status: 'dry-run', method: 'telegram', message: 'Would send to Telegram' }));
        } else {
          await sendTelegram(digestText, botToken, chatId);
          await recordSent();
          await logDelivery('OK', `Telegram sent to chat ${chatId}`);
          console.log(JSON.stringify({ status: 'ok', method: 'telegram', message: 'Digest sent to Telegram' }));
        }
        break;
      }

      case 'email': {
        const toEmail = delivery.email;
        if (!toEmail) throw new Error('delivery.email not found in config.json');
        if (dryRun) {
          console.log(JSON.stringify({ status: 'dry-run', method: 'email', message: `Would send to ${toEmail}` }));
        } else {
          await sendEmailQQ(digestText, toEmail);
          await recordSent();
          console.log(JSON.stringify({ status: 'ok', method: 'email', message: `Digest sent to ${toEmail}` }));
        }
        break;
      }

      case 'stdout':
      default: {
        // If HTML, strip tags for readable terminal output
        const isHtml = digestText.trim().match(/^<(!DOCTYPE|html)/i);
        if (isHtml) {
          const plain = digestText
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]*>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#x27;/g, "'")
            .replace(/\n{3,}/g, '\n\n')
            .trim();
          console.log(plain);
        } else {
          console.log(digestText);
        }
        break;
      }
    }
  } catch (err) {
    console.log(JSON.stringify({
      status: 'error',
      method: delivery.method,
      message: err.message
    }));
    process.exit(1);
  }
}

main();
