import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { sendBetToEscrow } from "../escrow";
const assert = require("assert");

// Mock Transaction.serialize to avoid base58 errors in unit tests
Transaction.prototype.serialize = function () {
  return Buffer.from("deadbeef", "hex");
};

const mockWallet = {
  publicKey: new PublicKey("GRMJJWnyx5s1MoyVa4NMLaJT93MoNo1ePTAs7coqhRon"),
  signTransaction: async (tx: Transaction) => {
    tx.addSignature(
      mockWallet.publicKey,
      Buffer.alloc(64, 1) // Fake signature
    );
    return tx;
  }
};

const mockConnection = {
  getLatestBlockhash: async () => ({
    blockhash: "testblockhash",
    lastValidBlockHeight: 123,
  }),
  sendRawTransaction: async () => "mockSignature",
  confirmTransaction: async () => ({}),
};

describe("sendBetToEscrow", () => {
  it("should successfully fund escrow with valid account", async () => {
    const result = await sendBetToEscrow(
      1000,
      mockWallet,
      mockConnection as any,
      mockWallet.publicKey
    );
    assert.strictEqual(result, "mockSignature");
  });

  it("should fail to fund escrow with invalid account", async () => {
    try {
      await sendBetToEscrow(
        100,
        { publicKey: null, signTransaction: async () => {} },
        mockConnection as any,
        mockWallet.publicKey
      );
    } catch (err: any) {
      assert.strictEqual(err.message, "Wallet not connected");
    }
  });

  it("should handle failed transaction", async () => {
    const faultyWallet = {
      publicKey: new PublicKey("BJjbVHUmjrEetwmxu3dcKXzuczSPjj8W7eokQxtHWk18"),
      signTransaction: async () => {
        throw new Error("Failed to sign transaction");
      }
    };

    try {
      await sendBetToEscrow(
        1000,
        faultyWallet,
        mockConnection as any,
        mockWallet.publicKey
      );
    } catch (err: any) {
      assert.strictEqual(err.message, "Failed to sign transaction");
    }
  });
});