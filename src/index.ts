import dotenv from 'dotenv';
dotenv.config();
import Discord from 'discord.js';
import { ChatGPTAPI } from 'chatgpt';
import z from 'zod';
import * as TE from 'fp-ts/TaskEither';
import * as Task from 'fp-ts/Task';
import { pipe } from 'fp-ts/function';

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

  pipe(
    Task.of(() => message.channel.sendTyping()),
    TE.fromTask,
    TE.chain(() => loadChatApi(message)),
    TE.chain((api) =>
      TE.tryCatch(
        () =>
          api.sendMessage(
            `${message.content} \n Please ensure your response is below 2000 characters.`
          ),
        () => 'Could not send message'
      )
    ),
    TE.map((res) => chunkString(res, 2000)),
    //

    TE.map((chunks) =>
      chunks.map((chunk) =>
        TE.tryCatch(
          () => message.channel.send(chunk),
          () => 'Could not send message'
        )
      )
    ),
    TE.chain((chunks) => TE.sequenceSeqArray(chunks)),
    TE.match(
      (err) => {
        console.error(err);
        message.channel.send('An error occurred');
      },
      (res) => {}
    )
  )();
});

client.login(DISCORD_BOT_TOKEN);

const userSessions = new Map<string, string>();

type LoadChatErrors = 'NO_SESSION_TOKEN' | 'AUTH_FAILED';

function loadChatApi(
  message: Discord.Message
): TE.TaskEither<LoadChatErrors, ChatGPTAPI> {
  // sessionToken is required; see below for details
  // let sessionToken = userSessions.get(message.author.id);

  // if (!sessionToken) {
  //   const res = await getSessionToken(message);

  //   if (R.isError(res)) {
  //     return R.Error('NO_SESSION_TOKEN');
  //   }

  //   sessionToken = R.getExn(res);
  // }

  const api = new ChatGPTAPI({
    sessionToken: CHATGPT_SESSION,
  });

  // ensure the API is properly authenticated
  return TE.tryCatch(
    () => api.ensureAuth().then(() => api),
    () => 'AUTH_FAILED'
  );
}

type GetSessionTokenErrors =
  | 'COULD_NOT_GET_SESSION_TOKEN'
  | 'COULD_NOT_CREATE_DM'
  | 'COULD_NOT_SEND_DM'
  | 'DM_TIMED_OUT';

function getSessionToken(
  message: Discord.Message
): TE.TaskEither<GetSessionTokenErrors, string> {
  return pipe(
    TE.tryCatch(
      () => message.author.createDM(),
      () => 'COULD_NOT_CREATE_DM' as GetSessionTokenErrors
    ),
    TE.chain((dm) =>
      pipe(
        TE.tryCatch(
          () => dm.send('Please enter your session token'),
          () => 'COULD_NOT_SEND_DM' as GetSessionTokenErrors
        ),
        TE.chain(() =>
          TE.tryCatch(
            () =>
              dm.awaitMessages({
                max: 1,
                time: 60000,
              }),
            () => 'DM_TIMED_OUT' as GetSessionTokenErrors
          )
        ),
        TE.chain((response) => {
          const content = response.first()?.content;
          return content
            ? TE.right(content)
            : TE.left('COULD_NOT_GET_SESSION_TOKEN' as GetSessionTokenErrors);
        })
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
