import {
  Alchemy,
  AssetTransfersCategory,
  BigNumber,
  Network,
  Utils,
} from "alchemy-sdk";
import * as dotenv from "dotenv";
import { AnkrProvider, ethers } from "ethers";
import {
  generalCommands,
  scopeConfig,
  ScopeOption,
  ScopeRangeStep,
  sniperbotAddress,
} from "./constant/scope_eye";
import TelegramBot from "node-telegram-bot-api";
import { Telegraf, Markup } from "telegraf";

import {
  getInlineButtons,
  getPairAddress,
  getTradingStatus,
  isAdmin,
  sendMessage,
} from "./utils/utils";
import { messages } from "./constant/message";
import {
  NewTokens,
  ScopeOptionUser,
  SniperApprovalActivities,
  SniperBots,
} from "./model/second_eye_model";
import { col, fn, Op } from "sequelize";
import {
  getApprovalMsgFromTokenAddress,
  getWelcomeMsg,
  postForCheckCA,
  scopeSendMsg,
  setCommandsForUser,
} from "./service/scope_eye_service";
import sequelize, { ScrapeGroups } from "./model/first_eye_model";

dotenv.config();

const approvalABI = [
  "event Approval(address indexed owner, address indexed spender, uint256 value)",
];

// bot infos
const botToken = process.env.SCOPE_EYE_BOT_TOKEN || "";
const bot = new TelegramBot(botToken, { polling: true });

// sniping bots
let snipingBots: SniperBots[] = [];
let isChangedSniperBots = true;

const erc20Abi = ["function name() view returns (string)"];

const alchemyApiKey = process.env.ALCHEMY_API_KEY;
const setting = {
  apiKey: alchemyApiKey,
  network: Network.ETH_MAINNET,
};

const alchemy = new Alchemy(setting);

// websocket connection to listen for events
alchemy.ws.on(
  {
    address: undefined,
    topics: [Utils.id("Approval(address,address,uint256)")],
  },
  async (log) => {
    // Check if log data exists and is of valid length
    if (!log.data || log.data.length < 64) {
      return;
    }

    try {
      // decode the event data
      const iface = new ethers.Interface(approvalABI);
      const decodeEvent = iface.decodeEventLog(
        "Approval",
        log.data,
        log.topics
      );

      // console.log(log);
      const tokenAddress = log?.address?.toLowerCase() || "";
      const txHash = log?.transactionHash || "";

      const { owner, spender, value } = decodeEvent;
      const timestamp = Math.floor(new Date().getTime() / 1000);

      if (BigNumber.from(value).isZero()) {
        console.log("revoke");
        return; // revoke approval
      }

      if (isChangedSniperBots) {
        snipingBots = await SniperBots.findAll();
        isChangedSniperBots = false;
      }

      const sniping = snipingBots.find(
        (bot) => bot.address.toLowerCase() === spender?.toLowerCase()
      );

      if (sniping) {
        let tokenInfo = await NewTokens.findOne({ where: { tokenAddress } });
        if (!tokenInfo) {
          const provider = new ethers.AlchemyProvider("mainnet", alchemyApiKey);
          // const tx = await alchemy.core.getTransaction(txHash);
          // const contractCreationTx = await provider.getTransactionReceipt(
          //   tokenAddress
          // );
          const tokenContract = new ethers.Contract(
            tokenAddress,
            erc20Abi,
            provider
          );

          const pairAddress = await getPairAddress(tokenAddress);

          // deploy address
          const history = await alchemy.core.getAssetTransfers({
            fromBlock: "0x0",
            toBlock: "latest",
            toAddress: tokenAddress,
            excludeZeroValue: false,
            category: [
              "external",
              "erc20",
              "erc721",
              "erc1155",
            ] as AssetTransfersCategory[],
          });
          let deployerAddress = "";
          if (history.transfers.length > 0) {
            const contractCreationTx = history.transfers[0];
            const receipt = await provider.getTransactionReceipt(
              contractCreationTx.hash
            );
            deployerAddress = receipt?.from || "";
          }

          const tokenName = await tokenContract.name();
          // const tradingEnabled = await getTradingStatus(tokenAddress);
          const tradingEnabled = true;
          tokenInfo = await NewTokens.findOne({ where: { tokenAddress } });
          if (!tokenInfo) {
            tokenInfo = await NewTokens.create({
              tokenAddress,
              deployerAddress,
              pairAddress,
              tradingEnabled,
              tokenName,
            });
          }
        }

        await SniperApprovalActivities.create({
          sniperId: sniping.id,
          newTokenId: tokenInfo.id,
          timestamp,
          txHash,
        });
      }
    } catch (err) {
      console.error("Error decoding log data: ", err);
      console.log(log);
    }
  }
);

