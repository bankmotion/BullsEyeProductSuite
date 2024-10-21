import { ethers, lock } from "ethers";
import * as dotenv from "dotenv";
import TelegramBot from "node-telegram-bot-api";
import { getInlineButtons } from "./utils/utils";
import {
  getBasicTokenMsg,
  getContractCodeFromEtherScan,
  getDeployerInfoFromEtherScan,
  getLiquidityBalance,
  getLiquidityDataFromMoralis,
  getLPDataFromDexScreener,
  getMainPoolLPFromDexScreener,
  getMaxTxWallet,
  getPoolPriceFromDexTools,
  getPoolsDataFromDexTools,
  getSecurityDataFromDextools,
  getSocialsFromDextools,
  getTokenInfoFromContract,
  getTokenInfoMsg,
  getTokenSecurityMsg,
  getTokenStats,
  getWelcomeMsg,
  setCommandsForUser,
} from "./service/ca_eye_service";
import { messages } from "./constant/message";
import { sendMessage } from "telegram/client/messages";
import { Addresses } from "./constant/constant";

dotenv.config();

const botToken = process.env.CA_EYE_BOT_TOKEN || "";
const bot = new TelegramBot(botToken, { polling: true });

const infuraApiKey = process.env.INFURA_API_KEY || "";
const infuraNetwork = process.env.INFURA_NETWORK || "";
const infuraProvider = new ethers.JsonRpcProvider(infuraNetwork);

const askForAddress = async (
  chatId: string,
  bot: TelegramBot,
  callback: (address: string) => Promise<void>
) => {
  bot.sendMessage(chatId, messages.CAEye.InputAddress);
  bot.once("message", async (response) => {
    const address = response.text?.trim() || "";

    if (address.startsWith("/")) return;

    if (!ethers.isAddress(address)) {
      bot.sendMessage(chatId, messages.validAddress);
      askForAddress(chatId, bot, callback);
      return;
    }

    try {
      await callback(address);
    } catch (err) {
      console.error(`Error processing address ${address}: ${err}`);
    }
  });
};

bot.onText(/\/token_info/, async (msg) => {
  const chatId = msg.chat.id.toString() || "";

  await askForAddress(chatId, bot, async (address) => {
    try {
      const tokenInfo = await getTokenInfoFromContract(address);
      const links = await getSocialsFromDextools(address);
      console.log({ tokenInfo, links });
      if (tokenInfo) {
        const { tokenName, tokenSymbol, totalSupply } = tokenInfo;
        const tokenInfoMsg =
          getBasicTokenMsg(address, tokenName, tokenSymbol) +
          getTokenInfoMsg(address, totalSupply, links);

        const buttons = getInlineButtons();
        bot.sendMessage(chatId, tokenInfoMsg, {
          parse_mode: "Markdown",
          reply_markup: buttons.reply_markup,
        });
      } else {
        bot.sendMessage(chatId, messages.CAEye.UnableRetrieve, {
          parse_mode: "Markdown",
        });
      }
    } catch (err) {
      console.error("Error fetching token information:", err);
      bot.sendMessage(chatId, messages.CAEye.ErrorOccuring, {
        parse_mode: "Markdown",
      });
    }
  });
});

