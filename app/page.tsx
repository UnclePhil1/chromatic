"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Crown,
  Play,
  Trophy,
  Copy,
  Share,
  UserPlus,
  Plus,
  AlertCircle,
} from "lucide-react";
import GameBoard from "@/components/game-board";
import PlayerMiniView from "@/components/player-mini-view";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@gorbagana/web3.js";
import { toast } from "sonner";
import {
  sendBetToEscrow,
  payoutToWinnerWithKey,
  ESCROW_PUBLIC_KEY,
  ESCROW_SECRET_BASE58,
} from "./escrow";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { updatePlatformStats, updateLeaderboard } from "../lib/stats";
import PlatformStats from "../components/statsUi";

// --- Types ---
type Player = {
  id: string;
  name: string;
  isHost: boolean;
  gameState: GameState;
  isWinner: boolean;
  browserId: string;
  wallet: string;
};

type Ring = {
  id: string;
  color: "red" | "blue" | "green" | "yellow";
};

type GameState = {
  poles: Ring[][];
  moves: number;
  isComplete: boolean;
};

type RoomData = {
  host: Player;
  players: Player[];
  roomCode: string;
  gamePhase: "lobby" | "countdown" | "playing" | "finished";
  countdownValue: number;
  winner?: Player;
  lastUpdate: number;
  betAmount?: number;
  escrowWallet?: string;
  escrowSecret?: string; // <-- Add this for per-game escrow
  paidOut?: boolean;
};

// --- Constants ---
const INITIAL_RINGS: Ring[] = [
  { id: "r1", color: "red" },
  { id: "r2", color: "red" },
  { id: "r3", color: "red" },
  { id: "r4", color: "red" },
  { id: "r5", color: "red" },
  { id: "r6", color: "red" },
  { id: "r7", color: "red" },
  { id: "b1", color: "blue" },
  { id: "b2", color: "blue" },
  { id: "b3", color: "blue" },
  { id: "b4", color: "blue" },
  { id: "b5", color: "blue" },
  { id: "b6", color: "blue" },
  { id: "b7", color: "blue" },
  { id: "g1", color: "green" },
  { id: "g2", color: "green" },
  { id: "g3", color: "green" },
  { id: "g4", color: "green" },
  { id: "g5", color: "green" },
  { id: "g6", color: "green" },
  { id: "g7", color: "green" },
  { id: "y1", color: "yellow" },
  { id: "y2", color: "yellow" },
  { id: "y3", color: "yellow" },
  { id: "y4", color: "yellow" },
  { id: "y5", color: "yellow" },
  { id: "y6", color: "yellow" },
  { id: "y7", color: "yellow" },
];
const GOR_DECIMALS = 9;

// --- Utility Functions ---
function generateRandomGameState(): GameState {
  const shuffledRings = [...INITIAL_RINGS].sort(() => Math.random() - 0.5);
  const poles: Ring[][] = [[], [], [], [], []];
  shuffledRings.forEach((ring) => {
    let placed = false;
    let attempts = 0;
    while (!placed && attempts < 10) {
      const poleIndex = Math.floor(Math.random() * 4);
      const pole = poles[poleIndex];
      const uniqueColors = new Set(pole.map((r) => r.color));
      if (!uniqueColors.has(ring.color) && uniqueColors.size >= 4) {
        attempts++;
        continue;
      }
      poles[poleIndex].push(ring);
      placed = true;
    }
    if (!placed) {
      for (let i = 0; i < 4; i++) {
        const pole = poles[i];
        const uniqueColors = new Set(pole.map((r) => r.color));
        if (uniqueColors.has(ring.color) || uniqueColors.size < 4) {
          poles[i].push(ring);
          break;
        }
      }
    }
  });
  return { poles, moves: 0, isComplete: false };
}

function generateBrowserId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 15);
  const extraRandom = Math.random().toString(36).substring(2, 10);
  return `${timestamp}_${randomPart}_${extraRandom}`;
}

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// --- Supabase Room Helpers ---
async function getRoom(roomCode: string): Promise<RoomData | null> {
  const { data, error } = await supabase
    .from("rooms")
    .select("data")
    .eq("room_code", roomCode)
    .single();
  if (error) {
    console.error("Supabase getRoom error:", error, "roomCode:", roomCode);
  }
  return data?.data ?? null;
}

