# 🐓 ELON CHICKEN RUN — $ECHICK

> The only chicken dat will reach the moon faster than Musk.

---

## 📁 Asset Files — Drop These In `assets/`

| File | Description |
|------|-------------|
| `logo.png` | Game logo (boot screen + settings) |
| `elon.mp3` | Background music (loops in game) |
| `bg_miami.png` | **Miami beach road photo** — use the image you uploaded ✓ |
| `bg_tokyo.png` | Tokyo neon street background |
| `bg_yacht.png` | Yacht / ocean island background |
| `bg_space.png` | Space / cosmos background |
| `char_og.png` | OG Chicken sprite (transparent PNG) |
| `char_elon.png` | Elon Chicken sprite |
| `char_mafia.png` | Mafia Chicken sprite |
| `char_beach.png` | Beach Chicken sprite |
| `char_cowboy.png` | Cowboy Chicken sprite |
| `char_royal.png` | Royal Chicken sprite |
| `char_golden.png` | Golden Chicken sprite |
| `char_space.png` | Space Chicken sprite |
| `char_samurai.png` | Samurai Chicken sprite |
| `char_zombie.png` | Zombie Chicken sprite |
| `char_angel.png` | Angel Chicken sprite |
| `char_demon.png` | Demon Chicken sprite |
| `char_billionaire.png` | Billionaire Chicken sprite |
| `char_pharaoh.png` | Pharaoh Chicken sprite |
| `char_cyber.png` | Cyber Chicken sprite |

> If any PNG is missing, the game automatically falls back to emoji. Nothing breaks!

---

## 🗃️ Supabase Setup (one time)

1. Go to your Supabase project → **SQL Editor** → **New Query**
2. Paste the entire contents of `supabase_schema.sql`
3. Click **Run**
4. Done — all tables and views are created

---

## 🚀 Deployment

### Telegram WebApp
1. Talk to [@BotFather](https://t.me/BotFather)
2. `/newapp` → link your deployed URL
3. Set the bot as `@elon_chicken`
4. Web App slug: `elonchickengame`

### Hosting Options
- **Netlify**: drag and drop the `echick-game/` folder
- **Vercel**: `vercel deploy`
- **GitHub Pages**: push to repo, enable Pages
- **Firebase Hosting**: `firebase deploy`

The game is 100% static HTML/CSS/JS — no server needed.

---

## 🔐 Admin Panel

- **Trigger**: Tap the chicken on the home screen **7 times** fast
- **Password**: `Elonbelovedgetit`
- **Features**:
  - View all players with stats
  - Ban / unban players
  - View run logs with suspicious flag detection
  - Export full player JSON

---

## 🎮 Gameplay

- **Jump**: Tap anywhere / swipe up / Space key
- **Duck**: Swipe down / Arrow Down
- **Double jump**: Available for Cowboy Chicken character
- **Referral gate**: Must invite 5 friends before playing
- **Coins**: Collect in-game, spend in Store on characters

---

## 🛡️ Security Features

- All scores validated server-side via Supabase
- Per-session signed payloads (SHA-256)
- Rate-limit checks: max coins/score/distance per second
- Shadow score tracking vs reported score
- Suspicious flags stored in DB for admin review
- No localStorage for any game data
- Telegram initData verified on every session

---

## 📦 File Structure

```
echick-game/
├── index.html
├── supabase_schema.sql
├── README.md
├── assets/
│   ├── README.txt          ← asset drop guide
│   ├── logo.png            ← YOU PROVIDE
│   ├── elon.mp3            ← YOU PROVIDE
│   ├── bg_miami.png        ← YOU PROVIDE (beach road photo)
│   ├── bg_tokyo.png        ← YOU PROVIDE
│   ├── char_og.png         ← YOU PROVIDE
│   └── ... (all other chars)
├── css/
│   ├── base.css
│   ├── home.css
│   ├── game.css
│   ├── store.css
│   ├── leaderboard.css
│   ├── referrals.css
│   ├── settings.css
│   ├── admin.css
│   └── modals.css
└── js/
    ├── config.js           ← Supabase keys + game constants
    ├── security.js         ← Anti-cheat
    ├── db.js               ← All Supabase queries
    ├── audio.js            ← Music + SFX
    ├── auth.js             ← Telegram SDK + captcha
    ├── app.js              ← Navigation + init
    ├── home.js             ← Home screen
    ├── game.js             ← Canvas game engine
    ├── store.js            ← Store
    ├── leaderboard.js      ← Leaderboard
    ├── referrals.js        ← Referrals
    ├── settings.js         ← Settings
    └── admin.js            ← Admin panel
```
