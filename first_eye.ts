import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage, NewMessageEvent } from "telegram/events";
import { Api } from "telegram";
import * as dotenv from "dotenv";
import sharp from "sharp";
import * as readlineSync from "readline-sync";
import TelegramBot from "node-telegram-bot-api";

import { getPrompt } from "./service/first_eye_service";
import { Keyword, ScrapeGroups } from "./model/first_eye_model";
import { delay } from "./utils";
import { isAdmin, sendMessage } from "./utils/utils";
import { messages } from "./constant/message";
import { urls } from "./constant/constant";
import { callback } from "telegraf/typings/button";
import { Button } from "telegram/tl/custom/button";

dotenv.config();

// Telegram account infos
const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH as string;
const phoneNumber = process.env.PHONE_NUMBER as string;
const sessionString =
  "1BAAOMTQ5LjE1NC4xNjcuOTEAUMX0URugzLVMFr/BuEEYBYhJrj5uf0DOQeBCdqGE3dNXEtM+qElYf9POqE8ETNWKV663BKsSxdH6eZuM16xbx48NLXYUXwEEZPswmR2TtJOHVw04+bfCh+EkNRgdw2enk+3MuWjF/78MU08kMWmPoLPjW5prRoAJS4g44ZwYBY5wuhR2rjTQ2z+hRzTQeLyRAMzwt/PjSijKG4OfXh7eG7gCLdym8Z1arirtY/5SeEGFqhhsaAkCKa/XXnnX3uJgq47bguAD47quM1coENI7mmyOQ3Yc+cArU+9hIkpkL2TX9TXX1bWqKqA9Ws+I7E4w3mrIjVaj5QnV6VZFh7GYhbY=";
let scrapingStatus = true;
const postingGroup = "first_eye_ai";

// open ai infos
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiApiUrl = "https://api.openai.com/v1/chat/completions";

// bot infos
const botToken = process.env.FIRST_EYE_BOT_TOKEN || "";
const bot = new TelegramBot(botToken, { polling: true });

let postGroups: ScrapeGroups[] = [];
let keywords: Keyword[] = [];
let isChangedPostGroups = true;
let isChangedKeywords = true;

// Initialize the Telegram client
const client = new TelegramClient(
  new StringSession(sessionString),
  apiId,
  apiHash,
  {
    connectionRetries: 5,
  }
);

