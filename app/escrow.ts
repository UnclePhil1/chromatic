import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { toast } from "sonner";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";

export const ESCROW_PUBLIC_KEY = new PublicKey("GRMJJWnyx5s1MoyVa4NMLaJT93MoNo1ePTAs7coqhRon");
// This is a placeholder. Replace with your actual base58-encoded secret for the above address.
export const ESCROW_SECRET_BASE58 = process.env.NEXT_PUBLIC_PRIVATE_KEY;

export async function sendBetToEscrow(
  amount: number,
  wallet: any,
  connection: Connection,
  escrowPubkey: PublicKey = ESCROW_PUBLIC_KEY
) {
  if (!wallet.publicKey) throw new Error("Wallet not connected");
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: escrowPubkey,
      lamports: amount,
    })
  );
  tx.feePayer = wallet.publicKey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  try {
    toast.info("Please sign the transaction in your wallet...");
    const signed = await wallet.signTransaction(tx);
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    toast.success("Transaction signed and sent successfully!");
    return sig;
  } catch (e: any) {
    toast.error("Transaction failed: " + (e.message || e));
    throw e;
  }
}

/**
 * Payout only the game bet amount to the winner from the game's escrow wallet.
 * @param winnerPubkey Winner's public key
 * @param connection Solana connection
 * @param betAmount Total bet amount (host + opponent)
 * @param escrowSecret base58-encoded secret key for the game's escrow wallet
 */
export async function payoutToWinnerWithKey(
  winnerPubkey: PublicKey,
  connection: Connection,
  betAmount: number,
  escrowSecret: string
) {
  // Use the base58-encoded secret for this game's escrow
  const secretKey = bs58.decode(ESCROW_SECRET_BASE58 || escrowSecret);
  const escrowKeypair = Keypair.fromSecretKey(secretKey);
  const escrowPubkey = escrowKeypair.publicKey;

  const escrowBalance = await connection.getBalance(escrowPubkey);
  if (escrowBalance < betAmount + 5000) throw new Error("Not enough funds to pay out");

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: escrowPubkey,
      toPubkey: winnerPubkey,
      lamports: betAmount, // Only send the game bet amount
    })
  );

  tx.feePayer = escrowPubkey;
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;

  // Sign with escrow keypair
  tx.sign(escrowKeypair);

  const signature = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );

  return signature;
}


