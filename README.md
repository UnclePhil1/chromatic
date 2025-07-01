# Chromatic Rings

Chromatic Rings is a multiplayer puzzle game built with Next.js and React, featuring cross-browser real-time play and integration with the Gorbagana Testnet on Solana. Players compete to organize colored rings into monochromatic towers, with optional bet escrow and payouts handled on-chain.

---

## 🕹️ Game Overview

- **Objective:** Rearrange 28 colored rings (7 each of red, blue, green, yellow) across 5 poles to create 4 towers, each containing only one color, and leave one pole empty.
- **Rules:**
  - Max 4 different colors per pole.
  - Max 10 rings per pole.
  - Only the top ring of each pole can be moved.
  - Complete the puzzle in as few moves as possible.
- **Multiplayer:** Play with a friend by sharing a room code. Both players must connect wallets and optionally place a bet in $GOR (Gorbagana Testnet token).

---

## 🪙 Gorbagana Integration

- **Wallet Connection:** Uses Backpack Wallet via Gorbana Wallet Adapter(@gorbagana/web3.js).
- **Escrow-Vault:** Players can set a bet amount in $GOR. Both must fund the escrow before starting.
- **Payout:** When a player wins, the escrow is paid out to the winner's wallet automatically.
- **Network:** All transactions are performed on the Gorbagana Testnet.

---

## 🚀 Running Locally

### 1. **Clone the Repository**

```sh
git clone https://github.com/UnclePhil1/chromatic.git
cd chromatic
```

### 2. **Install Dependencies**

```sh
pnpm install
# or
npm install
```

### 3. **Set Up Environment Variables**

Create a `.env.local` file in the root directory and add your Supabase and Solana config:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. **Run the Development Server**

```sh
pnpm dev
# or
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Demo

A live demo may be available at:  
**https://khromatic.vercel.app/**

---

## 📝 How to Play

1. **Connect your Backpack wallet** (Gorbagana Testnet).
2. **Host a game**: Enter a name, set a bet amount (optional), and share the room code with your friend.
3. **Join a game**: Enter your name and the room code provided by the host.
4. **Fund escrow**: Both players approve the bet transaction in their wallet.
5. **Start the game**: Host starts the countdown, then both players race to solve the puzzle.
6. **Win and payout**: The first to finish claims the escrow payout.

---

## 🛠️ Tech Stack

- **Frontend:** Next.js, React, Tailwind CSS
- **State/Sync:** Supabase (Postgres), localStorage for cross-tab sync
- **Blockchain:** Solana (Gorbagana Testnet), @gorbagana/web3.js, Backpack Wallet Adapter

---

## 🧑‍💻 Project Structure

- `/app` - Next.js app directory (pages, main logic)
- `/components` - React UI components (game board, player views, UI primitives)
- `/lib` - Utility libraries (multiplayer sync, Supabase, escrow logic)
- `/hooks` - Custom React hooks
- `/styles` - Tailwind and global CSS

---

## 🧪 Testing

Tests are written using Jest. To run tests:

```sh
pnpm test
# or
npm run test
```