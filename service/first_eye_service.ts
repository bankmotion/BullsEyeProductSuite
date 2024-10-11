export const getPrompt = (
  text: string,
  links: { text: string; url: string }[]
) => {
  const linksString =
    links.length > 0
      ? `Social Links: ` + links.map((link) => `${link.text}: ${link.url}`).join("\n")
      : "";

  const prompt = `
    I want you to check and format the following post text, ensuring that it is related to either a prelaunch or launch of a token. If the post is not related to prelaunch or launching, respond with the message 'THIS_IS_NOT'. If it is related, format the message in the following structured format, starting with '🌟 Prelaunch Announcement: token_name 🌟':

    Please ensure:

    If the text contains prelaunch or launch-related terms, follow this format strictly.
    Avoid repeating any content, and use only the required fields from the post.
    Here's the post content: '${text} \n${linksString}'
    
    Please follow the given structure and avoid adding unnecessary details.
    
    Example structure:

    🌟 Prelaunch Announcement: Memecoinbase 🌟

    🚀 Name: Memecoinbase (🔥ETH)

    📝 Description: 
    Memecoinbase offers a secure and decentralized platform for users to effortlessly buy, sell, transfer, and store memecoins and NFTs. Join us in revolutionizing the memecoin market!

    🔗 Social Links:
    Telegram: https://t.me/memecoinbase
    Website: https://memecoinbase.io

    ⏰ Date of Launch: Launching at 10 PM UTC
    📦 Contract Address (CA): 0xcA57d565A08A1eE45F8878FA7Cd282693d3183E1

    
  `;
  return prompt;
};