bot.onText(/\/token_security/, async (msg) => {
  const chatId = msg.chat.id.toString() || "";

  await askForAddress(chatId, bot, async (address) => {
    try {
      let renounced = false,
        verified = false;

      const tokenInfo = await getTokenInfoFromContract(address);

      if (tokenInfo) {
        if (tokenInfo.owner === Addresses.Empty) renounced = true;

        const contractDataFromEtherScan = await getContractCodeFromEtherScan(
          address
        );
        if (contractDataFromEtherScan && contractDataFromEtherScan.sourceCode)
          verified = true;

        const deployerData = await getDeployerInfoFromEtherScan(address);

        const lpData = await getLPDataFromDexScreener(address);
        // console.log({ lpData });
        if (lpData) {
          const lpAddress = lpData.pairAddress;
          const lpBalanceData = await getLiquidityBalance(address, lpAddress);
          let contractBalance = "Unknown",
            lpBalance: string = "Unknown",
            percentContract: string | number = "Unknown",
            percentLp: string | number = "Unknown";
          if (lpBalanceData) {
            contractBalance = lpBalanceData.contractBalance;
            lpBalance = lpBalanceData.lpBalance;
            percentContract = lpBalanceData.percentContract;
            percentLp = lpBalanceData.percentLp;
          }

          let sellTax = {
            min: 0,
            max: 0,
            status: "",
          };
          let buyTax = {
            min: 0,
            max: 0,
            status: "",
          };
          let lockedAmount = 0;
          const securityData = await getSecurityDataFromDextools(
            address,
            lpAddress
          );
          if (securityData) {
            sellTax = securityData.sellTax;
            buyTax = securityData.buyTax;
            console.log(securityData.lockData);
            lockedAmount = securityData.lockData.amountLocked;
          }

          const maxData = await getMaxTxWallet(address);

          const tokenSecurityMsg =
            getBasicTokenMsg(
              address,
              tokenInfo.tokenName,
              tokenInfo.tokenSymbol
            ) +
            getTokenSecurityMsg(
              tokenInfo.tokenSymbol,
              renounced,
              verified,
              deployerData?.deployer || "Unknown",
              deployerData?.balance || "Unknown",
              deployerData?.ethBalance || "Unknown",
              deployerData?.txCount?.toString() || "Unknown",
              contractBalance,
              lpBalance,
              percentContract as string,
              percentLp as string,
              sellTax,
              buyTax,
              lockedAmount,
              maxData.maxTx,
              maxData.maxWallet,
              maxData.totalSupply
            );
          const buttons = getInlineButtons();
          bot.sendMessage(chatId, tokenSecurityMsg, {
            parse_mode: "Markdown",
            reply_markup: buttons.reply_markup,
          });
        } else {
          bot.sendMessage(chatId, messages.CAEye.NoLPData, {
            parse_mode: "Markdown",
          });
        }
      } else {
        bot.sendMessage(chatId, messages.CAEye.UnableRetrieve, {
          parse_mode: "Markdown",
        });
      }
    } catch (err) {
      console.error("Error fetching token information:", err);
      bot.sendMessage(chatId, messages.CAEye.ErrorOccuring, {
        parse_mode: "Markdown",
      });
    }
  });
});

bot.onText(/\/token_stats/, async (msg) => {
  const chatId = msg.chat.id.toString() || "";

  await askForAddress(chatId, bot, async (address) => {
    try {
      const tokenInfo = await getTokenInfoFromContract(address);
      const lpData = await getLPDataFromDexScreener(address);
      if (lpData) {
        const lpAddress = lpData.pairAddress;
        console.log({ lpAddress });
        const priceData = await getPoolPriceFromDexTools(lpAddress);
        const poolsData = await getPoolsDataFromDexTools(address);
        const mainPoolData = await getMainPoolLPFromDexScreener(lpAddress);

        const tokenStatsMsg =
          getBasicTokenMsg(
            address,
            tokenInfo?.tokenName || "",
            tokenInfo?.tokenSymbol || ""
          ) + getTokenStats(priceData, poolsData, mainPoolData);
        const buttons = getInlineButtons();
        bot.sendMessage(chatId, tokenStatsMsg, {
          parse_mode: "Markdown",
          reply_markup: buttons.reply_markup,
        });
      } else {
        bot.sendMessage(chatId, messages.CAEye.NoLPData, {
          parse_mode: "Markdown",
        });
      }
    } catch (err) {
      console.error("Error fetching token information:", err);
      bot.sendMessage(chatId, messages.CAEye.ErrorOccuring, {
        parse_mode: "Markdown",
      });
    }
  });
});

