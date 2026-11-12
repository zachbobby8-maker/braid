# Braid Watches: going live on Vercel

The site keeps its watches, prices and photos in a real database, so anything you
change as admin shows up for every buyer straight away. Do these steps once.

## 1. Add the database (2 minutes)
1. Open your project on vercel.com and click **Storage**.
2. Click **Create Database** and choose **Upstash Redis** (the free plan is enough).
3. Connect it to this project. Vercel adds the database variables for you
   (`KV_REST_API_URL` and `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_*`).

## 2. Add your own variables
Project → **Settings** → **Environment Variables**, then add:

| Name | What to put | Needed? |
| --- | --- | --- |
| `ADMIN_PASSCODE` | The password you will type at "Staff login". Make it long. | Yes |
| `WHATSAPP_NUMBER` | Digits only with country code, no plus sign. Lagos 0801 234 5678 becomes `2348012345678` | Yes, for the WhatsApp button |
| `TELEGRAM_USERNAME` | Your Telegram username without the @ | Yes, for the Telegram button |
| `ADMIN_SECRET` | Any long random text. Signs admin sessions. | Optional |

## 3. Redeploy
Deployments → the three dots on the latest one → **Redeploy**. Variables only
take effect after a redeploy.

## 4. Use it
1. Open your site and scroll to the footer. Tap **Staff login** and type `ADMIN_PASSCODE`.
2. A yellow bar appears. In it, tap **Remove all sample watches**, then **Add a watch**.
3. Open any watch to **Edit details & price**, **Upload photo**, or change its status.
4. Buyers see every change within about a minute, or instantly when they reload.

Prices are in Naira (₦). Photos you upload are shrunk and stored in the database.

## How the merchant chat works
Buyers fill in a short form on a watch. The site builds a message with the watch
ID, reference, price and the buyer's details, then opens WhatsApp or Telegram
with that message ready to send to the numbers you set in step 2.

On "Sell / Trade Your Watch", photos buyers attach are stored for 30 days and
the links are put in the message to you. Each visitor can upload 12 photos an hour.

## Where the merchant receives orders (the Messages button)
Every order, valuation request and store message is also saved on your site the
moment a buyer sends it, even if they never press Send in WhatsApp or Telegram.

1. Sign in with **Staff login**. In the yellow bar, tap **Messages**.
2. A number on the button shows how many are new.
3. Open a message to read it, then tap **Reply on WhatsApp**, **Reply on Telegram**
   or **Reply by email**. These buttons use the contact the buyer typed in.
4. Tap **Mark handled** when you are done, or **Delete** to remove it.

Want a phone alert for every new message? Add two more variables in Vercel, then redeploy:

| Name | What to put |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Create a bot by messaging @BotFather on Telegram, and copy the token it gives you |
| `TELEGRAM_CHAT_ID` | Your own chat number. Message @userinfobot on Telegram and it replies with it |

Then open your new bot once and tap **Start**, so it is allowed to message you.

## Moving AI photos from the preview to your live site
AI photo generation only works inside the Miniapps preview, and the preview keeps its own copy of the watches.
1. In the preview, sign in as admin and tap **Generate all missing photos**.
2. When it finishes, tap **Copy photo links**.
3. Open your live site, sign in as admin, tap **Paste photo links**, paste, then tap **Apply photos**.

## Good to know
- If the page says "The vault didn't open", tap **Reload the page**. If it shows again, read the "Technical note" line under it. If it says "These files are missing from your website", upload exactly those files (keep them in the same folder as `index.html`) and redeploy. The site is made of many small files, so a partial upload leaves the page stuck on "Opening the vault…".
- Quick check: open `your-site.vercel.app/boot.js` in a browser. If you see code, the file is there. If you see a "not found" page, it was not uploaded.
- Files that must sit next to `index.html`: `main.js`, `boot.js`, `boot-guard.js`, `config.js`, `dom.js`, `backend.js`, `merchant.js`, `markets.js`, `watches.js`, `watch-art.js`, `checkout.js`, `sell.js`, `partner.js`, `inbox.js`, `fx.js`, `editor.js`, `editor-look.js`, `admin-auth.js`, `admin-photos.js`, `ai-photos.js`, and the five style files `styles.css`, `checkout.css`, `fx.css`, `avail.css`, `inbox.css`. Also the `locales` folder with `en.json`, and the `api` folder with `_lib.js`, `catalog.js`, `config.js`, `inbox.js`, `login.js`, `photo.js`.
- The passcode is checked on the server. It is never inside the page code.
- Five wrong tries in a row make the login wait before allowing more.
- If the yellow bar says "Preview mode", the database is not connected yet. Re-check step 1 and 3.
- If the yellow bar says the chat is not connected, re-check `WHATSAPP_NUMBER` and `TELEGRAM_USERNAME`, then redeploy.
- "Generate AI photo" only works inside the Miniapps preview, so it is hidden on your Vercel site. Upload a photo or paste an image link instead.
