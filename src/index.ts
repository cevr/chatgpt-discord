import dotenv from 'dotenv';
dotenv.config();
import Discord from 'discord.js';
import { ChatGPTAPI } from 'chatgpt';
import z from 'zod';
import { R, Option, pipe } from '@mobily/ts-belt';

const env = z.object({
  DISCORD_BOT_TOKEN: z.string(),
});

const { DISCORD_BOT_TOKEN } = env.parse(process.env);

const client = new Discord.Client({
  intents: [
    // just messaging
    Discord.IntentsBitField.Flags.DirectMessages,
    Discord.IntentsBitField.Flags.DirectMessageReactions,
    Discord.IntentsBitField.Flags.DirectMessageTyping,
    Discord.IntentsBitField.Flags.GuildMessages,
    Discord.IntentsBitField.Flags.GuildMessageReactions,
    Discord.IntentsBitField.Flags.GuildMessageTyping,
    Discord.IntentsBitField.Flags.MessageContent,
  ],
});

client.on('ready', () => {
  const bot = client.user!;
  console.log(`Logged in as ${bot.tag}!`);
});

client.on('message', async (message: Discord.Message) => {
  // Ignore messages from other bots
  if (message.author.bot) return;

  // Ignore messages that don't start with the prefix
  if (!message.content.startsWith('!')) return;

  await message.channel.sendTyping();
  const apiRes = await loadChatApi(message);

  if (R.isError(apiRes)) {
    message.channel.send('Something went wrong!');
    return;
  }

  const api = R.getExn(apiRes);
  const res = await api.sendMessage(message.content.slice(1));
  await message.channel.send(res);
});

client.login(DISCORD_BOT_TOKEN);

const userSessions = new Map<string, string>();

type LoadChatErrors = 'NO_SESSION_TOKEN' | 'AUTH_FAILED';

async function loadChatApi(
  message: Discord.Message
): Promise<R.Result<ChatGPTAPI, LoadChatErrors>> {
  // sessionToken is required; see below for details
  let sessionToken = userSessions.get(message.author.id);

  if (!sessionToken) {
    const res = await getSessionToken(message);

    if (R.isError(res)) {
      return R.Error('NO_SESSION_TOKEN');
    }

    sessionToken = R.getExn(res);
  }

  const api = new ChatGPTAPI({
    sessionToken,
  });

  // ensure the API is properly authenticated
  return R.fromPromise(api.ensureAuth()).then((res) =>
    R.isError(res) ? R.Error('AUTH_FAILED') : R.Ok(api)
  );
}

type GetSessionTokenErrors = 'COULD_NOT_GET_SESSION_TOKEN' | 'INVALID_MESSAGE';

async function getSessionToken(message: Discord.Message) {
  const dm = await message.author.createDM();
  await dm.send('Please enter your session token:');
  const response = await dm.awaitMessages({
    max: 1,
    time: 10000,
  });
  return R.fromFalsy(response.first()?.content, 'INVALID_MESSAGE');
}
