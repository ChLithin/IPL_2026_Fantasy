export const BASE = 'https://lithinsaikumar.pythonanywhere.com';

async function request(url, options = {}) {
  console.log("Requesting: " + BASE + url);
  const res = await fetch(BASE + url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  }).catch(err => {
    console.error("Fetch Exception:", err);
    throw new Error("Network error or CORS issue. Check console.");
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Server error (' + res.status + ')');
  }
  return await res.json();
}

export const api = {
  signup: (username, password, admin_password = '') =>
    request('/api/signup', { method: 'POST', body: JSON.stringify({ username, password, admin_password }) }),
  login: (username, password, admin_password = '') =>
    request('/api/login', { method: 'POST', body: JSON.stringify({ username, password, admin_password }) }),
  getPlayers: () => request('/api/players'),
  updatePlayer: (id, data) =>
    request(`/api/players/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deletePlayer: (id) =>
    request(`/api/players/${id}`, { method: 'DELETE' }),
  saveTeam: (username, player_ids) =>
    request('/api/team', { method: 'POST', body: JSON.stringify({ username, player_ids }) }),
  getTeam: (username) => request(`/api/team/${username}`),
  getUser: (username) => request(`/api/user/${username}`),
  createGroup: (username, name) =>
    request('/api/group', { method: 'POST', body: JSON.stringify({ username, name }) }),
  joinGroup: (username, code) =>
    request('/api/group/join', { method: 'POST', body: JSON.stringify({ username, code }) }),
  getLeaderboard: (code) => request(`/api/group/${code}/leaderboard`),
  getGroups: () => request('/api/groups'),
  getAllGroups: () => request('/api/groups/all'),
  kickUser: (code, username) =>
    request(`/api/groups/${code}/kick`, { method: 'POST', body: JSON.stringify({ username }) }),
  getSettings: () => request('/api/settings'),
  updateSettings: (allow_team_edit) =>
    request('/api/settings', { method: 'POST', body: JSON.stringify({ allow_team_edit }) }),
  getMatches: () => request('/api/admin/matches'),
  getPublicMatches: () => request('/api/matches'),
  getPublicMatchStats: (id) => request(`/api/match/${id}/stats`),
  createMatch: (team1, team2, date, description) =>
    request('/api/admin/match', { method: 'POST', body: JSON.stringify({ team1, team2, date, description }) }),
  getMatchPlayers: (matchId) => request(`/api/admin/match/${matchId}/players`),
  updateStats: (match_id, stats) =>
    request('/api/admin/stats', { method: 'POST', body: JSON.stringify({ match_id, stats }) }),
  resetWeekly: () => request('/api/admin/reset-weekly', { method: 'POST' }),
  recalculate: () => request('/api/admin/recalculate', { method: 'POST' }),
  getAdminUsers: () => request('/api/admin/users'),
  updateUser: (username, data) =>
    request(`/api/admin/users/${username}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteUser: (username) =>
    request(`/api/admin/users/${username}`, { method: 'DELETE' }),
  deleteMatch: (id) =>
    request(`/api/admin/match/${id}`, { method: 'DELETE' }),
  updateMatchStatus: (id, status) => request(`/api/admin/match/${id}/status`, { method: "PUT", body: JSON.stringify({status}) }),
  
  
  setRoles: (data) => request('/api/set-roles', { method: 'POST', body: JSON.stringify(data) }),
};

// Additional method for deleting groups
api.deleteGroup = (code) =>
  request(`/api/groups/${code}`, { method: 'DELETE' });

// League system (multi-league)
api.createLeague = (username, name) =>
  request('/api/league', { method: 'POST', body: JSON.stringify({ username, name }) });
api.joinLeague = (username, code) =>
  request('/api/league/join', { method: 'POST', body: JSON.stringify({ username, code }) });
api.leaveLeague = (username, code) =>
  request(`/api/league/${code}/leave`, { method: 'POST', body: JSON.stringify({ username }) });
api.getLeagueLeaderboard = (code) => request(`/api/league/${code}/leaderboard`);
api.getMyLeagues = (username) => request(`/api/user/${username}/leagues`);
api.getUserTeamPublic = (username) => request(`/api/user/${username}/team-public`);

// CricAPI integration
api.getCricApiConfig = () => request('/api/admin/cricapi/config');
api.updateCricApiConfig = (cricapi_key, auto_fetch, fetch_interval) =>
  request('/api/admin/cricapi/config', { method: 'POST', body: JSON.stringify({ cricapi_key, auto_fetch, fetch_interval }) });
api.getCricApiMatches = () => request('/api/admin/cricapi/matches');
api.getCricApiScorecard = (cricapiMatchId, localMatchId) =>
  request(`/api/admin/cricapi/scorecard/${cricapiMatchId}${localMatchId ? '?local_match_id=' + localMatchId : ''}`);
api.importCricApiStats = (match_id, cricapi_match_id, stats) =>
  request('/api/admin/cricapi/import', { method: 'POST', body: JSON.stringify({ match_id, cricapi_match_id, stats }) });
api.triggerAutoImport = () => request('/api/admin/cricapi/auto-import', { method: 'POST' });
api.getCricApiStatus = () => request('/api/admin/cricapi/status');

