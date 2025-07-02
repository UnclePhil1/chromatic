"use client";

import React from "react";
import { supabase } from "@/lib/supabase";

function GOR(lamports: number) {
  return (lamports / 1_000_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

function PlatformStats() {
  const [stats, setStats] = React.useState<any>(null);
  React.useEffect(() => {
    supabase
      .from("stats")
      .select("*")
      .eq("id", 1)
      .single()
      .then(({ data }) => setStats(data));
  }, []);
  if (!stats) return null;
  return (
    <div className="my-4 text-[#00d4aa] text-center z-50 flex flex-row py-2 px-6 rounded-lg border-[#00d4aa]/40 bg-[#151e28]/90 backdrop-blur-sm gap-4">
      <div className="text-white">
        Total GOR Bet:
        <b>
          <p className="text-[#00b4aa]">{GOR(stats.total_bet)}</p>
        </b>
      </div>
      <div className="text-white">
        Total GOR Wins:
        <b>
          <p className="text-[#00b4aa]">{GOR(stats.total_won)}</p>
        </b>
      </div>
      {/* <div>Total GOR Lost: <b>{GOR(stats.total_lost)}</b></div> */}
      <div className="text-white">
        Total Challenges:
        <b>
          <p className="text-[#00b4aa]">{stats.total_challenges}</p>
        </b>
      </div>
    </div>
  );
}

export default PlatformStats;
