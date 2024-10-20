import TelegramBot from "node-telegram-bot-api";
import axios from "axios";
import { commands } from "../constant/ca_eye";
import { ethers, lock } from "ethers";
import { formatNumber, formatNumberWithCommas } from "../utils/utils";
import Moralis from "moralis";
import { delay, getTimeAgo } from "../utils";

const infuraApiKey = process.env.INFURA_API_KEY || "";
const infuraNetwork = process.env.INFURA_NETWORK || "";
const dextoolsApiKey = process.env.DEXTOOL_API_KEY || "";
const provider = new ethers.InfuraProvider("mainnet", infuraApiKey);

const moralisApiKey = process.env.MORALIS_API_KEY || "";
Moralis.start({
  apiKey: moralisApiKey,
});

const etherscanApiKey = process.env.ETHERSCAN_API_KEY || "";
const etherscanApiUrl = `https://api.etherscan.io/api`;

export const getTokenInfoFromContract = async (address: string) => {
  try {
    const erc20Abi = [
      "function name() view returns (string)",
      "function symbol() view returns (string)",
      "function totalSupply() view returns (uint256)",
      "function decimals() view returns (uint256)",
      "function owner() view returns (address)",
    ];

    const tokenContract = new ethers.Contract(address, erc20Abi, provider);

    const tokenName: string = await tokenContract.name();
    const tokenSymbol: string = await tokenContract.symbol();
    const decimals: string = await tokenContract.decimals();
    const totalSupply: number = Number(
      ethers.formatUnits(await tokenContract.totalSupply(), decimals)
    );
    const owner: string = await tokenContract.owner();
    return { tokenName, tokenSymbol, totalSupply, decimals, owner };
  } catch (err) {
    console.log(`Error getTokenInfoFromContract: ${err}`);
    return undefined;
  }
};

export const getSocialsFromMoralis = async (address: string) => {
  try {
    const response = await Moralis.EvmApi.token.getTokenMetadata({
      chain: "0x1",
      addresses: [address],
    });
    return (response.raw as any)?.links;
  } catch (err) {
    console.log(`Error getSocialsFromMoralis(): ${err}`);
  }
};

export const getLiquidityDataFromMoralis = async (address: string) => {
  try {
    console.log({ address });
    const response = await axios.get(
      `https://deep-index.moralis.io/api/v2.2/erc20/${address}/pairs`,
      {
        headers: {
          accept: "application/json",
          "X-API-Key": moralisApiKey,
        },
        params: {
          chain: "eth",
          limit: 5,
        },
      }
    );
    console.log(response.data);
    if (
      response &&
      response.data &&
      response.data.pairs &&
      response.data.pairs[0]
    ) {
      return {
        pairAddress: response.data.pairs[0].pair_address as string,
      };
    }
  } catch (err) {
    console.log(`Error getLiquidityDataFromMoralis(): ${err}`);
  }
};

export const getLiquidityBalance = async (
  address: string,
  lpAddress: string
) => {
  const erc20ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function decimals() view returns (uint256)",
  ];
  const tokenContract = new ethers.Contract(address, erc20ABI, provider);
  const contractBalanceWei = await tokenContract.balanceOf(address);
  const liquidityBalanceWei = await tokenContract.balanceOf(lpAddress);
  const totalSupplyWei = await tokenContract.totalSupply();
  const decimals = await tokenContract.decimals();
  const contractBalance = ethers.formatUnits(contractBalanceWei, decimals);
  const lpBalance = ethers.formatUnits(liquidityBalanceWei, decimals);
  const totalSupply = ethers.formatUnits(totalSupplyWei, decimals);
  const percentContract = Number(
    ((Number(contractBalance) / Number(totalSupply)) * 100).toFixed(2)
  );
  const percentLp = Number(
    ((Number(lpBalance) / Number(totalSupply)) * 100).toFixed(2)
  );
  return {
    contractBalance,
    lpBalance,
    totalSupply,
    percentContract,
    percentLp,
  };
};

