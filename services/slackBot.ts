//--/src/services/slackBot.ts
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
