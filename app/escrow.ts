import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { toast } from "sonner";

export async function sendBetToEscrow(
  amount: number,
  wallet: any,
  connection: Connection,
  escrowPubkey: PublicKey
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

export async function payoutToWinner(
  winnerPubkey: PublicKey,
  escrowPubkey: PublicKey,
  walletAdapter: { publicKey: PublicKey; signTransaction: any },
  connection: Connection
) {
  const escrowBalance = await connection.getBalance(escrowPubkey);

  if (escrowBalance <= 5000) throw new Error("Not enough funds to pay out");

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: escrowPubkey,
      toPubkey: winnerPubkey,
      lamports: escrowBalance - 5000, // reserve for fees
    })
  );

  tx.feePayer = escrowPubkey;

  const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.recentBlockhash = recentBlockhash;

  const signedTx = await walletAdapter.signTransaction(tx);
  const signature = await connection.sendRawTransaction(signedTx.serialize());
  await connection.confirmTransaction(signature, "confirmed");

  return signature;
}