export const getContractCodeFromEtherScan = async (address: string) => {
  try {
    const response = await axios.get(etherscanApiUrl, {
      params: {
        module: "contract",
        action: "getsourcecode",
        address,
        apikey: etherscanApiKey,
      },
    });

    const contractData = response.data.result[0];
    const data = {
      sourceCode: contractData.SourceCode,
      abi: contractData.ABI,
      comilerVersion: contractData.CompilerVersion,
      optimizationUsed: contractData.OptimizationUsed,
      runs: contractData.Runs,
      constructorArg: contractData.ConstructorArguments,
      evmVersion: contractData.EVMVersion,
      library: contractData.Library,
      licenseType: contractData.LicenseType,
      proxy: contractData.Proxy,
      implementation: contractData.Implementation,
      swarmSource: contractData.SwarmSource,
    };
    console.log(data.abi);
    return data;
  } catch (err) {
    console.log(`Error getContractCodeFromEtherScan(): ${err}`);
  }
};

export const getDeployerInfoFromEtherScan = async (address: string) => {
  try {
    const erc20Abi = [
      "function balanceOf(address owner) view returns (uint256)",
      "function decimals() view returns (uint8)",
    ];

    const response = await axios.get(etherscanApiUrl, {
      params: {
        module: "contract",
        action: "getcontractcreation",
        contractaddresses: address,
        apikey: etherscanApiKey,
      },
    });

    const tokenContract = new ethers.Contract(address, erc20Abi, provider);

    const deployer: string = response.data.result[0].contractCreator;
    const txHash: string = response.data.result[0].txHash;

    const decimals = await tokenContract.decimals();
    const balanceWei = await tokenContract.balanceOf(deployer);
    const balance = Number(ethers.formatUnits(balanceWei, decimals)).toFixed(4);
    const txCount = await provider.getTransactionCount(deployer);
    const ethBalanceWei = await provider.getBalance(deployer);
    const ethBalance = Number(ethers.formatEther(ethBalanceWei)).toFixed(4);
    return { deployer, balance, txCount, ethBalance };
  } catch (err) {
    console.log(`Error getDeployerInfoFromEtherScan(): ${err}`);
  }
};

export const getSecurityDataFromDextools = async (
  address: string,
  lpAddress: string
) => {
  try {
    const url = `https://public-api.dextools.io/trial/v2/token/ether/${address}/audit`;
    const res = await axios
      .get(url, { headers: { "x-api-key": dextoolsApiKey } })
      .catch((err) =>
        console.log(`Error getSecurityDataFromDextools(): ${err}`)
      );

    await delay(2);
    const lockUrl = `https://public-api.dextools.io/trial/v2/pool/ether/${lpAddress}/locks`;
    const lockRes = await axios
      .get(lockUrl, { headers: { "x-api-key": dextoolsApiKey } })
      .catch((err) =>
        console.log(`Error getSecurityDataFromDextools(): ${err}`)
      );
    let sellTax, buyTax, lockData;
    if (res && (res as any).statusCode === 200) {
      sellTax = (res as any).data.data.sellTax;
      buyTax = (res as any).data.data.buyTax;
      return { sellTax, buyTax };
    }
    if (lockRes && (lockRes as any).data?.statusCode === 200) {
      lockData = lockRes?.data?.data;
    }
    return { sellTax, buyTax, lockData };
  } catch (err) {
    console.log(`Error in getSecurityDatafromDextools(): ${err}`);
  }
};

export const getLPDataFromDexScreener = async (address: string) => {
  const res = await axios.get(
    `https://api.dexscreener.com/latest/dex/tokens/${address}`
  );
  if (res && (res as any)?.data?.pairs?.length > 0) {
    return (res as any).data.pairs[0];
  }
};

export const getMainPoolLPFromDexScreener = async (lpAddress: string) => {
  const res = await axios.get(
    `https://api.dexscreener.com/latest/dex/pairs/ethereum/${lpAddress}`
  );
  if (res && (res as any)?.data?.pairs?.length > 0) {
    return {
      liquidity: (res as any).data.pairs[0].liquidity.usd,
      mc: (res as any).data.pairs[0].marketCap,
    };
  }
};

