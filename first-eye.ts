import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { NewMessage, NewMessageEvent } from "telegram/events";
import { Api } from "telegram";
import * as dotenv from "dotenv";
import sharp from "sharp";
import * as readlineSync from "readline-sync";
import TelegramBot from "node-telegram-bot-api";

import { getPrompt } from "./service/first-eye-service";
import { Keyword, ScrapeGroups } from "./model/first_eye_model";
import { chunks } from "telegram/Utils";
import { delay } from "./utils";

dotenv.config();

// Telegram account infos
const apiId = Number(process.env.API_ID);
const apiHash = process.env.API_HASH as string;
const phoneNumber = process.env.PHONE_NUMBER as string;
const sessionString =
  "1BAAOMTQ5LjE1NC4xNjcuOTEAUMX0URugzLVMFr/BuEEYBYhJrj5uf0DOQeBCdqGE3dNXEtM+qElYf9POqE8ETNWKV663BKsSxdH6eZuM16xbx48NLXYUXwEEZPswmR2TtJOHVw04+bfCh+EkNRgdw2enk+3MuWjF/78MU08kMWmPoLPjW5prRoAJS4g44ZwYBY5wuhR2rjTQ2z+hRzTQeLyRAMzwt/PjSijKG4OfXh7eG7gCLdym8Z1arirtY/5SeEGFqhhsaAkCKa/XXnnX3uJgq47bguAD47quM1coENI7mmyOQ3Yc+cArU+9hIkpkL2TX9TXX1bWqKqA9Ws+I7E4w3mrIjVaj5QnV6VZFh7GYhbY=";
let scrapingStatus = true;
const postingGroup = "test_first_eye";

// open ai infos
const openaiApiKey = process.env.OPENAI_API_KEY;
const openaiApiUrl = "https://api.openai.com/v1/chat/completions";

// bot infos
const botToken = process.env.FIRST_EYE_BOT_TOKEN || "";
const bot = new TelegramBot(botToken, { polling: true });
const admins = ["6734092774", "536896732", "6789048677"];

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

        const formattedMessage = await formatWithChatGPT(messageText);

        console.log(formattedMessage);

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
const formatWithChatGPT = async (messageText: string) => {
  const prompt = getPrompt(messageText);

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

const isAdmin = (userId: string) => admins.includes(userId);

bot.onText(/^\/start_search$/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return bot.sendMessage(chatId, "❌ Unauthorized access!");

  if (scrapingStatus) {
    bot.sendMessage(chatId, "⌛ Scraping is already in progress.");
  } else {
    scrapingStatus = true;
    bot.sendMessage(chatId, "🌟 Scraping started.");
  }
});

bot.onText(/\/stop_search/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return bot.sendMessage(chatId, "❌ Unauthorized access!");

  if (scrapingStatus) {
    scrapingStatus = false;
    bot.sendMessage(chatId, "🤚 Scraping stopped.");
  } else {
    bot.sendMessage(chatId, "🤚 Scraping is not running.");
  }
});

bot.onText(/\/status_search/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return bot.sendMessage(chatId, "❌ Unauthorized access!");

  const statusMessage = scrapingStatus
    ? "✅ Scraping is currently *active*."
    : "🛑 Scraping is currently *stopped*.";

  bot.sendMessage(chatId, statusMessage);
});

bot.onText(/\/add_keyword (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return bot.sendMessage(chatId, "❌ Unauthorized access!");

  const params = match![1].trim();
  console.log(params);
  // if (params.length !== 1) {
  //   return bot.sendMessage(
  //     chatId,
  //     "⚠ Invalid command format. Space is not allowed. The correct format is:\n\n/add_keyword <keyword>"
  //   );
  // }

  try {
    const keywordObject = await Keyword.findOne({
      where: { keyword: params },
    });
    if (keywordObject) {
      return bot.sendMessage(chatId, "🔔 This keyword already exists");
    }

    await Keyword.create({ keyword: params });
    isChangedKeywords = true;
    bot.sendMessage(chatId, "👌 New keyword has been successfully added");
  } catch (err) {
    console.error("Database error: ", err);
    bot.sendMessage(
      chatId,
      "⚠ An error occurred while accessing the database. Please try again."
    );
  }
});

bot.onText(/\/delete_keyword (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return bot.sendMessage(chatId, "❌ Unauthorized access!");

  const params = match![1].trim();
  // if (params.length !== 1) {
  //   return bot.sendMessage(
  //     chatId,
  //     "⚠ Invalid command format. Space is not allowed. The correct format is:\n\n/add_keyword <keyword>"
  //   );
  // }

  try {
    const keywordObject = await Keyword.findOne({
      where: { keyword: params },
    });
    if (!keywordObject) {
      return bot.sendMessage(chatId, "⚠ This keyword is not exists.");
    }

    await Keyword.destroy({ where: { keyword: params } });
    isChangedKeywords = true;
    bot.sendMessage(
      chatId,
      `👌 "${params}" keyword has been successfully deleted.`
    );
  } catch (err) {
    console.error("Database error: ", err);
    bot.sendMessage(
      chatId,
      "⚠ An error occurred while accessing the database. Please try again."
    );
  }
});