const startTelegramClient = async () => {
  // Start the client and handle authentication
  await client.start({
    phoneNumber: async () => phoneNumber,
    password: async () =>
      readlineSync.question("Enter your 2FA passwrd: ", { hideEchoBack: true }),
    phoneCode: async () =>
      readlineSync.question("Enter the code you received: "),
    onError: (err) => console.error(err),
  });

  console.log("Clinet is logged in!");
  console.log("Session saved:", client.session.save());

  const postingGroupEntity = await client.getEntity(postingGroup);

  // Listen for new messages in the groups you have joined manually
  client.addEventHandler(async (event: NewMessageEvent) => {
    try {
      if (!scrapingStatus) return;
      const message = event.message;

      if (message && message.peerId) {
        let chatId: string | undefined;
        let chatTitle: string = "";

        // Check if it is a channel or group
        if (message.peerId instanceof Api.PeerChannel) {
          chatId = message.peerId.channelId.toString();
        } else if (message.peerId instanceof Api.PeerChat) {
          chatId = message.peerId.chatId.toString();
        } else if (message.peerId instanceof Api.PeerUser) {
          chatId = message.peerId.userId.toString();
        }

        if (isChangedPostGroups || postGroups.length === 0) {
          postGroups = await ScrapeGroups.findAll();
          isChangedPostGroups = false;
        }

        if (!postGroups.some((group) => group.groupId === chatId)) return;

        // Determine the chat title based on the chat type
        // console.log(event);
        if (
          message.chat instanceof Api.Channel ||
          message.chat instanceof Api.Chat
        ) {
          chatTitle = message.chat.title;
        } else if (message.chat instanceof Api.User) {
          chatTitle = `${message.chat.firstName} ${message.chat.lastName}`;
        }

        console.log({ chatId });
        console.log({ chatTitle });

        // Log the message deatils in the console
        const messageText = message.message || message.text;

        const links: { text: string; url: string }[] = [];
        if (message.entities) {
          for (const entity of message.entities) {
            if (
              entity.className === "MessageEntityTextUrl" &&
              "url" in entity
            ) {
              const startOffset = entity.offset;
              const endOffset = startOffset + entity.length;
              const text = messageText.substring(startOffset, endOffset);
              links.push({ text, url: entity.url });
            }
          }
        }

        if (isChangedKeywords || keywords.length === 0) {
          keywords = await Keyword.findAll();
          isChangedKeywords = false;
        }
        if (
          !keywords.some((filterStr) =>
            messageText.toLowerCase().includes(filterStr.keyword)
          )
        )
          return;

        const formattedMessage = await formatWithChatGPT(messageText, links);

        if (!formattedMessage || formattedMessage.includes("THIS_IS_NOT"))
          return;

        // Check if the message contains media(like a photo or document)
        const photo = message.media;
        let mediaStatus = false;
        if (photo) {
          const outputPath = `downloads/photo_${Date.now()}.jpg`;

          const photoPath = await client.downloadMedia(photo, {});
          if (photoPath) {
            await sharp(photoPath)
              .jpeg() // Convert to JPEG
              .toFile(outputPath) // Save the converted file
              .then(async () => {
                // send the photo to the target group
                await client.sendFile(postingGroupEntity, {
                  file: outputPath,
                  caption: formattedMessage,
                  attributes: [
                    new Api.DocumentAttributeFilename({
                      fileName: outputPath,
                    }),
                  ],
                  forceDocument: false,
                });

                mediaStatus = true;
              })
              .catch((err) => {
                console.error("Error converting image: ", err);
              });
          }
        }
        if (!mediaStatus) {
          await client.sendMessage(postingGroupEntity, {
            message: formattedMessage,
          });
        }
        console.log("Reposted successfully.");

        // console.log({ messageText });
      }
    } catch (error) {
      console.error("Error processing new message", error);
    }
  }, new NewMessage({}));
};

// call openai gpt api
const formatWithChatGPT = async (
  messageText: string,
  links: { text: string; url: string }[]
) => {
  const prompt = getPrompt(messageText, links);

  const response = await fetch(openaiApiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const data = await response.json();
  console.log("successfully retrieved from chatgpt api");
  return data.choices[0]?.message?.content?.trim();
};

// Start the Telegram Client
startTelegramClient().catch((err) => {
  console.error("Error in starting Telegram client: ", err);
});

bot.onText(/^\/start_search$/, (msg) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return sendMessage(bot, chatId, messages.unauthorizedAccess);

  if (scrapingStatus) {
    sendMessage(bot, chatId, messages.firstEye.scrapingIsProgress);
  } else {
    scrapingStatus = true;
    sendMessage(bot, chatId, messages.firstEye.scrapingStarted);
  }
});

bot.onText(/\/stop_search/, (msg) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return sendMessage(bot, chatId, messages.unauthorizedAccess);

  if (scrapingStatus) {
    scrapingStatus = false;
    sendMessage(bot, chatId, messages.firstEye.scrapingStopped);
  } else {
    sendMessage(bot, chatId, messages.firstEye.scrapingNotRunning);
  }
});

bot.onText(/\/status_search/, (msg) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return sendMessage(bot, chatId, messages.unauthorizedAccess);

  const statusMessage = scrapingStatus
    ? messages.firstEye.scrapingCurrentlyActived
    : messages.firstEye.scrapingCurrentlyStopped;

  sendMessage(bot, chatId, statusMessage);
});

