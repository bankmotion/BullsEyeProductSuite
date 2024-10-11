export enum ScopeRangeStep {
  InputType,
  InputMin,
  InputMax,
  InputFixedVal,
  Processing
}

export const sniperbotAddress = {
  //   bananaGun: "0x3328F7f4A1D1C57c35df56bBf0c9dCAFCA309C49",
  bananaGun: "0xc465cc50b7d5a29b9308968f870a4b242a8e1873",
  maestro: "0x80a64c6d7f12c47b7c66c5b4e20e72bc1fcd5d9e",
};

export const generalCommands = [
  {
    command: "/start",
    description: "Opens the control panel",
  },
  {
    command: "/show_ca",
    description: "Check approvals for a specific token address.",
  },
  {
    command: "/show_all",
    description: "Displays the top 10 sniping activities in the last hour.",
  },
  {
    command: "/show_range",
    description:
      "Show activity the lastest 10 activities in a specific range or specific value last 24 hours.",
  },
];

export const adminCommands = [
  {
    command: "/add_sniperbot",
    description: "Add a new sniper bot",
  },
  {
    command: "/show_sniperbots",
    description: "Show all added sniper bots",
  },
  {
    command: "/delete_sniperbot",
    description: "Delete a sniper bot by its ID",
  },
];

export enum ScopeOption {
  CheckCA,
  ShowAllLastDuration,
  ShowWithCustomCount,
}

export const scopeConfig = {
  expireDuration: 7200,
  postDuration: 1200,
  showAllOptionDuration: 3600,
  showAllOptionLimit: 10,
  showRangeOptionDuration: 3600 * 24,
  showRangeOptionLimit: 10,
};
