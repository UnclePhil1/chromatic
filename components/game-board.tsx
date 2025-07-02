"use client";

import type React from "react";

import { useState, useRef } from "react";
import { Card } from "@/components/ui/card";
import logo from "../public/gorbagana.jpg";

type Ring = {
  id: string;
  color: "red" | "blue" | "green" | "yellow";
};

type GameState = {
  poles: Ring[][];
  moves: number;
  isComplete: boolean;
};

type GameBoardProps = {
  gameState: GameState;
  onGameStateChange: (newState: GameState, isInvalidMove?: boolean) => void;
  disabled?: boolean;
};

const RING_COLORS = {
  red: "bg-red-500 border-red-600",
  blue: "bg-blue-500 border-blue-600",
  green: "bg-green-500 border-green-600",
  yellow: "bg-yellow-500 border-yellow-600",
};

function checkWinCondition(poles: Ring[][]): boolean {
  // Check if we have exactly 4 monochromatic towers and 1 empty pole
  const nonEmptyPoles = poles.filter((pole) => pole.length > 0);
  const emptyPoles = poles.filter((pole) => pole.length === 0);

  if (nonEmptyPoles.length !== 4 || emptyPoles.length !== 1) {
    return false;
  }

  // Check if each non-empty pole is monochromatic and has exactly 7 rings
  return nonEmptyPoles.every((pole) => {
    if (pole.length !== 7) return false;
    const firstColor = pole[0].color;
    return pole.every((ring) => ring.color === firstColor);
  });
}

function canPlaceRingOnPole(pole: Ring[], newRing: Ring): boolean {
  const uniqueColors = new Set(pole.map((r) => r.color));

  // If the ring color is already on the pole, it's always allowed
  if (uniqueColors.has(newRing.color)) {
    return true;
  }

  // If adding this ring would create more than 4 different colors, it's not allowed
  if (uniqueColors.size >= 4) {
    return false;
  }

  return true;
}

