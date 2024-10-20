import { Op } from "sequelize";
import {
  adminCommands,
  generalCommands,
  ScopeOption,
} from "../constant/scope_eye";
import {
  NewTokens,
  ScopeOptionUser,
  SniperApprovalActivities,
  SniperBots,
} from "../model/second_eye_model";
import TelegramBot from "node-telegram-bot-api";
import { getInlineButtons, isAdmin } from "../utils/utils";

export const getApprovalMsgFromTokenAddress = async (tokenAddress: string) => {
  const data = await SniperApprovalActivities.findAll({
    include: [
      {
        model: NewTokens,
        as: "newToken",
        where: {
          tokenAddress,
        },
        attributes: [
          "tokenAddress",
          "deployerAddress",
          "pairAddress",
          "tradingEnabled",
          "tokenName",
        ],
      },
      {
        model: SniperBots,
        as: "sniperBot",
        attributes: ["name", "address"],
      },
    ],
    attributes: ["txHash", "timestamp"],
  });
  const tokenInfo = await NewTokens.findOne({ where: { tokenAddress } });
  const bots = await SniperBots.findAll();
  const botCount: Record<string, number> = {};

  if (data.length > 0) {
    for (const dat of data) {
      const sniperInfo = (dat as any).sniperBot as SniperBots;
      if (sniperInfo) {
        if (botCount[sniperInfo.name]) {
          botCount[sniperInfo.name]++;
        } else {
          botCount[sniperInfo.name] = 1;
        }
      }
    }
  }

  let totalCount = Object.values(botCount).reduce(
    (acc, value) => acc + value,
    0
  );

  let msg = `**🚨 ${totalCount} preapprovals for $${
    tokenInfo?.tokenName || "unknowns"
  }! 🚨**\n`;

  for (let index = 0; index < bots.length; index++) {
    const botItem = bots[index];
    const count = botCount[botItem.name] || 0;
    msg += `${index === bots.length - 1 ? "└" : "├"} 🤖 **${
      botItem.name
    }**: ${count}\n`;
  }

  msg += `\n**💲Token Name:** ${tokenInfo?.tokenName || "unknowns"}\n`;
  msg += `├ **Token Address:** \`${tokenInfo?.tokenAddress || "unknown"}\`\n`;
  msg += `└ **Deployer Wallet:** \`${
    tokenInfo?.deployerAddress || "unknown"
  }\`\n`;

  msg += `\n**📈 Charts:**\n`;
  msg += `└─ [DEXView](https://www.dexview.com/eth/${
    tokenInfo?.tokenAddress || "unknown"
  }) | [Photon](https://photon.tinyastro.io/en/lp/${
    tokenInfo?.tokenAddress || "unknown"
  }) | [DEXTools](https://www.dextools.io/app/ether/pair-explorer/${
    tokenInfo?.tokenAddress || "unknown"
  }) | [DEXScreen](https://dexscreener.com/ethereum/${
    tokenInfo?.tokenAddress || "unknown"
  })`;

  msg += `\n\n👀 **#TradingEnabled** 👀`;
  return msg;
};

export const getWelcomeMsg = (userId: string) => {
  let msg =
    `🌟 **Welcome to the Sniper Bot!** 🌟\n\n` +
    `We’re glad to have you on board. Here’s a quick overview of the commands available to help you get the most out of the bot:\n`;

  // Check if the user is an admin and add admin-specific commands
  if (isAdmin(userId)) {
    msg += `
**Admin Commands:**

- 📥 /add\\_sniperbot – Add a new sniper bot to the system.
- 📜 /show\\_sniperbots – Display all currently added sniper bots.
- 🗑️ /delete\\_sniperbot – Remove a sniper bot by providing its ID.\n\n`;
  }

  // User-specific commands (always included)
  msg += `**User Commands:**

- 🔍 /show\\_ca – Check sniper bot approvals for a specific token address.
- 📊 /show\\_all – View the top 10 sniping activities from the last hour.
- 📊 /show\\_range – Display the most recent 10 activities within a specified range or the last 24 hours.

Need help? Feel free to reach out anytime! 🤖`;

  return msg;
};


export const postForCheckCA = async (bot: TelegramBot) => {
  const currentTime = Math.floor(new Date().getTime() / 1000);
  const users = await ScopeOptionUser.findAll({
    where: {
      optionType: ScopeOption.CheckCA,
      status: 1,
      expireTime: {
        [Op.gte]: currentTime,
      },
    },
  });
  for (const user of users) {
    const msg = await getApprovalMsgFromTokenAddress(user.tokenAddress);
    await scopeSendMsg(bot, user.userId, msg);
  }
  console.log("checked all CheckCA option.");
};

export const scopeSendMsg = async (
  bot: TelegramBot,
  chatId: string,
  msg: string
) => {
  const buttons = getInlineButtons();

  await bot.sendMessage(chatId, msg, {
    parse_mode: "Markdown",
    reply_markup: buttons.reply_markup,
  });
};

export const setCommandsForUser = async (bot: TelegramBot, userId: string) => {
  try {
    if (!isAdmin(userId)) {
      await bot.setMyCommands(generalCommands, {
        scope: { type: "chat", chat_id: userId },
      });
    } else {
      await bot.setMyCommands([...generalCommands, ...adminCommands], {
        scope: { type: "chat", chat_id: userId },
      });
    }
  } catch (err) {
    console.error("Error in setting commands:", err);
  }
};