bot.onText(/\/show_keywords/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return bot.sendMessage(chatId, "❌ Unauthorized access!");

  try {
    const keywordObject = await Keyword.findAll({
      order: [["keyword", "ASC"]],
    });
    if (!keywordObject || keywordObject.length === 0) {
      return bot.sendMessage(chatId, "⚠ There are no keywords available.");
    }

    let msg = `📃 There are ${keywordObject.length} keywords.\n\n${keywordObject
      .map((item) => "- " + item.keyword)
      .join("\n")}`;

    bot.sendMessage(chatId, msg);
  } catch (err) {
    console.error("Database error: ", err);
    bot.sendMessage(
      chatId,
      "⚠ An error occurred while accessing the database. Please try again."
    );
  }
});

bot.onText(/\/add_group (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return bot.sendMessage(chatId, "❌ Unauthorized access!");

  const groupIndetifier = match![1].trim();
  if (!groupIndetifier) {
    return bot.sendMessage(
      chatId,
      "⚠ Invalid format. The correct format is:\n\n/add_group <group_username or group_link>"
    );
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
      return bot.sendMessage(
        chatId,
        "⚠ Invalid group. Please provide a valid group link or username."
      );
    }

    const groupObj = await ScrapeGroups.findOne({ where: { groupId } });
    if (groupObj) {
      return bot.sendMessage(
        chatId,
        "🔔 This group is already added to the database."
      );
    }
    await ScrapeGroups.create({ groupId, groupName, groupTitle });
    bot.sendMessage(
      chatId,
      `🎉 Group added successfully:\n\n📌 Group Title: ${groupTitle}\n🆔 Group ID: ${groupId}\n👤 Group Username: ${groupName}`
    );
    isChangedPostGroups = true;
  } catch (err) {
    console.error("Error fetching group entity: ", err);
    bot.sendMessage(
      chatId,
      "⚠ An error occurred. Please make sure the group username or link is valid."
    );
  }
});

bot.onText(/\/end_group (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return bot.sendMessage(chatId, "❌ Unauthorized access!");

  const groupIndetifier = match![1].trim();
  if (!groupIndetifier) {
    return bot.sendMessage(
      chatId,
      "⚠ Invalid format. The correct format is:\n\n/end_group <group_username or group_link>"
    );
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
      return bot.sendMessage(
        chatId,
        "⚠ Invalid group. Please provide a valid group link or username."
      );
    }

    const groupObj = await ScrapeGroups.findOne({ where: { groupId } });
    if (!groupObj) {
      return bot.sendMessage(chatId, "🔔 This group is not exists.");
    }
    await groupObj.destroy();
    bot.sendMessage(chatId, `🎉 Group removed successfully`);
    isChangedPostGroups = true;
  } catch (err) {
    console.error("Error fetching group entity: ", err);
    bot.sendMessage(
      chatId,
      "⚠ An error occurred. Please make sure the group username or link is valid."
    );
  }
});

bot.onText(/\/show_groups/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return bot.sendMessage(chatId, "❌ Unauthorized access!");

  try {
    const groups = await ScrapeGroups.findAll();
    if (!groups || groups.length === 0) {
      return bot.sendMessage(chatId, "🔔 There are no groups available.");
    }

    const chunkSize = 10;
    const checks: ScrapeGroups[][] = [];

    for (let i = 0; i < groups.length; i += chunkSize) {
      const chunk = groups.slice(i, i + chunkSize);
      checks.push(chunk);
    }

    bot.sendMessage(chatId, `📃 There are ${groups.length} groups:\n\n`);
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
      bot.sendMessage(chatId, msg);
      await delay(0.1);
    }
  } catch (err) {
    console.error("Error fetching group entity: ", err);
    bot.sendMessage(
      chatId,
      "⚠ An error occurred. Please make sure the group username or link is valid."
    );
  }
});

bot.onText(/^\/start$/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId))
    return bot.sendMessage(chatId, "❌ Unauthorized access!");

  const description = `
  👋 *Welcome to Your Scraper Bot!*

  Please pin me.

  I'm here to help you scrape messages from specific Telegram groups and filter them based on your configured keywords.

  🔹 *Commands you can use:*
  - /start_search — Start the scraping process and begin collecting data.
  - /stop_search — Stop the scraping process.
  - /status_search — Check the current scraping status (active/stopped).
  - /add_keyword <keyword> — Add new keywords for filtering messages.
  - /delete_keyword <keyword> — Remove specific keywords from the filter.
  - /show_keywords — Display all currently active keywords.
  - /add_group <group_link or group_username> — Add a new group for scraping.
  - /end_group <group_link or group_username> — Remove a group from scraping.
  - /show_groups — Display all groups currently being scraped.

  ⚙️ *How to use:*
  - Simply type one of the commands to control the bot's behavior.

  Enjoy scraping! 🚀
  `;

  bot.sendMessage(chatId, description);
});

bot.onText(/\/getid (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id?.toString() || "";

  const groupIndetifier = match![1].trim();
  if (!groupIndetifier) {
    return bot.sendMessage(
      chatId,
      "⚠ Invalid format. The correct format is:\n\n/add_group <group_username or group_link>"
    );
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
      return bot.sendMessage(
        chatId,
        "⚠ Invalid group. Please provide a valid group link or username."
      );
    }

    bot.sendMessage(
      chatId,
      `🎉 Information\n\n📌 Group Title: ${groupTitle}\n🆔 Group ID: ${groupId}\n👤 Group Username: ${groupName}`
    );
  } catch (err) {
    console.error("Error fetching group entity: ", err);
    bot.sendMessage(
      chatId,
      "⚠ An error occurred. Please make sure the group username or link is valid."
    );
  }
});
