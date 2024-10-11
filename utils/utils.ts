import TelegramBot from "node-telegram-bot-api";
import { admins } from "../constant/constant";
import { ethers, Contract } from "ethers";
import * as dotenv from "dotenv";

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
  const uniswapFacAdd = process.env.UNISWAP_FACTORY_ADDRESS || "";
  const alchemyAPIUrl = process.env.ALCHEMY_API_URL || "";
  const wethAddress = process.env.WETH_ADDRESS || "";

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
    console.log({status});
    return status
  } catch (err) {
    console.error("Error fetching trading status:", err);
    return false;
  }
};