export const getMaxTxWallet = async (address: string) => {
  const erc20abi = [
    "function _maxTxAmount() view returns (uint256)",
    "function _maxWalletSize() view returns (uint256)",
    "function decimals() view returns (uint256)",
    "function totalSupply() view returns (uint256)",
  ];
  const contract = new ethers.Contract(address, erc20abi, provider);
  let maxTx = "";
  let maxWallet = "";
  const decimals = await contract.decimals();
  const totalSupplyWei = await contract.totalSupply();
  const totalSupply = ethers.formatUnits(totalSupplyWei, decimals);

  try {
    maxTx = await contract._maxTxAmount();
  } catch (err) {}

  try {
    maxWallet = await contract._maxWalletSize();
  } catch (err) {}

  return {
    maxTx: maxTx ? ethers.formatUnits(maxTx, decimals) : "0",
    maxWallet: maxWallet ? ethers.formatUnits(maxWallet, decimals) : "0",
    totalSupply,
  };
};

export const setCommandsForUser = async (bot: TelegramBot, userId: string) => {
  try {
    await bot.setMyCommands(commands, {
      scope: { type: "chat", chat_id: userId },
    });
  } catch (err) {
    console.error("Error in setting commands:", err);
  }
};

export const getPoolPriceFromDexTools = async (lpAddress: string) => {
  try {
    const url = `https://public-api.dextools.io/trial/v2/pool/ether/${lpAddress}/price`;
    const res = await axios
      .get(url, { headers: { "x-api-key": dextoolsApiKey } })
      .catch((err) =>
        console.log(`Error getSecurityDataFromDextools(): ${err}`)
      );

    if (res && res.data.statusCode === 200) {
      return res.data.data;
    }
  } catch (err) {
    console.log(`Error in getPoolPriceFromDexTools: ${err}`);
  }
};

export const getPoolsDataFromDexTools = async (address: string) => {
  try {
    const url = `https://public-api.dextools.io/trial/v2/token/ether/${address}/pools?sort=creationTime&order=asc&from=2015-10-01T00:00:00.000Z&to=${new Date().toISOString()}&page=0&pageSize=10`;
    const res = await axios
      .get(url, { headers: { "x-api-key": dextoolsApiKey } })
      .catch((err) =>
        console.log(`Error getSecurityDataFromDextools(): ${err}`)
      );
    return (res as any)?.data?.data;
  } catch (err) {
    console.log(`Error in getPoolsDataFromDexTools: ${err}`);
  }
};

export const getBasicTokenMsg = (
  address: string,
  tokenName: string,
  tokenSymbol: string
) => {
  return (
    `💎 **Token Information** 💎\n\n` +
    `💠 *Token Name*: \`${tokenName}\` (\`${tokenSymbol}\`)\n` +
    `🏷️ *CA*: \`${address}\`\n\n`
  );
};

export const getTokenInfoMsg = (
  address: string,
  tokenSupply: number,
  links: {
    discord?: string;
    twitter?: string;
    website?: string;
    github?: string;
    medium?: string;
    telegram?: string;
    reddit?: string;
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    tiktok?: string;
    youtube?: string;
  }
) => {
  const msg =
    `**Token Details**:\n` +
    `├ 🌐 **Chain**: \`ETH\`\n` +
    `├ 📜 **Contract**: \`${address}\`\n` +
    `└ 🪙 **Total Supply**: \`${formatNumberWithCommas(tokenSupply)}\`\n\n`;

  const socialMsg = links
    ? `**Socials**:\n` +
      (links.discord ? `├ 💬 **Discord**: [Link](${links.discord})\n` : "") +
      (links.twitter ? `├ 🐦 **Twitter**: [Link](${links.twitter})\n` : "") +
      (links.website ? `├ 🌐 **Website**: [Link](${links.website})\n` : "") +
      (links.github ? `├ 🛠 **GitHub**: [Link](${links.github})\n` : "") +
      (links.medium ? `├ 📰 **Medium**: [Link](${links.medium})\n` : "") +
      (links.telegram ? `├ 📢 **Telegram**: [Link](${links.telegram})\n` : "") +
      (links.reddit ? `├ 👽 **Reddit**: [Link](${links.reddit})\n` : "") +
      (links.facebook ? `├ 📘 **Facebook**: [Link](${links.facebook})\n` : "") +
      (links.instagram
        ? `├ 📸 **Instagram**: [Link](${links.instagram})\n`
        : "") +
      (links.linkedin ? `├ 💼 **LinkedIn**: [Link](${links.linkedin})\n` : "") +
      (links.tiktok ? `├ 🎵 **TikTok**: [Link](${links.tiktok})\n` : "") +
      (links.youtube ? `└ 📺 **YouTube**: [Link](${links.youtube})\n` : "")
    : "No social links available.";

  return msg + socialMsg.trim();
};

