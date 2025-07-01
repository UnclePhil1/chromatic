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
import { sendBetToEscrow, payoutToWinner } from "./escrow";
import { supabase } from "@/lib/supabase";
import dynamic from "next/dynamic";
import Link from "next/link";

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
        // setCountdownValue(roomData.countdownValue);
      }
    });
  }, [hostRoomCode]);

  async function handleClaimWinnings() {
    if (!publicKey || !signTransaction || !escrowWallet) return;

    setEscrowStatus("paying");
    try {
      await payoutToWinner(
        new PublicKey(publicKey),
        escrowWallet,
        { publicKey, signTransaction },
        connection
      );
      setEscrowStatus("paid");
      updateRoomData({ paidOut: true });
      toast.success("Winnings claimed!");
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

    const escrowPubkey = publicKey; // For demo, host acts as escrow
    setEscrowWallet(escrowPubkey);

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
      escrowWallet: escrowPubkey.toBase58(),
      paidOut: false,
    };

    await setRoom(newRoomCode, roomData);
    setHostRoomCode(newRoomCode);
    setPlayers([newPlayer]);
    setCurrentPlayer(newPlayer);
    setPlayerName("");
    setGamePhase("lobby");

    setEscrowStatus("funding");
    try {
      await sendBetToEscrow(
        roomData.betAmount!,
        { publicKey, signTransaction },
        connection,
        escrowPubkey
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
    console.log("room data:", roomData);
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
        new PublicKey(roomData.escrowWallet!)
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
      updateRoomData({
        players: finalPlayers,
        gamePhase: "finished",
        winner: winnerPlayer,
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
        players.some((p) => p.isWinner)
      ) {
        const winner = players.find((p) => p.isWinner)!;
        const roomData = await getRoom(roomCode);
        if (!roomData || roomData.paidOut) return;
        if (!publicKey || !signTransaction) return;
        if (publicKey.toBase58() !== roomData.escrowWallet) return;
        setEscrowStatus("paying");
        try {
          await payoutToWinner(
            new PublicKey(winner.wallet),
            escrowWallet,
            { publicKey, signTransaction },
            connection
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
  }, [gamePhase, escrowWallet, players]);

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
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex flex-col items-center justify-center p-4">
        <Link href={'/start'} className="bg-white rounded-md p-2 my-2">
          How to play
        </Link>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold text-purple-700">
              Chromatic Rings
            </CardTitle>
            <p className="text-sm text-gray-600">
              Organize colored rings into monochromatic towers!
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
              <p className="text-xs text-blue-700">
                <strong>Cross-Browser Ready:</strong> Share room codes to play
                with friends on different devices!
              </p>
              <WalletMultiButtonDynamic />
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Input
                placeholder="Enter your username"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <Input
                placeholder="Bet amount in $GOR"
                value={betAmount}
                onChange={(e) =>
                  setBetAmount(e.target.value.replace(/[^0-9.]/g, ""))
                }
              />
              <Button
                onClick={hostGame}
                className="w-full"
                disabled={!playerName.trim() || !betAmount.trim()}
              >
                <Plus className="w-4 h-4 mr-2" />
                Host New Game
              </Button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">Or</span>
                </div>
              </div>
              <div className="space-y-2">
                <Input
                  placeholder="Enter room code"
                  value={joinRoomCode}
                  onChange={(e) =>
                    setJoinRoomCode(e.target.value.toUpperCase())
                  }
                />
                <Button
                  onClick={joinGame}
                  className="w-full"
                  disabled={!playerName.trim() || !joinRoomCode.trim()}
                >
                  <UserPlus className="w-4 h-4 mr-2" />
                  Join Game
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // --- Lobby ---
  if (gamePhase === "lobby") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-purple-700">
              Game Lobby
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center space-y-3">
              <Badge variant="outline" className="text-lg px-4 py-2">
                Room: {roomCode}
              </Badge>
              <div>
                <Badge variant="outline" className="text-lg px-4 py-2">
                  Bet:{" "}
                  {players.length > 0 && players[0]?.gameState
                    ? Number(betAmount).toLocaleString() + " GOR"
                    : "N/A"}
                </Badge>
              </div>
              {currentPlayer?.isHost && (
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Share with your friend:
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyRoomCode}
                      className="flex-1"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      {showCopied ? "Copied!" : "Copy Code"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyGameLink}
                      className="flex-1"
                    >
                      <Share className="w-4 h-4 mr-2" />
                      Copy Link
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-3">
                  Players ({players.length}/2)
                </p>
                <div className="space-y-2">
                  {players.map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="font-medium">{player.name}</span>
                      <div className="flex items-center gap-2">
                        {player.isHost && (
                          <Crown className="w-4 h-4 text-yellow-500" />
                        )}
                        {player.id === currentPlayer?.id && (
                          <Badge variant="secondary" className="text-xs">
                            You
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                  {players.length < 2 && (
                    <div className="p-3 bg-gray-100 rounded-lg text-center text-gray-500 border-2 border-dashed border-gray-300">
                      Waiting for player...
                    </div>
                  )}
                </div>
              </div>
              {escrowStatus === "funding" && (
                <div className="text-center text-blue-700">
                  Please approve the transaction in your Backpack wallet to fund
                  the bet escrow.
                </div>
              )}
              {escrowStatus === "funded" && (
                <div className="text-center text-green-700">
                  Bet escrow funded! Waiting for both players...
                </div>
              )}
              {escrowStatus === "error" && (
                <div className="text-center text-red-700">{escrowError}</div>
              )}
              {currentPlayer?.isHost && players.length === 2 && (
                <Button onClick={startGame} className="w-full">
                  <Play className="w-4 h-4 mr-2" />
                  Start Game
                </Button>
              )}
              {!currentPlayer?.isHost && (
                <p className="text-center text-sm text-gray-600">
                  Waiting for host to start the game...
                </p>
              )}
              <Button variant="outline" onClick={resetGame} className="w-full">
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
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
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
                      <p>
                        Wins: {player.wins ?? 0} | Losses: {player.losses ?? 0}
                      </p>
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
                {escrowStatus === "paid" && (
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
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 p-4">
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
              className="w-full text-white border-white hover:bg-white/20"
            >
              Leave Game
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
