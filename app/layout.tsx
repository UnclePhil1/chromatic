import type { Metadata } from "next";
import "./globals.css";
import { SolanaWalletProvider } from "./SolanaProvider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "chromatic",
  description: "A multiplayer game on Solana powered by Gorbagana Testnet",
  generator: "v0.dev",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SolanaWalletProvider>{children}</SolanaWalletProvider>
        <Toaster /> 
      </body>
    </html>
  );
}
