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