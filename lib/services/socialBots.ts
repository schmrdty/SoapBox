//--/src/services/telegramBot.ts
export class TelegramBotService {
  private botToken = process.env.TELEGRAM_BOT_TOKEN!
  private baseUrl = `https://api.telegram.org/bot${this.botToken}`

  async sendTickerEmbed(chatId: string, tokenSymbol: string, tickerData: any) {
    const message = {
      chat_id: chatId,
      text: `🧼 *$${tokenSymbol} SoapBox Feed*\n\n` +
            `📊 ${tickerData.totalMessages} updates from ${tickerData.roomCount} rooms\n\n` +
            `Latest: _"${tickerData.messages[0]?.content || 'No recent updates'}"_`,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          {
            text: `🔗 View Full Feed`,
            url: `${process.env.NEXT_PUBLIC_APP_URL}/soapbox/${tokenSymbol}`
          },
          {
            text: `💬 Join Chat`,
            web_app: { url: `${process.env.NEXT_PUBLIC_APP_URL}?token=${tokenSymbol}` }
          }
        ]]
      }
    }

    return this.makeRequest('sendMessage', message)
  }

  async setupWebApp(domain: string) {
    return this.makeRequest('setChatMenuButton', {
      menu_button: {
        type: 'web_app',
        text: 'Open SoapBox',
        web_app: { url: `https://${domain}` }
      }
    })
  }

  private async makeRequest(method: string, params: any) {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
    return response.json()
  }
}

// /src/services/discordBot.ts  
export class DiscordBotService {
  private botToken = process.env.DISCORD_BOT_TOKEN!
  private applicationId = process.env.DISCORD_APPLICATION_ID!

  async sendTickerEmbed(channelId: string, tokenSymbol: string, tickerData: any) {
    const embed = {
      title: `🧼 $${tokenSymbol} SoapBox Feed`,
      description: `Live community updates from ${tickerData.roomCount} rooms`,
      color: 0x8B5CF6,
      fields: [
        { name: "📊 Total Updates", value: tickerData.totalMessages.toString(), inline: true },
        { name: "🏠 Active Rooms", value: tickerData.roomCount.toString(), inline: true },
        { name: "⏰ Last Update", value: `<t:${Math.floor(Date.now() / 1000)}:R>`, inline: true }
      ],
      image: { 
        url: `${process.env.NEXT_PUBLIC_APP_URL}/api/og-ticker/${tokenSymbol}` 
      },
      footer: {
        text: "SoapBox • Live token community feeds",
        icon_url: `${process.env.NEXT_PUBLIC_APP_URL}/icon.png`
      }
    }

    if (tickerData.messages[0]) {
      embed.fields.push({
        name: "💬 Latest Message",
        value: `"${tickerData.messages[0].content}" - ${tickerData.messages[0].authorName}`,
        inline: false
      })
    }

    return this.makeRequest(`/channels/${channelId}/messages`, {
      embeds: [embed],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 5,
          label: "View Live Feed",
          url: `${process.env.NEXT_PUBLIC_APP_URL}/soapbox/${tokenSymbol}`
        }]
      }]
    })
  }

  async registerSlashCommands() {
    const commands = [
      {
        name: 'soapbox-feed',
        description: 'Show live feed for a token community',
        options: [{
          type: 3,
          name: 'token',
          description: 'Token symbol (e.g., BB, PEPE)',
          required: true
        }]
      },
      {
        name: 'soapbox-pin',
        description: 'Pin a message to your token rooms',
        options: [{
          type: 3,
          name: 'message',
          description: 'Message to pin',
          required: true
        }]
      }
    ]

    return this.makeRequest(`/applications/${this.applicationId}/commands`, commands, 'PUT')
  }

  private async makeRequest(endpoint: string, data: any, method: string = 'POST') {
    const response = await fetch(`https://discord.com/api/v10${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bot ${this.botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    return response.json()
  }
}

// /src/services/slackBot.ts
export class SlackBotService {
  private botToken = process.env.SLACK_BOT_TOKEN!

  async sendTickerEmbed(channelId: string, tokenSymbol: string, tickerData: any) {
    const blocks = [
      {
        type: "header",
        text: { type: "plain_text", text: `🧼 $${tokenSymbol} SoapBox Feed` }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*📊 Updates:* ${tickerData.totalMessages}` },
          { type: "mrkdwn", text: `*🏠 Rooms:* ${tickerData.roomCount}` }
        ]
      }
    ]

    if (tickerData.messages[0]) {
      blocks.push({
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*Latest:* "${tickerData.messages[0].content}" - _${tickerData.messages[0].authorName}_`
        }
      })
    }

    blocks.push({
      type: "actions",
      elements: [{
        type: "button",
        text: { type: "plain_text", text: "🔗 View Live Feed" },
        url: `${process.env.NEXT_PUBLIC_APP_URL}/soapbox/${tokenSymbol}`,
        style: "primary"
      }]
    })

    return this.makeRequest('/chat.postMessage', {
      channel: channelId,
      blocks,
      unfurl_links: false,
      unfurl_media: false
    })
  }

  private async makeRequest(endpoint: string, data: any) {
    const response = await fetch(`https://slack.com/api${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.botToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    })
    return response.json()
  }
}


//--------------partition------------------//
🎮 Discord Integration (The Missing Piece!)
Discord Bot Commands:
// Discord slash commands
/soapbox-feed $BB - Shows embedded ticker in channel
/soapbox-pin "message" - Pins message to your token rooms  
/soapbox-rooms - Lists/manages your rooms
/soapbox-watch $BB - Sets up auto-updates for token in channel
Discord Rich Embeds:
// When someone shares https://schmidtiest.xyz/soapbox/$BB in Discord
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