export default function GameBoard({
  gameState,
  onGameStateChange,
  disabled = false,
}: GameBoardProps) {
  const [draggedRing, setDraggedRing] = useState<{
    ring: Ring;
    fromPole: number;
  } | null>(null);
  const [dragOverPole, setDragOverPole] = useState<number | null>(null);
  const [invalidMove, setInvalidMove] = useState<{
    ring: Ring;
    toPole: number;
  } | null>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  const handleDragStart = (ring: Ring, poleIndex: number) => {
    if (disabled) return;

    // Only allow dragging the top ring
    const pole = gameState.poles[poleIndex];
    if (pole[pole.length - 1]?.id === ring.id) {
      setDraggedRing({ ring, fromPole: poleIndex });
    }
  };

  const handleDragOver = (e: React.DragEvent, poleIndex: number) => {
    if (disabled) return;
    e.preventDefault();
    setDragOverPole(poleIndex);
  };

  const handleDragLeave = () => {
    if (disabled) return;
    setDragOverPole(null);
  };

  const handleDrop = (e: React.DragEvent, toPole: number) => {
    if (disabled) return;

    e.preventDefault();
    setDragOverPole(null);

    if (!draggedRing || draggedRing.fromPole === toPole) {
      setDraggedRing(null);
      return;
    }

    const newPoles = [...gameState.poles];
    const targetPole = newPoles[toPole];

    // Check if pole is already at maximum height (10 rings)
    if (targetPole.length >= 10) {
      // Invalid move - pole is full
      setInvalidMove({ ring: draggedRing.ring, toPole });

      // Show visual feedback briefly
      setTimeout(() => {
        setInvalidMove(null);
        // Show invalid move message
        onGameStateChange(gameState, true);
      }, 300);

      setDraggedRing(null);
      return;
    }

    // Check if the move is valid (max 5 different colors per pole)
    if (!canPlaceRingOnPole(targetPole, draggedRing.ring)) {
      // Invalid move - show visual feedback and return ring
      setInvalidMove({ ring: draggedRing.ring, toPole });

      // Temporarily show the ring on the target pole
      const sourceRing = newPoles[draggedRing.fromPole].pop();
      if (sourceRing) {
        newPoles[toPole].push(sourceRing);

        // Update state to show the invalid placement
        onGameStateChange({
          poles: newPoles,
          moves: gameState.moves,
          isComplete: false,
        });

        // After a short delay, return the ring to its original position
        setTimeout(() => {
          const revertPoles = [...gameState.poles];
          onGameStateChange({
            poles: revertPoles,
            moves: gameState.moves,
            isComplete: false,
          });
          setInvalidMove(null);

          // Show invalid move message
          onGameStateChange(gameState, true);
        }, 500);
      }

      setDraggedRing(null);
      return;
    }

    // Valid move - proceed normally
    const sourceRing = newPoles[draggedRing.fromPole].pop();
    if (sourceRing) {
      // Add ring to destination pole
      newPoles[toPole].push(sourceRing);

      const newMoves = gameState.moves + 1;
      const isComplete = checkWinCondition(newPoles);

      onGameStateChange({
        poles: newPoles,
        moves: newMoves,
        isComplete,
      });
    }

    setDraggedRing(null);
  };

  return (
    <Card
      className={`p-6 bg-white/95 backdrop-blur-sm h-full ${
        disabled ? "pointer-events-none opacity-75" : ""
      }`}
    >
      <div className="flex justify-center items-end h-full gap-6">
        {gameState.poles.map((pole, poleIndex) => (
          <div
            key={poleIndex}
            className="flex flex-col items-center"
            onDragOver={(e) => handleDragOver(e, poleIndex)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, poleIndex)}
          >
            {/* Pole */}
            <div className="relative">
              {/* Pole rod - taller to accommodate more rings */}
              <div
                className={`w-3 h-[250px] bg-amber-600 rounded-t-full ${
                  dragOverPole === poleIndex ? "bg-amber-500" : ""
                } ${invalidMove?.toPole === poleIndex ? "bg-red-500" : ""}`}
              />

              {/* Rings */}
              <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 flex flex-col-reverse items-center">
                {pole.map((ring, ringIndex) => {
                  const isTopRing = ringIndex === pole.length - 1;
                  const isDragging = draggedRing?.ring.id === ring.id;
                  const isInvalidRing = invalidMove?.ring.id === ring.id;

                  return (
                    <div
                      key={ring.id}
                      ref={isDragging ? dragRef : null}
                      draggable={isTopRing && !disabled}
                      onDragStart={() => handleDragStart(ring, poleIndex)}
                      className={`
                        relative flex items-center justify-center
                        w-[30px] h-[30px] rounded-full border-4
                        ${RING_COLORS[ring.color]}
                        ${
                          isTopRing && !disabled
                            ? "hover:scale-105 hover:shadow-lg cursor-pointer"
                            : "cursor-not-allowed"
                        }
                        ${isDragging ? "opacity-50 scale-105" : ""}
                        ${
                          isInvalidRing
                            ? "animate-pulse bg-red-500 border-red-600"
                            : ""
                        }
                        ${!isTopRing || disabled ? "pointer-events-none" : ""}
                        transition-all duration-200
                      `}
                      style={{
                        marginBottom: ringIndex === 0 ? "6px" : "1px",
                      }}
                    >
                      {/* Center image */}
                      <img
                        src={logo.src}
                        alt="logo"
                        className="absolute left-1/2 top-1/2 w-4 h-4 rounded-full object-contain"
                        style={{ transform: "translate(-50%, -50%)" }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Base */}
            <div
              className={`w-20 h-4 bg-amber-700 rounded-full mt-2 ${
                dragOverPole === poleIndex ? "bg-amber-600 shadow-lg" : ""
              } ${invalidMove?.toPole === poleIndex ? "bg-red-600" : ""}`}
            />

            {/* Pole label and color count */}
            <div className="mt-2 text-center">
              <div className="text-sm font-medium text-gray-600">
                Pole {poleIndex + 1}
              </div>
              <div className="text-xs text-gray-500">
                {new Set(pole.map((r) => r.color)).size}/4 colors
              </div>
              <div className="text-xs text-gray-400">
                {pole.length}/10 rings
              </div>
            </div>
          </div>
        ))}
      </div>

      {gameState.isComplete && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-lg">
          <div className="bg-white p-6 rounded-lg text-center">
            <h2 className="text-2xl font-bold text-green-600 mb-2">
              Congratulations!
            </h2>
            <p className="text-gray-600">
              You completed the puzzle in {gameState.moves} moves!
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
