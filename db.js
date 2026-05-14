/* ══════════════════════════════════════════════════
   DB.JS — Supabase Database Layer
   All data lives in the cloud. No localStorage.
   ══════════════════════════════════════════════════ */

'use strict';

const DB = (() => {
  let _sb = null;  // supabase client

  function init() {
    _sb = supabase.createClient(
      window.ECHICK_CONFIG.SUPABASE_URL,
      window.ECHICK_CONFIG.SUPABASE_ANON
    );
    return _sb;
  }

  // ─── Upsert / get player ───
  async function getOrCreatePlayer(tgUser) {
    const { id: telegram_id, first_name, last_name, username, photo_url, language_code } = tgUser;
    const { data, error } = await _sb
      .from('players')
      .upsert({
        telegram_id:   String(telegram_id),
        username:      username || first_name || 'Anonymous',
        display_name:  [first_name, last_name].filter(Boolean).join(' '),
        photo_url:     photo_url || null,
        language_code: language_code || 'en',
        last_seen:     new Date().toISOString(),
      }, { onConflict: 'telegram_id', ignoreDuplicates: false })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function getPlayer(telegram_id) {
    const { data, error } = await _sb
      .from('players')
      .select('*')
      .eq('telegram_id', String(telegram_id))
      .single();
    if (error) return null;
    return data;
  }

  // ─── Submit game run (with anti-cheat payload) ───
  async function submitRun(telegram_id, secPayload) {
    if (!secPayload || secPayload.suspicious) {
      // Still save but mark as suspicious
    }
    const { data: player } = await _sb
      .from('players')
      .select('coins, total_runs, total_coins, total_play_time, best_score, best_distance')
      .eq('telegram_id', String(telegram_id))
      .single();

    if (!player) throw new Error('Player not found');

    const newCoins    = (player.coins || 0) + secPayload.coins;
    const newTotal    = (player.total_coins || 0) + secPayload.coins;
    const newRuns     = (player.total_runs || 0) + 1;
    const newPlayTime = (player.total_play_time || 0) + secPayload.duration;
    const newBestScore = Math.max(player.best_score || 0, secPayload.score);
    const newBestDist  = Math.max(player.best_distance || 0, secPayload.distance);

    // Save run log
    await _sb.from('run_logs').insert({
      telegram_id:  String(telegram_id),
      score:        secPayload.score,
      coins:        secPayload.coins,
      distance:     secPayload.distance,
      duration:     secPayload.duration,
      suspicious:   secPayload.suspicious || false,
      flags:        secPayload.flags || [],
      session_id:   String(secPayload.sessionId),
      sig:          secPayload.sig,
      created_at:   new Date().toISOString(),
    });

    // Update player stats
    await _sb.from('players').update({
      coins:           newCoins,
      total_coins:     newTotal,
      total_runs:      newRuns,
      total_play_time: newPlayTime,
      best_score:      newBestScore,
      best_distance:   newBestDist,
      last_seen:       new Date().toISOString(),
    }).eq('telegram_id', String(telegram_id));

    return { newCoins, newBestScore, newBestDist };
  }

  // ─── Spend coins (store purchase) ───
  async function spendCoins(telegram_id, amount, item_id, item_type) {
    const { data: player } = await _sb
      .from('players')
      .select('coins, owned_characters')
      .eq('telegram_id', String(telegram_id))
      .single();
    if (!player) throw new Error('Player not found');
    if ((player.coins || 0) < amount) throw new Error('Not enough coins');

    const owned = player.owned_characters || [];
    if (item_type === 'character' && owned.includes(item_id)) throw new Error('Already owned');

    const updates = { coins: player.coins - amount };
    if (item_type === 'character') updates.owned_characters = [...owned, item_id];

    await _sb.from('players').update(updates).eq('telegram_id', String(telegram_id));
    // Log purchase
    await _sb.from('purchases').insert({ telegram_id: String(telegram_id), item_id, item_type, cost: amount, created_at: new Date().toISOString() });
    return true;
  }

  // ─── Equip character ───
  async function equipCharacter(telegram_id, char_id) {
    await _sb.from('players').update({ equipped_character: char_id }).eq('telegram_id', String(telegram_id));
  }

  // ─── Save wallet ───
  async function saveWallet(telegram_id, wallet) {
    await _sb.from('players').update({ wallet_address: wallet }).eq('telegram_id', String(telegram_id));
  }

  // ─── Leaderboard ───
  async function getLeaderboard(scope = 'global', limit = 20) {
    let query = _sb.from('players')
      .select('telegram_id,username,display_name,photo_url,best_score,best_distance,equipped_character,referral_count')
      .eq('is_banned', false)
      .order('best_score', { ascending: false })
      .limit(limit);

    if (scope === 'weekly') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = _sb.from('run_logs')
        .select('telegram_id, score, players!inner(username,display_name,best_distance,equipped_character)')
        .eq('suspicious', false)
        .gte('created_at', weekAgo)
        .order('score', { ascending: false })
        .limit(limit);
    }
    const { data, error } = await query;
    if (error) return [];
    return data;
  }

  // ─── Referrals ───
  async function recordReferral(referrer_id, new_user_id) {
    // Prevent self-ref and duplicate
    if (String(referrer_id) === String(new_user_id)) return false;
    const { data: existing } = await _sb.from('referrals')
      .select('id').eq('referrer_id', String(referrer_id)).eq('referred_id', String(new_user_id)).single();
    if (existing) return false;

    await _sb.from('referrals').insert({ referrer_id: String(referrer_id), referred_id: String(new_user_id), created_at: new Date().toISOString() });
    // Increment count
    const { data: p } = await _sb.from('players').select('referral_count').eq('telegram_id', String(referrer_id)).single();
    await _sb.from('players').update({ referral_count: (p?.referral_count || 0) + 1 }).eq('telegram_id', String(referrer_id));
    return true;
  }

  async function getReferralCount(telegram_id) {
    const { data } = await _sb.from('referrals').select('id', { count: 'exact' }).eq('referrer_id', String(telegram_id));
    return data?.length || 0;
  }

  // ─── Check captcha done ───
  async function hasDoneCaptcha(telegram_id) {
    const { data } = await _sb.from('players').select('captcha_done').eq('telegram_id', String(telegram_id)).single();
    return data?.captcha_done === true;
  }

  async function markCaptchaDone(telegram_id) {
    await _sb.from('players').update({ captcha_done: true }).eq('telegram_id', String(telegram_id));
  }

  // ─── Admin ───
  async function adminGetAllPlayers(limit = 50) {
    const { data } = await _sb.from('players').select('*').order('best_score', { ascending: false }).limit(limit);
    return data || [];
  }

  async function adminBanPlayer(telegram_id, ban = true) {
    await _sb.from('players').update({ is_banned: ban }).eq('telegram_id', String(telegram_id));
    await _sb.from('admin_logs').insert({ action: ban ? 'ban' : 'unban', target_id: String(telegram_id), created_at: new Date().toISOString() });
  }

  async function adminGetLogs(limit = 100) {
    const { data } = await _sb.from('run_logs').select('*').order('created_at', { ascending: false }).limit(limit);
    return data || [];
  }

  async function adminGetSuspiciousLogs() {
    const { data } = await _sb.from('run_logs').select('*').eq('suspicious', true).order('created_at', { ascending: false }).limit(50);
    return data || [];
  }

  async function getPlayerJSON(telegram_id) {
    const { data } = await _sb.from('players').select('*').eq('telegram_id', String(telegram_id)).single();
    return data;
  }

  return {
    init,
    getOrCreatePlayer, getPlayer,
    submitRun, spendCoins, equipCharacter, saveWallet,
    getLeaderboard,
    recordReferral, getReferralCount,
    hasDoneCaptcha, markCaptchaDone,
    adminGetAllPlayers, adminBanPlayer, adminGetLogs, adminGetSuspiciousLogs, getPlayerJSON,
  };
})();

window.DB = DB;
