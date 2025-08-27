Discord Integration
Discord Bot Commands:
// Discord slash commands
/soapbox-feed $MYU - Shows embedded ticker in channel
/soapbox-pin "message" - Pins message to your token rooms  
/soapbox-rooms - Lists/manages your rooms
/soapbox-watch $BB - Sets up auto-updates for token in channel
Discord Rich Embeds:
// When someone shares https://yourdomain.com/soapbox/$BB in Discord
{
  title: "$BB SoapBox Live Feed",
  description: "12 live updates from 4 community rooms",
  color: 0x8B5CF6, // Purple
  fields: [
    { name: "Active Rooms", value: "4", inline: true },
    { name: "Live Updates", value: "12", inline: true },
    { name: "Latest", value: "🚀 New token unlock announced!", inline: false }
  ],
  image: { url: "https://schmidtiest.xyz/api/og-ticker/$BB" },
  footer: { text: "SoapBox • Live token community feed" }
}

Discord Webhook Integration:
// Auto-post new pinned messages to Discord channels
const discordWebhook = {
  content: null,
  embeds: [{
    title: `🧼 New $${tokenSymbol} Update`,
    description: message.content,
    color: 0x8B5CF6,
    author: {
      name: message.authorName,
      icon_url: `https://schmidtiest.xyz/api/avatar/${message.authorAddress}`
    },
    footer: {
      text: `From ${message.roomName} • SoapBox`,
      icon_url: "https://soapbox.app/icon.png"
    },
    timestamp: message.timestamp
  }]
}