async function setRoom(roomCode: string, roomData: RoomData) {
  await supabase.from("rooms").upsert({
    room_code: roomCode,
    data: roomData,
    updated_at: new Date().toISOString(),
  });
}

async function deleteRoom(roomCode: string) {
  await supabase.from("rooms").delete().eq("room_code", roomCode);
}

// --- Main Component ---
export default function ChromaticRingsGame() {
  const { publicKey, connected, signTransaction } = useWallet();
  const [browserId, setBrowserId] = useState<string>("");
  const [gamePhase, setGamePhase] = useState<
    "menu" | "lobby" | "countdown" | "playing" | "finished"
  >("menu");
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinRoomCode, setJoinRoomCode] = useState("");
  const [showCopied, setShowCopied] = useState(false);
  const [countdownValue, setCountdownValue] = useState(5);
  const [invalidMoveMessage, setInvalidMoveMessage] = useState("");
  const [betAmount, setBetAmount] = useState(""); // GOR as string
  const [escrowWallet, setEscrowWallet] = useState<PublicKey | null>(null);
  const [escrowStatus, setEscrowStatus] = useState<
    "idle" | "funding" | "funded" | "error" | "paying" | "paid"
  >("idle");
  const [escrowError, setEscrowError] = useState<string | null>(null);
  const [hostRoomCode, setHostRoomCode] = useState<string | null>(null);
  const [roomData, setRoomData] = useState<RoomData | null>(null);

  // --- Persist state to localStorage ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const persist = {
      gamePhase,
      players,
      currentPlayer,
      playerName,
      roomCode,
      joinRoomCode,
      countdownValue,
      betAmount,
      escrowWallet: escrowWallet?.toBase58() || null,
      escrowStatus,
      hostRoomCode,
      roomData,
    };
    localStorage.setItem("chromatic_state", JSON.stringify(persist));
  }, [
    gamePhase,
    players,
    currentPlayer,
    playerName,
    roomCode,
    joinRoomCode,
    countdownValue,
    betAmount,
    escrowWallet,
    escrowStatus,
    hostRoomCode,
    roomData,
  ]);

  // --- Restore state from localStorage on mount ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("chromatic_state");
    if (saved) {
      try {
        const state = JSON.parse(saved);
        setGamePhase(state.gamePhase || "menu");
        setPlayers(state.players || []);
        setCurrentPlayer(state.currentPlayer || null);
        setPlayerName(state.playerName || "");
        setRoomCode(state.roomCode || "");
        setJoinRoomCode(state.joinRoomCode || "");
        setCountdownValue(state.countdownValue || 5);
        setBetAmount(state.betAmount || "");
        setEscrowWallet(
          state.escrowWallet ? new PublicKey(state.escrowWallet) : null
        );
        setEscrowStatus(state.escrowStatus || "idle");
        setHostRoomCode(state.hostRoomCode || null);
        setRoomData(state.roomData || null);
      } catch (e) {
        // ignore
      }
    }
  }, []);

  // --- Auto-fill join code from URL ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("room");
    if (code) {
      setJoinRoomCode(code.toUpperCase());
    }
  }, []);

  useEffect(() => {
    if (gamePhase === "finished" && roomCode) {
      getRoom(roomCode).then(setRoomData);
    }
  }, [gamePhase, roomCode]);

  // Solana connection for Gorbagana testnet (HTTP polling only)
  const { connection } = useConnection();
  // Generate browserId only on client
  useEffect(() => {
    if (typeof window !== "undefined") {
      let id = localStorage.getItem("browser_id");
      if (!id) {
        id = generateBrowserId();
        localStorage.setItem("browser_id", id);
      }
      setBrowserId(id);
    }
  }, []);

  // --- Polling for room updates (no real-time listeners) ---
  useEffect(() => {
    if (!roomCode) return;
    let polling = true;
    const pollRoom = async () => {
      while (polling) {
        const roomData = await getRoom(roomCode);
        if (roomData) {
          setPlayers(roomData.players);
          setGamePhase(roomData.gamePhase);
          setCountdownValue(roomData.countdownValue);
          setEscrowWallet(
            roomData.escrowWallet ? new PublicKey(roomData.escrowWallet) : null
          );
          setRoomData(roomData);
        }
        await new Promise((res) => setTimeout(res, 1500)); // Poll every 1.5s
      }
    };
    pollRoom();
    return () => {
      polling = false;
    };
  }, [roomCode]);

  // --- Countdown timer ---
  useEffect(() => {
    let countdownInterval: any = null;
    if (gamePhase === "countdown" && currentPlayer?.isHost) {
      countdownInterval = setInterval(async () => {
        setCountdownValue((prev) => {
          const newValue = prev - 1;
          if (newValue <= 0) {
            setGamePhase("playing");
            updateRoomData({ gamePhase: "playing", countdownValue: 5 });
            return 5;
          }
          updateRoomData({ countdownValue: newValue });
          return newValue;
        });
      }, 1000);
    }
    return () => clearInterval(countdownInterval);
    // eslint-disable-next-line
  }, [gamePhase, currentPlayer?.isHost, roomCode]);

  // --- Clear invalid move message ---
  useEffect(() => {
    if (invalidMoveMessage) {
      const timer = setTimeout(() => setInvalidMoveMessage(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [invalidMoveMessage]);

  // --Watching game changes on Database --
  useEffect(() => {
    if (hostRoomCode == null) {
      return;
    }
    getRoom(hostRoomCode).then((roomData) => {
      if (roomData) {
        setPlayers(roomData.players);
        setGamePhase(roomData.gamePhase);
      }
    });
  }, [hostRoomCode]);

  async function handleClaimWinnings() {
    if (!roomData) return;

    setEscrowStatus("paying");
    try {
      const winner = players.find((p) => p.isWinner)!;
      const winnerPubkey = new PublicKey(winner.wallet);
      await payoutToWinnerWithKey(
        winnerPubkey,
        connection,
        roomData.betAmount! * 2, // Both players' bets
        ESCROW_SECRET_BASE58!
      );

      setEscrowStatus("paid");
      updateRoomData({ paidOut: true });
      toast.success("Winnings claimed!");
      await updatePlatformStats({ won: roomData.betAmount! * 2 });
      await updateLeaderboard({
        player: winner.name,
        wallet: winner.wallet,
        won: roomData.betAmount! * 2,
      });
      const loser = players.find((p) => !p.isWinner);
      if (loser) {
        await updatePlatformStats({ lost: roomData.betAmount! });
        await updateLeaderboard({
          player: loser.name,
          wallet: loser.wallet,
          lost: roomData.betAmount!,
        });
      }
    } catch (e: any) {
      setEscrowStatus("error");
      setEscrowError(e.message || "Failed to claim payout.");
      toast.error("Claim failed: " + (e.message || e));
    }
  }

  // --- Room helpers ---
  const updateRoomData = useCallback(
    async (updates: Partial<RoomData>) => {
      const roomData = await getRoom(roomCode);
      if (roomData) {
        const updatedRoom = { ...roomData, ...updates };
        await setRoom(roomCode, updatedRoom);
      }
    },
    [roomCode]
  );

  // --- Host Game with Bet ---
  const hostGame = async () => {
    if (!playerName.trim() || !connected || !publicKey) {
      toast.error("Connect your Backpack wallet before hosting a game.");
      return;
    }
    if (!betAmount || isNaN(Number(betAmount)) || Number(betAmount) <= 0) {
      toast.error("Enter a valid bet amount in GOR.");
      return;
    }
    setEscrowStatus("idle");
    setEscrowError(null);

    // Generate unique escrow keypair for this game
    const escrowKeypair = Keypair.generate();
    const escrowPubkey = escrowKeypair.publicKey;
    const escrowSecret = bs58.encode(escrowKeypair.secretKey);

    setEscrowWallet(ESCROW_PUBLIC_KEY);

    const newRoomCode = generateRoomCode();
    setRoomCode(newRoomCode);

    const newPlayer: Player = {
      id: Math.random().toString(36).substring(2),
      name: playerName.trim(),
      isHost: true,
      gameState: generateRandomGameState(),
      isWinner: false,
      browserId: browserId || "",
      wallet: publicKey.toBase58(),
    };

    const roomData: RoomData = {
      host: newPlayer,
      players: [newPlayer],
      roomCode: newRoomCode,
      gamePhase: "lobby",
      countdownValue: 5,
      lastUpdate: Date.now(),
      betAmount: Number(betAmount) * 10 ** GOR_DECIMALS,
      escrowWallet: ESCROW_PUBLIC_KEY.toBase58(),
      escrowSecret, // Store for payout (test/demo only)
      paidOut: false,
    };

    await setRoom(newRoomCode, roomData);
    setHostRoomCode(newRoomCode);
    setPlayers([newPlayer]);
    setCurrentPlayer(newPlayer);
    setPlayerName("");
    setGamePhase("lobby");
    await updatePlatformStats({ bet: roomData.betAmount!, challenge: 1 });
    await updateLeaderboard({
      player: newPlayer.name,
      wallet: newPlayer.wallet,
      challenge: 1,
    });

    setEscrowStatus("funding");
    try {
      await sendBetToEscrow(
        roomData.betAmount!,
        { publicKey, signTransaction },
        connection,
        ESCROW_PUBLIC_KEY
      );
      setEscrowStatus("funded");
      toast.success("Escrow funded! Waiting for both players...");
    } catch (e: any) {
      setEscrowStatus("error");
      setEscrowError(e.message || "Failed to fund escrow.");
      toast.error("Failed to fund escrow: " + (e.message || e));
      resetGame();
      return;
    }
  };

  // --- Join Game and Match Bet ---
  const joinGame = async () => {
    if (
      !playerName.trim() ||
      !joinRoomCode.trim() ||
      !connected ||
      !publicKey
    ) {
      toast.error("Connect your Backpack wallet before joining a game.");
      return;
    }
    const roomData = await getRoom(joinRoomCode.toUpperCase());
    if (!roomData) {
      toast.error("Room not found! Please check the room code.");
      return;
    }
    if (roomData.players.length >= 2) {
      toast.error("Room is full!");
      return;
    }
    if (!roomData.betAmount) {
      toast.error("Host has not set a bet amount.");
      return;
    }
    const existingPlayer = roomData.players.find(
      (player) => player.browserId === browserId
    );
    if (existingPlayer) {
      toast.error(
        "You are already in this room! Please refresh the page if you want to rejoin."
      );
      return;
    }
    setEscrowStatus("funding");
    setEscrowError(null);
    try {
      await sendBetToEscrow(
        roomData.betAmount,
        { publicKey, signTransaction },
        connection,
        ESCROW_PUBLIC_KEY
      );
      setEscrowStatus("funded");
      toast.success("Escrow funded! Waiting for both players...");
    } catch (e: any) {
      setEscrowStatus("error");
      setEscrowError(e.message || "Failed to fund escrow.");
      toast.error("Failed to fund escrow: " + (e.message || e));
      resetGame();
      return;
    }

    const newPlayer: Player = {
      id: Math.random().toString(36).substring(2),
      name: playerName.trim(),
      isHost: false,
      gameState: generateRandomGameState(),
      isWinner: false,
      browserId: browserId || "",
      wallet: publicKey.toBase58(),
    };

    setRoomCode(joinRoomCode.toUpperCase());
    const updatedPlayers = [...roomData.players, newPlayer];
    setPlayers(updatedPlayers);
    setCurrentPlayer(newPlayer);

    const updatedRoomData = {
      ...roomData,
      players: updatedPlayers,
      lastUpdate: Date.now(),
    };
    await setRoom(joinRoomCode.toUpperCase(), updatedRoomData);

    setPlayerName("");
    setJoinRoomCode("");
    setGamePhase("lobby");
    await updatePlatformStats({ bet: roomData.betAmount! });
    await updateLeaderboard({
      player: newPlayer.name,
      wallet: newPlayer.wallet,
      challenge: 1,
    });
  };

  // --- Start Game ---
  const startGame = () => {
    if (currentPlayer?.isHost && players.length === 2) {
      const resetPlayers = players.map((player) => ({
        ...player,
        gameState: generateRandomGameState(),
        isWinner: false,
      }));
      setPlayers(resetPlayers);
      setCountdownValue(5);
      setGamePhase("countdown");
      updateRoomData({
        players: resetPlayers,
        gamePhase: "countdown",
        countdownValue: 5,
      });
    }
  };

  // --- Update Player Game State ---
  const updatePlayerGameState = (
    newGameState: GameState,
    isInvalidMove = false
  ) => {
    if (!currentPlayer) return;
    if (isInvalidMove) {
      setInvalidMoveMessage(
        "Invalid move! Check pole limits: max 4 colors or 10 rings per pole"
      );
      return;
    }
    const updatedPlayer = { ...currentPlayer, gameState: newGameState };
    setCurrentPlayer(updatedPlayer);
    const updatedPlayers = players.map((player) =>
      player.id === currentPlayer.id ? updatedPlayer : player
    );
    setPlayers(updatedPlayers);
    updateRoomData({ players: updatedPlayers });
    if (newGameState.isComplete && !currentPlayer.isWinner) {
      const winnerPlayer = { ...updatedPlayer, isWinner: true };
      setCurrentPlayer(winnerPlayer);
      const finalPlayers = updatedPlayers.map((player) =>
        player.id === currentPlayer.id ? winnerPlayer : player
      );
      setPlayers(finalPlayers);
      // When a player wins, update all players and set finished phase
      updateRoomData({
        players: finalPlayers,
        gamePhase: "finished",
        winner: winnerPlayer,
        paidOut: false,
      });
      setGamePhase("finished");
    }
  };

  // --- Payout Winner ---
  useEffect(() => {
    const payout = async () => {
      if (
        gamePhase === "finished" &&
        escrowWallet &&
        players.length === 2 &&
        players.some((p) => p.isWinner) &&
        roomData?.escrowSecret
      ) {
        const winner = players.find((p) => p.isWinner)!;
        const room = await getRoom(roomCode);
        if (!room || room.paidOut) return;
        setEscrowStatus("paying");
        try {
          const winnerPubkey = new PublicKey(winner.wallet);
          await payoutToWinnerWithKey(
            winnerPubkey,
            connection,
            room.betAmount! * 2,
            room.escrowSecret!
          );
          setEscrowStatus("paid");
          updateRoomData({ paidOut: true });
          toast.success("Funds sent to winner!");
        } catch (e: any) {
          setEscrowStatus("error");
          setEscrowError(e.message || "Failed to payout.");
          toast.error("Failed to payout: " + (e.message || e));
        }
      }
    };
    payout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gamePhase, escrowWallet, players, roomData?.escrowSecret]);

  // --- Reset Game ---
  const resetGame = async () => {
    if (roomCode) {
      await deleteRoom(roomCode);
    }
    setGamePhase("menu");
    setPlayers([]);
    setCurrentPlayer(null);
    setRoomCode("");
    setJoinRoomCode("");
    setCountdownValue(5);
    setInvalidMoveMessage("");
    setBetAmount("");
    setEscrowWallet(null);
    setEscrowStatus("idle");
    setEscrowError(null);
    localStorage.removeItem("chromatic_state");
  };

  // --- Copy helpers ---
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    setShowCopied(true);
    toast.success("Room code copied!");
    setTimeout(() => setShowCopied(false), 2000);
  };

  const copyGameLink = () => {
    const gameLink = `${window.location.origin}?room=${roomCode}`;
    navigator.clipboard.writeText(gameLink);
    setShowCopied(true);
    toast.success("Game link copied!");
    setTimeout(() => setShowCopied(false), 2000);
  };

  const otherPlayer = players.find((p) => p.id !== currentPlayer?.id);

  const WalletMultiButtonDynamic = dynamic(
    () =>
      import("@solana/wallet-adapter-react-ui").then(
        (mod) => mod.WalletMultiButton
      ),
    { ssr: false }
  );

  // --- UI Components ---
  const CountdownOverlay = () => (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="text-center">
        <div className="text-8xl font-bold text-white mb-4 animate-pulse">
          {countdownValue > 0 ? countdownValue : "GO!"}
        </div>
        <div className="text-2xl text-white/80">
          {countdownValue > 0 ? "Get Ready..." : "Start Playing!"}
        </div>
      </div>
    </div>
  );

  // --- Main Menu ---
  if (gamePhase === "menu") {
    return (
      <div
        className="relative min-h-screen flex flex-col items-center justify-center px-4"
        style={{ backgroundImage: "url('/moon.png')" }}
      >
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-[#151e28]/90 backdrop-blur-sm z-0" />

        {/* Top CTA */}
        <div className='flex flex-col justify-center items-center gap-4'>
          <PlatformStats />
          <Link
            href="/start"
            className="z-10 mt-4 mb-6 px-4 py-2 text-sm font-medium text-[#00d4aa] bg-white/10 backdrop-blur border border-[#00d4aa]/30 rounded-md hover:bg-[#00d4aa]/10 transition"
          >
            How to Play
          </Link>
          {/* <Link
            href="/stats"
            className="z-10 text-[#00d4aa] underlined"
          >
            Stats
          </Link> */}
        </div>

        {/* Form Card */}
        <div className="relative z-10 w-full max-w-md bg-[#151e28] border border-[#00d4aa]/20 rounded-2xl shadow-xl p-6 space-y-6">
          <div className="text-center">
            <h1 className="text-3xl font-extrabold text-[#00d4aa]">
              Chromatic Rings
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Stack the rings into matching color towers
            </p>
          </div>

          <div className="bg-[#00d4aa]/10 border border-[#00d4aa]/20 p-4 text-xs text-[#00d4aa] rounded-md">
            <strong className="text-[#00d4aa]">Cross-Browser:</strong> Share
            room codes with friends and play anywhere!
          </div>

          <WalletMultiButtonDynamic />

          {/* Inputs */}
          <div className="space-y-4">
            <Input
              placeholder="Enter your username"
              className="bg-[#151e28] border border-[#00d4aa]/30 text-white placeholder:text-[#00d4aa]/50 focus:ring-[#00d4aa]"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />

            <Input
              placeholder="Bet amount in $GOR"
              className="bg-[#151e28] border border-[#00d4aa]/30 text-white placeholder:text-[#00d4aa]/50 focus:ring-[#00d4aa]"
              value={betAmount}
              onChange={(e) =>
                setBetAmount(e.target.value.replace(/[^0-9.]/g, ""))
              }
            />

            <Button
              onClick={hostGame}
              disabled={!playerName.trim() || !betAmount.trim()}
              className="w-full bg-[#00d4aa] hover:bg-[#00d4aa]/50 text-black font-bold rounded-lg shadow transition"
            >
              <Plus className="w-4 h-4 mr-2" />
              Host New Game
            </Button>

            {/* Divider */}
            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#00d4aa]/20" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-[#151e28] px-2 text-[#00d4aa]/60">or</span>
              </div>
            </div>

            <Input
              placeholder="Enter room code"
              className="bg-[#151e28] border border-[#00d4aa]/30 text-white placeholder:text-[#00d4aa]/50 focus:ring-[#00d4aa]"
              value={joinRoomCode}
              onChange={(e) => setJoinRoomCode(e.target.value.toUpperCase())}
            />

            <Button
              onClick={joinGame}
              disabled={!playerName.trim() || !joinRoomCode.trim()}
              className="w-full bg-[#00d4aa] hover:bg-[#00d4aa]/50 text-black font-bold rounded-lg shadow transition"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Join Game
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // --- Lobby ---
  if (gamePhase === "lobby") {
    return (
      <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden">
        {/* Fullscreen Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/moon.png')" }}
        />

        {/* Dark overlay */}
        <div className="absolute inset-0 bg-[#151e28]/90 backdrop-blur-sm z-0" />

        {/* Foreground Content */}
        <Card className="relative z-10 w-full max-w-md mx-auto bg-[#151e28] border border-[#00d4aa]/20 text-white shadow-2xl rounded-2xl px-6 py-8">
          <CardHeader className="text-center space-y-1">
            <CardTitle className="text-3xl font-bold text-[#00d4aa]">
              Game Lobby
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Room Info */}
            <div className="text-center space-y-3">
              <Badge className="text-md px-4 py-1 border border-[#00d4aa]/30 text-[#00d4aa] bg-transparent rounded-full">
                Room: {roomCode}
              </Badge>

              <Badge className="text-md px-4 py-1 border border-[#00d4aa]/30 text-[#00d4aa] bg-transparent rounded-full">
                Bet:{" "}
                {players.length > 0 && players[0]?.gameState
                  ? Number(betAmount).toLocaleString() + " GOR"
                  : "N/A"}
              </Badge>

              {currentPlayer?.isHost && (
                <div className="space-y-2">
                  <p className="text-sm text-neutral-400">
                    Share with your friend:
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={copyRoomCode}
                      className="flex-1 border border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa] hover:bg-[#00d4aa]/20 transition"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      {showCopied ? "Copied!" : "Copy Code"}
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={copyGameLink}
                      className="flex-1 border border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa] hover:bg-[#00d4aa]/20 transition"
                    >
                      <Share className="w-4 h-4 mr-2" />
                      Copy Link
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Player List */}
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-neutral-400 mb-2">
                  Players ({players.length}/2)
                </p>
                <div className="space-y-2">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-3 bg-[#00d4aa]/5 border border-[#00d4aa]/10 rounded-lg"
                    >
                      <span className="font-medium text-white">
                        {player.name}
                      </span>
                      <div className="flex items-center gap-2">
                        {player.isHost && (
                          <Crown className="w-4 h-4 text-yellow-400" />
                        )}
                        {player.id === currentPlayer?.id && (
                          <Badge
                            variant="secondary"
                            className="text-xs bg-[#00d4aa]/30 text-white"
                          >
                            You
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {players.length < 2 && (
                    <div className="p-3 text-center text-sm text-[#00d4aa]/70 border-2 border-dashed border-[#00d4aa]/20 rounded-lg bg-[#00d4aa]/5">
                      Waiting for player...
                    </div>
                  )}
                </div>
              </div>

              {/* Escrow Status */}
              {escrowStatus === "funding" && (
                <div className="text-center text-yellow-300">
                  Please approve the transaction in your wallet to fund the bet
                  escrow.
                </div>
              )}
              {escrowStatus === "funded" && (
                <div className="text-center text-green-400">
                  Bet escrow funded! Waiting for both players...
                </div>
              )}
              {escrowStatus === "error" && (
                <div className="text-center text-red-500">{escrowError}</div>
              )}

              {/* Start Game Button */}
              {currentPlayer?.isHost && players.length === 2 && (
                <Button
                  onClick={startGame}
                  className="w-full bg-[#00d4aa] text-black font-semibold hover:bg-[#d7f899] transition"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Start Game
                </Button>
              )}

              {/* Waiting Text */}
              {!currentPlayer?.isHost && (
                <p className="text-center text-sm text-neutral-400">
                  Waiting for host to start the game...
                </p>
              )}

              {/* Leave Game Button */}
              <Button
                variant="ghost"
                onClick={resetGame}
                className="w-full mt-2 border border-[#00d4aa]/30 bg-[#00d4aa]/10 text-[#00d4aa] hover:bg-[#00d4aa]/20 transition"
              >
                Leave Game
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Game Finished ---
  // ...existing code...
  if (gamePhase === "finished") {
    const winner = players.find((p) => p.isWinner);
    const isWinner = winner?.id === currentPlayer?.id;
    const alreadyPaidOut =
      escrowStatus === "paid" ||
      (roomCode &&
        players.length &&
        players.some((p) => p.isWinner && escrowError === "paid"));

    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundImage: "url('/moon.png " }}
      >
        <div className="absolute inset-0 bg-[#151e28]/90 backdrop-blur-sm z-0" />
        <Card className="w-full max-w-md text-center z-50">
          <CardHeader>
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <CardTitle className="text-2xl font-bold">
              {winner?.id === currentPlayer?.id
                ? "You Win!"
                : `${winner?.name} Wins!`}
            </CardTitle>
            <p className="text-gray-600">
              Completed in {winner?.gameState.moves} moves
            </p>
          </CardHeader>

          <CardContent className="space-y-3">
            {/* --- Insert your new code here --- */}
            {roomData && (
              <>
                <div>
                  <p>Players: {roomData.players.length}</p>
                  {roomData.players.map((player: any, index: number) => (
                    <div key={index} className="p-2 border rounded my-2">
                      <p>
                        <strong>{player.name}</strong> (
                        {player.wallet.slice(0, 6)}...)
                      </p>
                      {/* <p>
                        Wins: {player.wins ?? 0} | Losses: {player.losses ?? 0}
                      </p> */}
                      {player.id === roomData.winner?.id && (
                        <span className="text-green-500">🏆 Winner</span>
                      )}
                    </div>
                  ))}
                </div>

                {isWinner && !alreadyPaidOut && (
                  <Button
                    onClick={handleClaimWinnings}
                    disabled={escrowStatus === "paying"}
                  >
                    {escrowStatus === "paying"
                      ? "Claiming..."
                      : "Claim Winnings"}
                  </Button>
                )}

                {escrowStatus === "error" && (
                  <p className="text-red-500 mt-2">Error: {escrowError}</p>
                )}
                {escrowStatus === "paid" && isWinner && (
                  <p className="text-green-500 mt-2">✅ Payout successful</p>
                )}
              </>
            )}

            <Button onClick={resetGame} className="w-full">
              Back to Menu
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  // --- Game Playing (with countdown overlay) ---
  if (!currentPlayer) return null;
  return (
    <div
      className="min-h-screen p-4"
      style={{ backgroundImage: "url('/moon.png " }}
    >
      <div className="absolute h-full inset-0 bg-[#151e28]/90 backdrop-blur-sm z-0" />
      {gamePhase === "countdown" && <CountdownOverlay />}
      {invalidMoveMessage && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-red-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 animate-bounce">
            <AlertCircle className="w-4 h-4" />
            {invalidMoveMessage}
          </div>
        </div>
      )}
      <div className="flex h-screen gap-4">
        {/* Main Game Area - 75% */}
        <div className="w-3/4 flex flex-col">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 mb-4">
            <div className="flex justify-between items-center text-white">
              <h1 className="text-2xl font-bold">Chromatic Rings</h1>
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-white border-white">
                  Room: {roomCode}
                </Badge>
                <span>Moves: {currentPlayer.gameState.moves}</span>
                <Badge variant="outline" className="text-white border-white">
                  {currentPlayer.name}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex-1">
            <GameBoard
              gameState={currentPlayer.gameState}
              onGameStateChange={updatePlayerGameState}
              disabled={gamePhase === "countdown"}
            />
          </div>
        </div>
        {/* Other Player - 25% */}
        <div className="w-1/4 space-y-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <h3 className="text-white font-semibold mb-4 text-center">
              Opponent
            </h3>
            {otherPlayer ? (
              <PlayerMiniView player={otherPlayer} />
            ) : (
              <div className="bg-white/5 rounded-lg p-6 text-center text-white/50">
                <Users className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Waiting for opponent...</p>
              </div>
            )}
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <div className="text-white text-sm mb-2">
              <strong>Game Rules:</strong>
            </div>
            <ul className="text-white/80 text-xs space-y-1">
              <li>• Max 4 different colors per pole</li>
              <li>• Max 10 rings per pole</li>
              <li>• Create 4 monochromatic towers</li>
              <li>• Leave 1 pole empty</li>
              <li>• 7 rings per color (28 total)</li>
            </ul>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4">
            <Button
              variant="outline"
              onClick={resetGame}
              className="w-full bg-[#00d4aa] text-white hover:bg-[#00d4aa]/50"
            >
              Leave Game
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
