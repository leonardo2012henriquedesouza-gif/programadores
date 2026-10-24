require('dotenv').config();
const express = require('express');
const path = require('path');
const { Client, GatewayIntentBits, ActivityType } = require('discord.js');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
const PORT = Number(process.env.PORT || 3000);
const bots = new Map();
const labels = [
  { name: 'Bot de Transmissão', mode: 'stream' },
  { name: 'Bot de Atendimento', mode: 'support' },
  { name: 'Bot Online 03', mode: 'online' },
  { name: 'Bot Online 04', mode: 'online' }
];

function statusOf(id) {
  const entry = bots.get(id);
  return { id, name: labels[id - 1].name, mode: labels[id - 1].mode,
    configured: Boolean(process.env[`BOT_TOKEN_${id}`]),
    state: !entry ? 'offline' : entry.error ? 'error' : entry.client.isReady() ? 'online' : 'connecting',
    username: entry?.client.user?.tag || null, error: entry?.error || null };
}
function allStatus() { return labels.map((_, i) => statusOf(i + 1)); }

async function startBot(id) {
  const token = process.env[`BOT_TOKEN_${id}`];
  if (!token) throw new Error(`Configure BOT_TOKEN_${id} no arquivo .env.`);
  const existing = bots.get(id);
  if (existing && !existing.error) return statusOf(id);
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  const entry = { client, error: null };
  bots.set(id, entry);
  client.once('ready', () => {
    try {
      if (id === 1) {
        const url = process.env.STREAM_URL || 'https://www.twitch.tv/discord';
        client.user.setPresence({ status: 'online', activities: [{ name: '/panel', type: ActivityType.Streaming, url }] });
      } else if (id === 2) {
        client.user.setPresence({ status: 'online', activities: [{ name: 'Desenvolvendo seu Atendimento', type: ActivityType.Playing }] });
      } else {
        client.user.setPresence({ status: 'online', activities: [] });
      }
    } catch (e) { entry.error = e.message; }
  });
  client.on('error', e => { entry.error = e.message; });
  try { await client.login(token); } catch (e) { entry.error = e.message; throw e; }
  return statusOf(id);
}
async function stopBot(id) {
  const entry = bots.get(id);
  if (entry) { try { entry.client.destroy(); } finally { bots.delete(id); } }
  return statusOf(id);
}
app.get('/api/status', (_req, res) => res.json({ bots: allStatus() }));
app.post('/api/bots/:id/start', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || id > 4) return res.status(400).json({ error: 'Bot inválido.' });
  try { await startBot(id); res.json({ bots: allStatus() }); }
  catch (e) { res.status(400).json({ error: e.message, bots: allStatus() }); }
});
app.post('/api/bots/:id/stop', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1 || id > 4) return res.status(400).json({ error: 'Bot inválido.' });
  await stopBot(id); res.json({ bots: allStatus() });
});
app.post('/api/bots/start-all', async (_req, res) => {
  const errors = [];
  for (let id = 1; id <= 4; id++) { try { await startBot(id); } catch (e) { errors.push(`Bot ${id}: ${e.message}`); } }
  res.json({ bots: allStatus(), errors });
});
app.post('/api/bots/stop-all', async (_req, res) => {
  for (let id = 1; id <= 4; id++) await stopBot(id);
  res.json({ bots: allStatus() });
});
app.listen(PORT, () => console.log(`Painel disponível em http://localhost:${PORT}`));
