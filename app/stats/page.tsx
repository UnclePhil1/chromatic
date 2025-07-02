import React from "react";
import PlatformStats from "@/components/statsUi";
// import Leaderboard from "@/components/leaderboard";

export default function StatsPage() {
  return (
    <div className="w-full min-h-screen p-6 bg-[#151e28]">
      <PlatformStats />
      {/* <Leaderboard /> */}
    </div>
  );
}