export const getTokenSecurityMsg = (
  tokenSymbol: string,
  renounced: boolean,
  verified: boolean,
  deployer: string,
  deployerBalanceToken: string,
  deployerBalanceETH: string,
  deployerTxCount: string,
  contractBalance: string,
  lpBalance: string,
  percentContract: string,
  percentLp: string,
  sellTax: {
    min: number;
    max: number;
    status: string;
  },
  buyTax: {
    min: number;
    max: number;
    status: string;
  },
  amountLocked: number,
  maxTx: string,
  maxWallet: string,
  totalSupply: string
) => {
  const msg =
    `🛡️ *Token Security* 🛡️\n` +
    `  ├ ${renounced ? "✅" : "❌"} *Renounced*\n` +
    `  ├ ${verified ? "✅" : "❌"} *Verified*\n` +
    `  └ ${amountLocked > 0 ? "✅" : "❌"} *Locked*\n\n` +
    `👷‍♂️ *Deployer / Developer* \n` +
    `  ├ 📍 *Address*: \`${deployer}\`\n` +
    `  ├ 💰 *Balance*: \`${formatNumber(
      deployerBalanceETH
    )} ETH\` | \`${formatNumber(deployerBalanceToken)} ${tokenSymbol}\`\n` +
    `  └ 📈 *TX Count*: \`${deployerTxCount}\`\n\n` +
    `💵 *Balances* \n` +
    `  ├ 🔗 *Contract*: \`${formatNumber(
      contractBalance
    )}\` (\`${percentContract}%\`)\n` +
    `  └ 💧 *Liquidity*: \`${formatNumber(
      lpBalance
    )}\` (\`${percentLp}%\`)\n\n` +
    `🏦 *Max TX*: \`${
      maxTx ? formatNumberWithCommas(Number(maxTx)) : "Unknown"
    }\` (\`${((Number(maxTx) / Number(totalSupply)) * 100).toFixed(1)}%\`)\n` +
    `🧮 *Max Wallet*: \`${
      maxWallet ? formatNumberWithCommas(Number(maxWallet)) : "Unknown"
    }\` (\`${((Number(maxWallet) / Number(totalSupply)) * 100).toFixed(
      1
    )}%\`)\n\n` +
    `💸 *Taxes*:\n` +
    `  ├ 📈 *Buy*: Min: \`${buyTax?.min || 0}%\` | Max: \`${
      buyTax?.max || 0
    }%\` | Status: \`${buyTax?.status ? buyTax.status : "Unknown"}\`\n` +
    `  └ 📉 *Sell*: Min: \`${sellTax?.min || 0}%\` | Max: \`${
      sellTax?.max || 0
    }%\` | Status: \`${sellTax?.status ? sellTax.status : "Unknown"}\`\n`;

  return msg;
};

