'use client'
import React from "react";
import { getLeaderboard } from "@/lib/stats";

function Leaderboard() {
  const [leaders, setLeaders] = React.useState<any[]>([]);
  React.useEffect(() => {
    getLeaderboard().then(setLeaders);
  }, []);
  return (
    <div className="my-8 max-w-2xl mx-auto bg-[#1a242f] p-6 rounded-lg shadow-lg">
      <h2 className="text-xl font-bold mb-2 text-[#00d4aa]">Leaderboard</h2>
      <table className="w-full bg-[#151e28] border border-[#00d4aa]/20 rounded-lg">
        <thead>
          <tr className="text-[#00d4aa]">
            <th className="p-2">Player</th>
            <th className="p-2">Wallet</th>
            <th className="p-2">GOR Won</th>
            <th className="p-2">Challenges</th>
          </tr>
        </thead>
        <tbody>
          {leaders.map((row) => (
            <tr key={row.wallet} className="text-white text-center">
              <td className="p-2 text-white">{row.player_name}</td>
              <td className="p-2 text-white">{row.wallet.slice(0, 6)}...{row.wallet.slice(-4)}</td>
              <td className="p-2 text-white">GOR{(row.gor_won)}</td>
              <td className="p-2 text-white">{row.challenges}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default Leaderboard;