bot.onText(/\/add_sniperbot/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id?.toString() || "";

  const handleResults = async (name: string, address: string) => {
    try {
      const status = await SniperBots.findOne({
        where: { [Op.or]: [{ address: address.toLowerCase() }, { name }] },
      });
      if (status) {
        sendMessage(bot, chatId, messages.scopeEye.alreadyExistBot);
        return getUserInput();
      }

      const newSniperBot = await SniperBots.create({
        address: address.toLowerCase(),
        name,
      });

      sendMessage(bot, chatId, messages.scopeEye.sniperAdded, {
        address,
        name,
        id: newSniperBot.id,
      });
      isChangedSniperBots = true;
    } catch (err) {
      console.log(err);
    }
  };

  const getUserInput = async (stepStatus = 0, name = "", address = "") => {
    switch (stepStatus) {
      case 0:
        bot.sendMessage(chatId, messages.scopeEye.InputSniperName);
        bot.once("message", async (response) => {
          if (response.text?.startsWith("/")) return;

          const name = response.text || "";
          return getUserInput(1, name);
        });
        break;

      case 1:
        bot.sendMessage(chatId, messages.scopeEye.InputSniperAddress);
        bot.once("message", async (response) => {
          if (response.text?.startsWith("/")) return;

          const address = response.text || "";
          if (!ethers.isAddress(address)) {
            bot.sendMessage(chatId, messages.scopeEye.InvalidAddress);
            return getUserInput(1, name);
          }
          return getUserInput(2, name, address);
        });
        break;

      case 2:
        await handleResults(name, address);
        break;
    }
  };

  getUserInput();
});

bot.onText(/\/show_sniperbots/, async (msg) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId)) {
    return sendMessage(bot, chatId, messages.unauthorizedAccess);
  }

  try {
    const sniperBots = await SniperBots.findAll();
    if (!sniperBots || sniperBots.length === 0) {
      return sendMessage(bot, chatId, messages.scopeEye.noSniperBots);
    }

    let msg = `📃There are ${
      sniperBots.length
    } sniping bots.\n\n${sniperBots.map(
      (item) =>
        `🆔 ID: ${item.id}\n📌 Address:${item.address}\n👤 Bot Name: ${item.name}\n\n`
    )}`;

    sendMessage(bot, chatId, msg);
  } catch (err) {
    console.log(err);
  }
});

bot.onText(/\/delete_sniperbot/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id?.toString() || "";

  if (!isAdmin(userId)) {
    return sendMessage(bot, chatId, messages.unauthorizedAccess);
  }

  const params = match![1]?.trim()?.split(" ");
  if (!params || params.length !== 1) {
    return sendMessage(bot, chatId, messages.scopeEye.invalidSniperDelete);
  }

  const handleResults = async (id: number) => {
    try {
      const status = await SniperBots.findOne({
        where: { id },
      });
      if (!status) {
        sendMessage(bot, chatId, messages.scopeEye.sniperNotExist);
        getUserInput();
      }

      await SniperBots.destroy({ where: { id } });
      sendMessage(bot, chatId, messages.scopeEye.deleteSniperBot);
      isChangedSniperBots = true;
    } catch (err) {
      console.log(err);
    }
  };

  const getUserInput = () => {
    bot.sendMessage(chatId, messages.scopeEye.InputSniperId);
    bot.once("message", async (response) => {
      if (response.text?.startsWith("/")) return;

      const id = Number(response.text || "");
      if (isNaN(id)) {
        bot.sendMessage(chatId, messages.scopeEye.InvalidSniperId);
        return getUserInput();
      }
      return handleResults(id);
    });
  };

  getUserInput();
});

bot.onText(/\/show_ca/, async (msg) => {
  const chatId = msg.chat.id.toString() || "";
  const userId = msg.from?.id?.toString() || "";

  const askForTokenAddress = async () => {
    bot.once("message", async (response) => {
      const address = response.text?.toLowerCase();

      if (address?.startsWith("/")) {
        return;
      }

      if (!ethers.isAddress(address)) {
        sendMessage(bot, chatId, messages.validAddress);
        askForTokenAddress();
        return;
      }

      try {
        const currentTime = Math.floor(new Date().getTime() / 1000);

        const tokenInfo = await NewTokens.findOne({
          where: { tokenAddress: address },
        });
        if (!tokenInfo) {
          bot.sendMessage(chatId, "ℹ There is no token information.");
          return;
        }

        await ScopeOptionUser.update(
          {
            status: false,
          },
          {
            where: { userId },
          }
        );

        await ScopeOptionUser.create({
          userId,
          optionType: ScopeOption.CheckCA,
          status: true,
          startTime: currentTime,
          expireTime: currentTime + scopeConfig.expireDuration,
          tokenAddress: address,
        });

        const msg = await getApprovalMsgFromTokenAddress(address);
        scopeSendMsg(bot, chatId, msg);
      } catch (err) {
        console.log(err);
      }
    });
  };

  bot.sendMessage(chatId, messages.InputTokenAddress);
  askForTokenAddress();
});