export const getTokenStats = (
  priceData: any,
  poolsData: any,
  mainPoolData: any
) => {
  const totalPages = poolsData?.totalPages;
  const pools = poolsData?.results;
  const mainPool = pools![0];
  console.log({ mainPool });
  const mainPoolCreativeTime = new Date(
    mainPool?.creationTime || new Date()
  ).getTime();
  const timeAgo = getTimeAgo(mainPoolCreativeTime);

  const msg =
    `📊 *Token Stats*\n` +
    `├ ⏳ *Age*: \`${timeAgo}\`\n` +
    `├ 🔀 *Pairs*: \`${
      pools?.length > 1
        ? totalPages > 1
          ? "More than " + (totalPages - 1) * 10 + " pairs"
          : pools?.length + " pairs"
        : pools?.length === 1
        ? "1 pair"
        : "No pairs"
    }\`\n` +
    `├ 🏦 *Pools*: \`$${
      mainPoolData ? formatNumber(mainPoolData.liquidity) : 0
    } LIQ\` | \`$${
      mainPoolData ? formatNumber(mainPoolData.mc) : 0
    } MC (FDV)\`\n\n` +
    `💵 *Price*\n` +
    `├ \`${
      priceData ? formatNumber(priceData.priceChain) : "Unknown"
    } WETH\`\n` +
    `└ \`${
      priceData ? "$" + formatNumber(priceData.price) + " USD" : "Unknown"
    }\`\n\n` +
    `📈 *Price Changes*\n` +
    `├ 5M: \`${
      priceData ? formatNumber(priceData.variation5m) : "Unknown"
    }%\`\n` +
    `├ 1H: \`${
      priceData ? formatNumber(priceData.variation1h) : "Unknown"
    }%\`\n` +
    `├ 6H: \`${
      priceData ? formatNumber(priceData.variation6h) : "Unknown"
    }%\`\n` +
    `└ 1D: \`${
      priceData ? formatNumber(priceData.variation24h) : "Unknown"
    }%\`\n\n` +
    `🔄 *Volume*\n` +
    `├ 5M: \`${
      priceData ? formatNumber(priceData.buys5m + priceData.sells5m) : "Unknown"
    }\`\n` +
    `├ 1H: \`${
      priceData ? formatNumber(priceData.buys1h + priceData.sells1h) : "Unknown"
    }\`\n` +
    `├ 6H: \`${
      priceData ? formatNumber(priceData.buys6h + priceData.sells6h) : "Unknown"
    }\`\n` +
    `└ 1D: \`${
      priceData
        ? formatNumber(priceData.buys24h + priceData.sells24h)
        : "Unknown"
    }\`\n\n` +
    `💰 *Volume in USD*\n` +
    `└ 5M: \`$${
      priceData
        ? formatNumber(priceData.buyVolume5m + priceData.sellVolume5m)
        : "Unknown"
    }\`\n` +
    `├ 1H: \`$${
      priceData
        ? formatNumber(priceData.buyVolume1h + priceData.sellVolume1h)
        : "Unknown"
    }\`\n` +
    `├ 6H: \`$${
      priceData
        ? formatNumber(priceData.buyVolume6h + priceData.sellVolume6h)
        : "Unknown"
    }\`\n` +
    `└ 1D: \`$${
      priceData
        ? formatNumber(priceData.buyVolume24h + priceData.sellVolume24h)
        : "Unknown"
    }\`\n\n`;

  return msg;
};

export const getWelcomeMsg = () => {
  let msg =
    `🌟 **Welcome to the Sniper Bot!** 🌟\n\n` +
    `We are excited to have you on board! Below is a list of commands you can use to get the most out of this bot:\n\n` +
    `**Available Commands:**\n` +
    `- 🖥️ **/start** – Opens the control panel for easy navigation.\n` +
    `- 📊 **/token\\_info** – Get detailed information about a token's contract, balance, and more.\n` +
    `- 🛡️ **/token\\_security** – Check the deployer's info, taxes, and any potential security risks.\n` +
    `- 📈 **/token\\_stats** – View essential token stats such as price, volume, and performance metrics.\n` +
    `- 📝 **/full\\_report** – Generate a comprehensive report with all available token details.\n\n` +
    `Feel free to reach out if you need any assistance! 🤖`;

  return msg;
};
