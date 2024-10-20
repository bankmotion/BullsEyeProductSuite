import { setTimeout } from "timers";

export const extractUsername = (input: string): string => {
  let username = "";

  const linkMatch = input.match(/https:\/\/t\.me\/([a-zA-Z0-9_]+)/);
  if (linkMatch) {
    username = linkMatch[1];
  } else {
    const usernameMatch = input.match(/^@?([a-zA-Z0-9_]+)/);
    if (usernameMatch) {
      username = usernameMatch[1]; // Extract the part after "@" or the whole if no "@"
    } else {
      username = input;
    }
  }
  return username;
};

export const delay = async (delayTime: number) => {
  return new Promise((resolve) => setTimeout(resolve, delayTime * 1000));
};

export const getTimeAgo = (time: number): string => {
  const now = Date.now();
  const diffInSeconds = Math.floor((now - time) / 1000);

  const units = [
    { name: "year", seconds: 31536000 },
    { name: "month", seconds: 2592000 },
    { name: "week", seconds: 604800 },
    { name: "day", seconds: 86400 },
    { name: "hour", seconds: 3600 },
    { name: "minute", seconds: 60 },
    { name: "second", seconds: 1 },
  ];

  for (const unit of units) {
    const elapsed = Math.floor(diffInSeconds / unit.seconds);
    if (elapsed > 0) {
      return elapsed === 1
        ? `a ${unit.name} ago`
        : `${elapsed} ${unit.name}s ago`;
    }
  }

  return "just now";
};