bot.onText(/\/add_keyword (.+)/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return sendMessage(bot, chatId, messages.unauthorizedAccess);

  const params = match![1].trim();

  try {
    const keywordObject = await Keyword.findOne({
      where: { keyword: params },
    });
    if (keywordObject) {
      return sendMessage(bot, chatId, messages.firstEye.keywordAlreadyExist);
    }

    console.log(params);
    await Keyword.create({ keyword: params });
    isChangedKeywords = true;
    sendMessage(bot, chatId, messages.firstEye.keywordAdded);
  } catch (err) {
    console.error("Database error: ", err);
    sendMessage(bot, chatId, messages.accessDBError);
  }
});

bot.onText(/\/delete_keyword (.+)/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return sendMessage(bot, chatId, messages.unauthorizedAccess);

  const params = match![1].trim();

  try {
    const keywordObject = await Keyword.findOne({
      where: { keyword: params },
    });
    if (!keywordObject) {
      return sendMessage(bot, chatId, messages.firstEye.keywordNotExist);
    }

    await Keyword.destroy({ where: { keyword: params } });
    isChangedKeywords = true;
    sendMessage(bot, chatId, messages.firstEye.keywordDeleted, {
      keyword: params,
    });
  } catch (err) {
    console.error("Database error: ", err);
    sendMessage(bot, chatId, messages.accessDBError);
  }
});

bot.onText(/\/show_keywords/, async (msg) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return sendMessage(bot, chatId, messages.unauthorizedAccess);

  try {
    const keywordObject = await Keyword.findAll({
      order: [["keyword", "ASC"]],
    });
    if (!keywordObject || keywordObject.length === 0) {
      return sendMessage(bot, chatId, messages.firstEye.noKeywords);
    }

    let msg = `📃 There are ${keywordObject.length} keywords.\n\n${keywordObject
      .map((item) => "- " + item.keyword)
      .join("\n")}`;

    sendMessage(bot, chatId, msg);
  } catch (err) {
    console.error("Database error: ", err);
    sendMessage(bot, chatId, messages.accessDBError);
  }
});

bot.onText(/\/add_group (.+)/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return sendMessage(bot, chatId, messages.unauthorizedAccess);

  const groupIndetifier = match![1].trim();
  if (!groupIndetifier) {
    return sendMessage(bot, chatId, messages.firstEye.addGroupInvalidFormat);
  }

  try {
    const groupEntity = await client.getEntity(groupIndetifier);

    let groupId: string | undefined;
    let groupName: string = "";
    let groupTitle: string = "";

    if (groupEntity instanceof Api.Channel) {
      groupId = groupEntity.id.toString();
      groupName = groupEntity.username || "N/A";
      groupTitle = groupEntity.title || "No Title";
    } else {
      return sendMessage(bot, chatId, messages.firstEye.invalidGroup);
    }

    const groupObj = await ScrapeGroups.findOne({ where: { groupId } });
    if (groupObj) {
      return sendMessage(bot, chatId, messages.firstEye.groupIsAlreadyExist);
    }
    await ScrapeGroups.create({ groupId, groupName, groupTitle });
    sendMessage(bot, chatId, messages.firstEye.groupAdded, {
      groupTitle,
      groupId,
      groupName,
    });
    isChangedPostGroups = true;
  } catch (err) {
    console.error("Error fetching group entity: ", err);
    sendMessage(bot, chatId, messages.firstEye.invalidGroupForamt);
  }
});