bot.onText(/\/full_report/, async (msg) => {
  const chatId = msg.chat.id.toString() || "";
  let renounced = false,
    verified = false;

  await askForAddress(chatId, bot, async (address) => {
    try {
      const tokenInfo = await getTokenInfoFromContract(address);
      const links = await getSocialsFromDextools(address);
      if (tokenInfo) {
        const { tokenName, tokenSymbol, totalSupply } = tokenInfo;

        const tokenInfoMsg =
          getBasicTokenMsg(address, tokenName, tokenSymbol) +
          getTokenInfoMsg(address, totalSupply, links);

        // token security
        if (tokenInfo.owner === Addresses.Empty) renounced = true;

        const contractDataFromEtherScan = await getContractCodeFromEtherScan(
          address
        );
        if (contractDataFromEtherScan && contractDataFromEtherScan.sourceCode)
          verified = true;

        const deployerData = await getDeployerInfoFromEtherScan(address);

        const lpData = await getLPDataFromDexScreener(address);
        if (lpData) {
          const lpAddress = lpData.pairAddress;
          const lpBalanceData = await getLiquidityBalance(address, lpAddress);
          let contractBalance = "Unknown",
            lpBalance: string = "Unknown",
            percentContract: string | number = "Unknown",
            percentLp: string | number = "Unknown";
          if (lpBalanceData) {
            contractBalance = lpBalanceData.contractBalance;
            lpBalance = lpBalanceData.lpBalance;
            percentContract = lpBalanceData.percentContract;
            percentLp = lpBalanceData.percentLp;
          }

          let sellTax = {
            min: 0,
            max: 0,
            status: "",
          };
          let buyTax = {
            min: 0,
            max: 0,
            status: "",
          };
          let lockedAmount = 0;
          const securityData = await getSecurityDataFromDextools(
            address,
            lpAddress
          );
          if (securityData) {
            sellTax = securityData.sellTax;
            buyTax = securityData.buyTax;
            console.log(securityData.lockData);
            lockedAmount = securityData.lockData.amountLocked;
          }

          const maxData = await getMaxTxWallet(address);

          const tokenSecurityMsg = getTokenSecurityMsg(
            tokenInfo.tokenSymbol,
            renounced,
            verified,
            deployerData?.deployer || "Unknown",
            deployerData?.balance || "Unknown",
            deployerData?.ethBalance || "Unknown",
            deployerData?.txCount?.toString() || "Unknown",
            contractBalance,
            lpBalance,
            percentContract as string,
            percentLp as string,
            sellTax,
            buyTax,
            lockedAmount,
            maxData.maxTx,
            maxData.maxWallet,
            maxData.totalSupply
          );

          // token stats
          const priceData = await getPoolPriceFromDexTools(lpAddress);
          const poolsData = await getPoolsDataFromDexTools(address);
          const mainPoolData = await getMainPoolLPFromDexScreener(lpAddress);

          const tokenStatsMsg = getTokenStats(
            priceData,
            poolsData,
            mainPoolData
          );

          const buttons = getInlineButtons();
          bot.sendMessage(
            chatId,
            tokenInfoMsg + tokenSecurityMsg + tokenStatsMsg,
            {
              parse_mode: "Markdown",
              reply_markup: buttons.reply_markup,
            }
          );
        } else {
          bot.sendMessage(chatId, messages.CAEye.NoLPData, {
            parse_mode: "Markdown",
          });
        }
      } else {
        bot.sendMessage(chatId, messages.CAEye.UnableRetrieve, {
          parse_mode: "Markdown",
        });
      }
    } catch (err) {
      console.error("Error fetching token information:", err);
      bot.sendMessage(chatId, messages.CAEye.ErrorOccuring, {
        parse_mode: "Markdown",
      });
    }
  });
});

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id.toString();
  const userId = msg.from?.id.toString() || "";

  await setCommandsForUser(bot, userId);
  const welcomeMsg = getWelcomeMsg();
  const buttons = getInlineButtons();
  bot.sendMessage(chatId, welcomeMsg, {
    parse_mode: "Markdown",
    reply_markup: buttons.reply_markup,
  });
});
