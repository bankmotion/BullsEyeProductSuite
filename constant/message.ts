export const messages = {
  InputTokenAddress: "🖊 Please input the token address",
  unauthorizedAccess: "❌ Unauthorized access!",
  accessDBError:
    "⚠ An error occurred while accessing the database. Please try again.",
  validAddress: "❗ Please provide the valid address.",
  startDescription: `
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
  `,
  firstEye: {
    scrapingIsProgress: "⌛ Scraping is already in progress.",
    scrapingStarted: "🌟 Scraping started.",
    scrapingStopped: "🤚 Scraping stopped.",
    scrapingNotRunning: "🤚 Scraping is not running.",
    scrapingCurrentlyActived: "✅ Scraping is currently *active*.",
    scrapingCurrentlyStopped: "🛑 Scraping is currently *stopped*.",
    keywordAlreadyExist: "🔔 This keyword already exists.",
    keywordAdded: "👌 New keyword has been successfully added.",
    keywordNotExist: "⚠ This keyword is not exists.",
    keywordDeleted: '👌 "%{keyword}" keyword has been successfully deleted.',
    noKeywords: "⚠ There are no keywords available.",
    addGroupInvalidFormat:
      "⚠ Invalid format. The correct format is:\n\n/add_group <group_username or group_link>",
    invalidGroup:
      "⚠ Invalid group. Please provide a valid group link or username.",
    groupIsAlreadyExist: "🔔 This group is already added to the database.",
    groupAdded:
      "🎉 Group added successfully:\n\n📌 Group Title: %{groupTitle}\n🆔 Group ID: %{groupId}\n👤 Group Username: %{groupName}",
    invalidGroupForamt:
      "⚠ An error occurred. Please make sure the group username or link is valid.",
    groupNotExist: "🔔 This group is not exists.",
    groupRemoved: "🎉 Group removed successfully",
    NotGroup: "🔔 There are no groups available.",
    CountGroup: "📃 There are %{count} groups:\n\n",
    groupInfo:
      "🎉 Information\n\n📌 Group Title: %{groupTitle}\n🆔 Group ID: %{groupId}\n👤 Group Username: %{groupName}",
  },
  scopeEye: {
    invalidFormatSniper:
      "⚠ Invalid format. The correct format is:\n\n/add_sniperbot <contract_address> <bot_name>",
    sniperAdded:
      "🎉 Sniper Bot added successfully:\n\n🆔 ID: %{id}\n📌 Address: %{address}\n👤 Bot Name: %{name}",
    noSniperBots: "⚠ There are no Sniping Bots available.",
    alreadyExistBot: "This bot's name or address already existed.",
    invalidSniperDelete:
      "⚠ Invalid format. The correct format is:\n\n/delete_sniperbot <Bot_ID>",
    sniperNotExist: "⚠ This bot is not exist",
    deleteSniperBot: "👌 This bot has been successfully deleted.",
    showRangeFormatInvalid:
      "⚠ Invalid format. The correct format is:\n\n/show_range <min> <max> or /show_range <value>",
    DetermineRangeType:
      "🔍 Please select a range type:\n\nR - Range 📊\nF - Fixed Value 🔢",
    InvalidRangeTypeInput:
      "❌ Invalid input. Please type 'R' for Range or 'F' for Fixed Value.",
    InputMinValue: "✏️ Please enter the minimum value:",
    InputFixedValue: "✏️ Please enter the fixed value:",
    InputMaxValue: "✏️ Please enter the maximum value:",
    InvalidMinValue: "❌ Invalid minimum value. Please enter a valid number.",
    InvalidMaxValue:
      "❌ Invalid maximum value. It must be greater than the minimum.",
    InvalidFixedValue: "❌ Invalid fixed value. Please enter a valid number.",
    InputSniperName: "✏️ Please enter the sniper bot name:",
    InputSniperAddress: "✏️ Please enter the sniper bot address:",
    InvalidAddress: "❌ Invalid contract address.",
    InputSniperId: "✏️ Please enter the sniper bot ID:",
    InvalidSniperId: "❌ Invalid sniper ID.",
  },
  CAEye: {
    InputAddress: "✏️ Please input token address.",
    UnableRetrieve:
      "❌ *Error:* Unable to retrieve token information. Please make sure the contract address is correct.",
    ErrorOccuring:
      "❌ *Error:* An error occurred while fetching token information. Please try again later.",
    NoLPData: "❌ No LP data available",
  },
};
