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
import { Markup } from "telegraf";
import { urls } from "../constant/constant";
import { isAdmin } from "../utils/utils";


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

  let msg = `<b>🚨 ${totalCount} preapprovals for $${
    tokenInfo?.tokenName || "unknowns"
  }! 🚨</b>\n`;

  for (let index = 0; index < bots.length; index++) {
    const botItem = bots[index];
    const count = botCount[botItem.name] || 0;
    msg += `${index === bots.length - 1 ? "└" : "├"} 🤖 <b>${
      botItem.name
    }</b>: ${count}\n`;
  }

  msg += `\n<b>💲Token Name:</b> ${tokenInfo?.tokenName || "unknowns"}\n`;
  // msg += `├ Full CA Info: <a href="https://t.me/eye">Click Here</a>\n`;
  msg += `├ <b>Token Address:</b> <a href="https://etherscan.io/address/${
    tokenInfo?.tokenAddress || "unknown"
  }">${tokenInfo?.tokenAddress || "unknown"}</a>\n`;
  msg += `└ <b>Deployer Wallet:</b> <a href="https://etherscan.io/address/${
    tokenInfo?.deployerAddress || "unknown"
  }">${tokenInfo?.deployerAddress || "unknown"}</a>\n`;

  msg += `\n<b>📈 Charts:</b>\n`;
  msg += `└─ <a href="https://www.dexview.com/eth/${
    tokenInfo?.tokenAddress || "unknown"
  }">DEXView</a> | <a href="https://photon.tinyastro.io/en/lp/${
    tokenInfo?.tokenAddress || "unknown"
  }">Photon</a> | <a href="https://www.dextools.io/app/ether/pair-explorer/${
    tokenInfo?.tokenAddress || "unknown"
  }">DEXTools</a> | <a href="https://dexscreener.com/ethereum/${
    tokenInfo?.tokenAddress || "unknown"
  }">DEXScreen</a>`;

  msg += `\n\n👀 <b>#TradingEnabled</b> 👀`;
  return msg;
};

export const getWelcomeMsg = (userId: string) => {
  let msg =
    "🌟 Welcome to the **Sniper Bot**! 🌟\n\nHere are the commands you can use:\n";
  isAdmin(userId) &&
    (msg += `
Admin Commands:

📥 /add_sniperbot - Add a new sniper bot.

📜 /show_sniperbots - Show all added sniper bots.

🗑️ /delete_sniperbot - Delete a sniper bot by its ID.\n\n`);

  msg += `User Commands:

🔍 /show_ca - Check approvals for a specific token address.

📊 /show_all - Displays the top 10 sniping activities in the last hour.

📊 /show_range - Show activity the lastest 10 activities in a specific range or specific value last 24 hours.

For any assistance, feel free to reach out! 🤖`;

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
  const buttons = getScopeButton();

  await bot.sendMessage(chatId, msg, {
    parse_mode: "HTML",
    reply_markup: buttons.reply_markup,
  });
};

export const getScopeButton = () => {
  return Markup.inlineKeyboard([
    [Markup.button.callback("CA EYE Bot", urls.caEyeBot)],
    [
      Markup.button.url("🍌 Snipe Banana Bot", urls.bananaGunBot),
      Markup.button.url("🎯 Snipe Maestro Bot", urls.maestroBot),
    ],
    [
      Markup.button.url("🛡 TTF Scan", urls.ttfBot),
      Markup.button.url("🛡 Otto Scan", urls.ottoBot),
    ],
  ]);
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
