import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Crown, Trophy } from "lucide-react"

type Ring = {
  id: string
  color: "red" | "blue" | "green" | "yellow"
}

type GameState = {
  poles: Ring[][]
  moves: number
  isComplete: boolean
}

type Player = {
  id: string
  name: string
  isHost: boolean
  gameState: GameState
  isWinner: boolean
}

type PlayerMiniViewProps = {
  player: Player
}

const RING_COLORS = {
  red: "bg-red-500",
  blue: "bg-blue-500",
  green: "bg-green-500",
  yellow: "bg-yellow-500",
}

export default function PlayerMiniView({ player }: PlayerMiniViewProps) {
  return (
    <Card className="p-4 bg-white/20 backdrop-blur-sm border-white/20">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-white font-medium">{player.name}</span>
          {player.isHost && <Crown className="w-4 h-4 text-yellow-400" />}
          {player.isWinner && <Trophy className="w-4 h-4 text-yellow-400" />}
        </div>
        <Badge variant="outline" className="text-white border-white/50">
          {player.gameState.moves} moves
        </Badge>
      </div>

      {/* Mini game board */}
      <div className="flex justify-center gap-2 mb-3">
        {player.gameState.poles.map((pole, poleIndex) => (
          <div key={poleIndex} className="flex flex-col items-center">
            {/* Mini pole */}
            <div className="w-2 h-16 bg-amber-600 rounded-t-sm relative">
              {/* Mini rings */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex flex-col-reverse items-center">
                {pole.slice(-4).map((ring, ringIndex) => (
                  <div
                    key={ring.id}
                    className={`w-4 h-1.5 rounded-full ${RING_COLORS[ring.color]} border border-black/20`}
                    style={{ marginBottom: ringIndex === 0 ? "2px" : "1px" }}
                  />
                ))}
                {pole.length > 4 && (
                  <div className="text-white text-xs bg-black/50 rounded px-1">+{pole.length - 4}</div>
                )}
              </div>
            </div>
            {/* Mini base */}
            <div className="w-5 h-1.5 bg-amber-700 rounded-full" />
          </div>
        ))}
      </div>

      {player.gameState.isComplete && (
        <div className="text-center">
          <Badge className="bg-green-500 text-white">Complete!</Badge>
        </div>
      )}
    </Card>
  )
}
