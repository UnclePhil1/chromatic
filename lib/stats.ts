import { supabase } from './supabase';

export async function updatePlatformStats({ bet = 0, won = 0, lost = 0, challenge = 0 }) {
  const { data, error } = await supabase.from("stats").select("*").eq("id", 1).single();
  if (error && error.code !== "PGRST116") return;
  const stats = data || { total_bet: 0, total_won: 0, total_lost: 0, total_challenges: 0 };
  await supabase.from("stats").upsert({
    id: 1,
    total_bet: stats.total_bet + bet,
    total_won: stats.total_won + won,
    total_lost: stats.total_lost + lost,
    total_challenges: stats.total_challenges + challenge,
    updated_at: new Date().toISOString(),
  });
}

export async function updateLeaderboard({
  player,
  wallet,
  won = 0,
  lost = 0,
  challenge = 0,
}: { player: string; wallet: string; won?: number; lost?: number; challenge?: number }) {
  const { data } = await supabase
    .from("leaderboard")
    .select("*")
    .eq("wallet", wallet)
    .single();
  const stats = data || { gor_won: 0, gor_lost: 0, challenges: 0 };
  await supabase.from("leaderboard").upsert({
    player_name: player,
    wallet,
    gor_won: stats.gor_won + won,
    gor_lost: stats.gor_lost + lost,
    challenges: stats.challenges + challenge,
    updated_at: new Date().toISOString(),
  });
}

export async function getLeaderboard(limit = 10) {
  const { data } = await supabase
    .from("leaderboard")
    .select("*")
    .order("gor_won", { ascending: false })
    .limit(limit);
  return data || [];
}