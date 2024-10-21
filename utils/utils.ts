import TelegramBot from "node-telegram-bot-api";
import { Addresses, admins, urls } from "../constant/constant";
import { ethers, Contract } from "ethers";
import * as dotenv from "dotenv";
import { Markup } from "telegraf";

dotenv.config();

export const isAdmin = (userId: string) => admins.includes(userId);

export const sendMessage = (
  bot: TelegramBot,
  chatId: string,
  msg: string,
  value?: Record<string, any>
): void => {
  const updatedMsg = value
    ? msg.replace(/%\{(.*?)\}/g, (_, key) => value[key])
    : msg;
  bot.sendMessage(chatId, updatedMsg);
};

export const getPairAddress = async (tokenAddress: string) => {
  const uniswapFacAdd = Addresses.UniswapFactory;
  const alchemyAPIUrl = process.env.ALCHEMY_API_URL || "";
  const wethAddress = Addresses.WETH;

  const uniswapFactoryABI = [
    "function getPair(address tokenA, address tokenB) view returns (address pair)",
  ];

  const provider = new ethers.JsonRpcProvider(alchemyAPIUrl);
  const uniswapFacContract = new Contract(
    uniswapFacAdd,
    uniswapFactoryABI,
    provider
  );
  const pairAddress = await uniswapFacContract.getPair(
    tokenAddress,
    wethAddress
  );
  return pairAddress;
};

export const getTradingStatus = async (tokenAddress: string) => {
  const alchemyAPIUrl = process.env.ALCHEMY_API_URL || "";

  const tokenABI = [
    "function tradingEnabled() view returns (bool)",
    "function isTradingEnabled() view returns (bool)",
  ];

  const provider = new ethers.JsonRpcProvider(alchemyAPIUrl);
  const tokenContract = new ethers.Contract(tokenAddress, tokenABI, provider);
  try {
    const status = await tokenContract.tradingEnabled();
    console.log({ status });
    return status;
  } catch (err) {
    console.error("Error fetching trading status:", err);
    return false;
  }
};

export const getInlineButtons = () => {
  return Markup.inlineKeyboard([
    [
      Markup.button.url("🍌 Snipe Banana Bot", urls.bananaGunBot),
      Markup.button.url("🎯 Snipe Maestro Bot", urls.maestroBot),
    ],
    [
      Markup.button.url("👁️ First EYE", urls.firstEyeBot),
      Markup.button.url("🔭 Scope EYE", urls.scopeBot),
    ],
    [
      Markup.button.url("🔎 CA EYE", urls.caEyeBot),
      Markup.button.url("👨‍💻 Dev EYE", urls.firstEyeBot),
    ],
    [Markup.button.url("📢 Your AD here", urls.firstEyeBot)],
  ]);
};

export const formatNumberWithCommas = (num: number): string => {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const formatNumber = (num: number | string): string => {
  const decimalPlaces = 3;
  const nums = Number(num);

  if (Math.abs(nums) < 0.00000001) {
    return "0";
  }
  if (Math.abs(nums) < 0.001) {
    return nums.toExponential(5).replace(/\.?0+e/, "e");
  }

  if (Math.abs(nums) >= 1e9) {
    return (nums / 1e9).toFixed(decimalPlaces).replace(/\.?0+$/, "") + "B"; // Billions
  } else if (Math.abs(nums) >= 1e6) {
    return (nums / 1e6).toFixed(decimalPlaces).replace(/\.?0+$/, "") + "M"; // Millions
  } else if (Math.abs(nums) >= 1e3) {
    return (nums / 1e3).toFixed(decimalPlaces).replace(/\.?0+$/, "") + "K"; // Thousands
  }

  return nums.toFixed(decimalPlaces).replace(/\.?0+$/, ""); // Default for numbers less than 1,000
};
