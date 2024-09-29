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
