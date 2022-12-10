import dotenv from 'dotenv';
dotenv.config();
import Discord from 'discord.js';
import { ChatGPTAPI } from 'chatgpt';
import z from 'zod';
import { AsyncResult, Result } from './lib';

const env = z.object({
  DISCORD_BOT_TOKEN: z.string(),
  CHATGPT_SESSION: z.string(),
});

const { DISCORD_BOT_TOKEN, CHATGPT_SESSION } = env.parse(process.env);

const client = new Discord.Client({
  intents: [
    // just messaging
    Discord.IntentsBitField.Flags.Guilds,
    Discord.IntentsBitField.Flags.DirectMessages,
    Discord.IntentsBitField.Flags.DirectMessageReactions,
    Discord.IntentsBitField.Flags.DirectMessageTyping,
    Discord.IntentsBitField.Flags.GuildMessages,
    Discord.IntentsBitField.Flags.GuildMessageReactions,
    Discord.IntentsBitField.Flags.GuildMessageTyping,
    Discord.IntentsBitField.Flags.MessageContent,
  ],
  partials: [
    Discord.Partials.Channel,
    Discord.Partials.GuildMember,
    Discord.Partials.Message,
    Discord.Partials.Reaction,
    Discord.Partials.User,
  ],
});

const conversations = new Map<string, string>();

client.on(Discord.Events.ClientReady, async () => {
  const bot = client.user!;
  console.log(`Logged in as ${bot.tag}!`);
  console.log(
    'Invite link: https://discord.com/oauth2/authorize?client_id=' +
      bot.id +
      // every permission related to messaging,direct messaging, and reactions
      '&permissions=2148005952&scope=bot'
  );
});

client.on(Discord.Events.MessageCreate, async (message: Discord.Message) => {
  if (message.author.bot) {
    return;
  }

  await AsyncResult.of(message.channel.sendTyping(), 'Could not send typing')
    .flatMap(() => loadChatApi(message))
    .flatMap((api) => {
      const conversationId =
        conversations.get(message.author.id) ??
        api.getConversation().conversationId;
      console.log('conversationId', conversationId);
      conversations.set(message.author.id, conversationId);
      return AsyncResult.of(
        api.sendMessage(
          `${message.content} \n Please ensure your response is below 2000 characters.`,
          {
            conversationId,
          }
        ),
        'Could not send ChatGPT message'
      );
    })
    .tap((res) => console.log('Sent ChatGPT message'))
    .map((res) => chunkString(res, 2000))
    .tap((chunks) => console.log('Chunked ChatGPT message', chunks))
    .flatMap((chunks) =>
      AsyncResult.sequenceSeq(
        chunks.map((chunk) =>
          AsyncResult.of(
            message.channel.send(chunk) as Promise<Discord.Message<boolean>>,
            'Could not send message'
          )
        )
      )
    )
    .tap((res) => console.log('Sent message'))
    .fold(
      (err) => {
        console.error(err);
        message.channel.send(`Error: ${err}`);
      },
      () => {}
    );
});

client.login(DISCORD_BOT_TOKEN);

const userSessions = new Map<string, string>();

type LoadChatErrors = 'NO_SESSION_TOKEN' | 'AUTH_FAILED';

function loadChatApi(message: Discord.Message) {
  // sessionToken is required; see below for details
  // let sessionToken = userSessions.get(message.author.id);

  // if (!sessionToken) {
  //   const res = await getSessionToken(message);

  //   if (R.isError(res)) {
  //     return R.Error('NO_SESSION_TOKEN');
  //   }

  //   sessionToken = R.getExn(res);
  // }

  // ensure the API is properly authenticated
  const api = new ChatGPTAPI({
    sessionToken: CHATGPT_SESSION,
  });

  return AsyncResult.of(
    api.ensureAuth().then(() => api),
    () => 'AUTH_FAILED' as LoadChatErrors
  );
}

type GetSessionTokenErrors =
  | 'COULD_NOT_GET_SESSION_TOKEN'
  | 'COULD_NOT_CREATE_DM'
  | 'COULD_NOT_SEND_DM'
  | 'DM_TIMED_OUT';

function getSessionToken(message: Discord.Message) {
  return AsyncResult.of(
    message.author.createDM(),
    () => 'COULD_NOT_CREATE_DM' as GetSessionTokenErrors
  ).flatMap((dm) =>
    AsyncResult.of(
      dm.send('Please enter your session token'),
      () => 'COULD_NOT_SEND_DM' as GetSessionTokenErrors
    ).flatMap(() =>
      AsyncResult.of(
        dm.awaitMessages({
          max: 1,
          time: 60000,
        }),
        () => 'DM_TIMED_OUT' as GetSessionTokenErrors
      )
        .map((response) => response.first()?.content)
        .map((content) =>
          Result.fromFalsy(
            content,
            () => 'COULD_NOT_GET_SESSION_TOKEN' as GetSessionTokenErrors
          )
        )
    )
  );
}

// we need to chunk the message into 2000 character chunks
// but also we need to ensure that we don't split a word or a code block
// so we also need to find the correct split point
function chunkString(str: string, maxLength: number): string[] {
  // If the length of the string is less than or equal to the maximum length,
  // return the string as a single-element array
  if (str.length <= maxLength) {
    return [str];
  }

  // Split the string into an array of words and strings in backticks
  const wordsAndBackticks = str.split(/(\`[^`]*\`)/);

  // Initialize the result array
  const result: string[] = [];

  // Initialize a string to accumulate the current chunk
  let chunk = '';

  // Iterate over the words and backticks
  for (const wordOrBacktick of wordsAndBackticks) {
    // If the current chunk + the current word or backtick is too long,
    // add the current chunk to the result array and reset the chunk
    if (chunk.length + wordOrBacktick.length > maxLength) {
      result.push(chunk);
      chunk = '';
    }

    // Add the current word or backtick to the current chunk
    chunk += wordOrBacktick;
  }

  // If there is a remaining chunk, add it to the result array
  if (chunk.length > 0) {
    result.push(chunk);
  }

  // Return the result array
  return result;
}
