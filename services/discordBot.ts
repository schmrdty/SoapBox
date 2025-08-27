//--src/services/discordBot.ts  
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