bot.onText(/\/show_all/, async (msg, match) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id?.toString() || "";

  const currentTime = Math.floor(new Date().getTime() / 1000);
  const firstTime = currentTime - scopeConfig.showAllOptionDuration;
  const data = await SniperApprovalActivities.findAll({
    include: [
      {
        model: NewTokens,
        as: "newToken",
      },
    ],
    where: {
      timestamp: {
        [Op.gt]: firstTime,
        [Op.lt]: currentTime,
      },
    },
    group: ["newTokenId"],
    order: [[sequelize.fn("count", sequelize.col("*")), "DESC"]],
    limit: scopeConfig.showAllOptionLimit,
  });
  for (const dat of data) {
    const newToken = (dat as any).newToken as NewTokens;
    const msg = await getApprovalMsgFromTokenAddress(newToken.tokenAddress);
    await scopeSendMsg(bot, chatId, msg);
  }
});

bot.onText(/\/show_range/, async (msg) => {
  const chatId = msg.chat.id.toString();

  const handleResults = async (
    type: string,
    min: number,
    max: number,
    value: number
  ) => {
    const currentTime = Math.floor(new Date().getTime() / 1000);
    const firstTime = currentTime - scopeConfig.showRangeOptionDuration;

    const results = await SniperApprovalActivities.findAll({
      include: [
        {
          model: NewTokens,
          as: "newToken",
        },
      ],
      attributes: {
        include: [[fn("COUNT", col("newTokenId")), "count"]], // Count the occurrences of newTokenId
      },
      where: {
        timestamp: {
          [Op.lt]: currentTime,
          [Op.gt]: firstTime,
        },
      },
      group: ["newTokenId"],
      having: {
        count:
          type === "R"
            ? {
                [Op.gte]: min,
                [Op.lte]: max,
              }
            : value,
      },
      order: [["timestamp", "DESC"]],
      limit: scopeConfig.showRangeOptionLimit,
    });

    for (const data of results) {
      const newToken = (data as any).newToken as NewTokens;
      const msg = await getApprovalMsgFromTokenAddress(newToken.tokenAddress);
      await scopeSendMsg(bot, chatId, msg);
    }
  };

  const getUserInput = async (
    stepStatus: ScopeRangeStep = ScopeRangeStep.InputType,
    type = "",
    min = 0,
    max = 0,
    value = 0
  ) => {
    switch (stepStatus) {
      case ScopeRangeStep.InputType:
        bot.sendMessage(chatId, messages.scopeEye.DetermineRangeType);
        bot.once("message", async (response) => {
          if (response.text?.startsWith("/")) return;

          const userRes = response.text || "";
          if (userRes === "R") {
            return getUserInput(ScopeRangeStep.InputMin, "R");
          } else if (userRes === "F") {
            return getUserInput(ScopeRangeStep.InputFixedVal, "F");
          } else {
            bot.sendMessage(chatId, messages.scopeEye.InvalidRangeTypeInput);
            return getUserInput();
          }
        });
        break;

      case ScopeRangeStep.InputMin:
        bot.sendMessage(chatId, messages.scopeEye.InputMinValue);
        bot.once("message", async (response) => {
          if (response.text?.startsWith("/")) return;

          const minValue = Number(response.text);
          if (isNaN(minValue) || minValue <= 0) {
            bot.sendMessage(chatId, messages.scopeEye.InvalidMinValue);
            return getUserInput(ScopeRangeStep.InputMin, type);
          }
          return getUserInput(ScopeRangeStep.InputMax, type, minValue);
        });
        break;

      case ScopeRangeStep.InputMax:
        bot.sendMessage(chatId, messages.scopeEye.InputMaxValue);
        bot.once("message", async (response) => {
          if (response.text?.startsWith("/")) return;

          const maxValue = Number(response.text);
          if (isNaN(maxValue) || maxValue <= min) {
            bot.sendMessage(chatId, messages.scopeEye.InvalidMaxValue);
            return getUserInput(ScopeRangeStep.InputMax, type, min);
          }
          return getUserInput(ScopeRangeStep.Processing, type, min, maxValue);
        });
        break;

      case ScopeRangeStep.InputFixedVal:
        bot.sendMessage(chatId, messages.scopeEye.InputFixedValue);
        bot.once("message", async (response) => {
          if (response.text?.startsWith("/")) return;

          const fixedValue = Number(response.text);
          if (isNaN(fixedValue) || fixedValue <= 0) {
            bot.sendMessage(chatId, messages.scopeEye.InvalidFixedValue);
            return getUserInput(ScopeRangeStep.InputFixedVal, type);
          }
          return getUserInput(
            ScopeRangeStep.Processing,
            type,
            0,
            0,
            fixedValue
          );
        });
        break;

      case ScopeRangeStep.Processing:
        await handleResults(type, min, max, value);
        break;
    }
  };

  getUserInput();
});

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id?.toString() || "";

  await setCommandsForUser(bot, userId);
  const welcomeMessage = getWelcomeMsg(userId);
  const buttons = getInlineButtons();
  bot.sendMessage(chatId, welcomeMessage, {
    parse_mode: "Markdown",
    reply_markup: buttons.reply_markup,
  });
});

const main = async () => {
  setInterval(() => {
    postForCheckCA(bot);
  }, scopeConfig.postDuration * 1000);
};

main();