bot.onText(/\/end_group (.+)/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return sendMessage(bot, chatId, messages.unauthorizedAccess);

  const groupIndetifier = match![1].trim();
  if (!groupIndetifier) {
    return sendMessage(bot, chatId, messages.firstEye.addGroupInvalidFormat);
  }

  try {
    const groupEntity = await client.getEntity(groupIndetifier);

    let groupId: string | undefined;

    if (groupEntity instanceof Api.Channel) {
      groupId = groupEntity.id.toString();
    } else {
      return sendMessage(bot, chatId, messages.firstEye.invalidGroup);
    }

    const groupObj = await ScrapeGroups.findOne({ where: { groupId } });
    if (!groupObj) {
      return sendMessage(bot, chatId, messages.firstEye.groupNotExist);
    }
    await groupObj.destroy();
    sendMessage(bot, chatId, messages.firstEye.groupRemoved);
    isChangedPostGroups = true;
  } catch (err) {
    console.error("Error fetching group entity: ", err);
    sendMessage(bot, chatId, messages.firstEye.invalidGroupForamt);
  }
});

bot.onText(/\/show_groups/, async (msg) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return sendMessage(bot, chatId, messages.unauthorizedAccess);

  try {
    const groups = await ScrapeGroups.findAll();
    if (!groups || groups.length === 0) {
      return sendMessage(bot, chatId, messages.firstEye.NotGroup);
    }

    const chunkSize = 10;
    const checks: ScrapeGroups[][] = [];

    for (let i = 0; i < groups.length; i += chunkSize) {
      const chunk = groups.slice(i, i + chunkSize);
      checks.push(chunk);
    }

    sendMessage(bot, chatId, messages.firstEye.CountGroup, {
      count: groups.length,
    });
    await delay(0.1);
    for (const chunk of checks) {
      let msg = `${chunk
        .map(
          (group) =>
            `- 📌 Group Title: ${group.groupTitle}\n  🆔 Username: ${
              group.groupName || "N/A"
            }\n  👤 Group ID: ${group.groupId}\n  🔗 Link: https://t.me/${
              group.groupName
            }\n`
        )
        .join("\n")}`;
      sendMessage(bot, chatId, msg);
      await delay(0.1);
    }
  } catch (err) {
    console.error("Error fetching group entity: ", err);
    sendMessage(bot, chatId, messages.firstEye.invalidGroupForamt);
  }
});

bot.onText(/^\/start$/, (msg) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return sendMessage(bot, chatId, messages.unauthorizedAccess);

  bot.sendMessage(chatId, messages.startDescription);
});

bot.onText(/\/getid (.+)/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id?.toString() || "";

  const groupIndetifier = match![1].trim();
  if (!groupIndetifier) {
    return sendMessage(bot, chatId, messages.firstEye.invalidGroup);
  }

  try {
    const groupEntity = await client.getEntity(groupIndetifier);

    let groupId: string | undefined;
    let groupName: string = "";
    let groupTitle: string = "";

    if (groupEntity instanceof Api.Channel) {
      groupId = groupEntity.id.toString();
      groupName = groupEntity.username || "N/A";
      groupTitle = groupEntity.title || "No Title";
    } else if (groupEntity instanceof Api.User) {
      groupId = groupEntity.id.toString();
      groupName = groupEntity.username || "N/A";
      groupTitle =
        groupEntity.firstName + " " + groupEntity.lastName || "No Title";
    } else {
      return sendMessage(bot, chatId, messages.firstEye.invalidGroup);
    }

    sendMessage(bot, chatId, messages.firstEye.groupInfo, {
      groupTitle,
      groupId,
      groupName,
    });
  } catch (err) {
    console.error("Error fetching group entity: ", err);
    sendMessage(bot, chatId, messages.firstEye.invalidGroupForamt);
  }
});

bot.on("callback_query", (callbackQuery) => {
  const chatId = callbackQuery.message?.chat.id || "";
  const data = callbackQuery.data; // This will contain "show_ca <contractAdd>"

  const contractAdd = data?.split(" ")[1];

  console.log(contractAdd);
  bot.sendMessage(
    chatId,
    `Redirecting you to the Scope Eye bot: ${urls.scopeBot} with command \n/show_ca ${contractAdd}`
  );
});
