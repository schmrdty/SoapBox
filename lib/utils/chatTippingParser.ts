//--src/lib/utils/chatTippingParser.ts
export interface TipCommand {
  action: 'tip';
  recipient: string;
  amount: string;
  currency: string;
  confidence: number;
  isBasename: boolean;
}

interface ParsedComponents {
  recipient?: string;
  amount?: string;
  currency?: string;
  isBasename: boolean;
}

// Essential currency/token symbols and their normalized forms
const CURRENCY_MAP: Record<string, string> = {
  // Major cryptocurrencies
  'eth': 'ETH',
  'ethereum': 'ETH',
  'btc': 'BTC',
  'bitcoin': 'BTC',
  
  // Stablecoins
  'usdc': 'USDC',
  'usd': 'USDC',
  'dollar': 'USDC',
  'dollars': 'USDC',
  'usdt': 'USDT',
  'tether': 'USDT',
  'dai': 'DAI',
  'frax': 'FRAX',
  
  // Popular DeFi tokens
  'uni': 'UNI',
  'uniswap': 'UNI',
  'link': 'LINK',
  'chainlink': 'LINK',
  'aave': 'AAVE',
  'comp': 'COMP',
  'compound': 'COMP',
  'mkr': 'MKR',
  'maker': 'MKR',
  'snx': 'SNX',
  'synthetix': 'SNX',
  
  // Layer 2 tokens
  'matic': 'MATIC',
  'polygon': 'MATIC',
  'op': 'OP',
  'optimism': 'OP',
  'arb': 'ARB',
  'arbitrum': 'ARB',
  'base': 'BASE',
  
  // Wrapped tokens
  'weth': 'WETH',
  'wbtc': 'WBTC',
  
  // Popular meme/social tokens
  'degen': 'DEGEN',
  'higher': 'HIGHER',
  'toshi': 'TOSHI',
  'brett': 'BRETT',
  'pepe': 'PEPE',
  'doge': 'DOGE',
  'dogecoin': 'DOGE',
  'shib': 'SHIB',
  'shiba': 'SHIB',
  
  // Solana ecosystem
  'sol': 'SOL',
  'solana': 'SOL',
  'bonk': 'BONK',
  'jup': 'JUP',
  'jupiter': 'JUP',
  'ray': 'RAY',
  'raydium': 'RAY',
  
  // Gaming tokens
  'ape': 'APE',
  'apecoin': 'APE',
  'axs': 'AXS',
  'axie': 'AXS',
  'sand': 'SAND',
  'sandbox': 'SAND',
  'mana': 'MANA',
  'decentraland': 'MANA',
  
  // NFT related
  'nft': 'NFT',
  'ens': 'ENS',
  
  // Other popular tokens
  'bnb': 'BNB',
  'binance': 'BNB',
  'avax': 'AVAX',
  'avalanche': 'AVAX',
  'dot': 'DOT',
  'polkadot': 'DOT',
  'atom': 'ATOM',
  'cosmos': 'ATOM',
  'near': 'NEAR',
  'ada': 'ADA',
  'cardano': 'ADA',
  
  // Common crypto slang
  'gm': 'GM',
  'gn': 'GN',
  'wagmi': 'WAGMI',
  'ngmi': 'NGMI',
  'hodl': 'HODL',
  'lfg': 'LFG',
  'moon': 'MOON',
  'diamond': 'DIAMOND',
  'paper': 'PAPER'
};

// Common tip command patterns
const TIP_PATTERNS = [
  // "tip username $amount"
  /^tip\s+([^\s]+)\s+\$(\d+(?:\.\d{1,2})?)$/i,
  // "tip username amount currency"
  /^tip\s+([^\s]+)\s+(\d+(?:\.\d{1,8})?)\s+([a-zA-Z]+)$/i,
  // "tip username amount"
  /^tip\s+([^\s]+)\s+(\d+(?:\.\d{1,8})?)$/i,
  // "$amount to username"
  /^\$(\d+(?:\.\d{1,2})?)\s+to\s+([^\s]+)$/i,
  // "send amount currency to username"
  /^send\s+(\d+(?:\.\d{1,8})?)\s+([a-zA-Z]+)\s+to\s+([^\s]+)$/i,
  // "send $amount to username"
  /^send\s+\$(\d+(?:\.\d{1,2})?)\s+to\s+([^\s]+)$/i,
  // "@username amount currency"
  /^@([^\s]+)\s+(\d+(?:\.\d{1,8})?)\s+([a-zA-Z]+)$/i,
  // "@username $amount"
  /^@([^\s]+)\s+\$(\d+(?:\.\d{1,2})?)$/i,
  // "⚡ username amount currency"
  /^⚡\s*([^\s]+)\s+(\d+(?:\.\d{1,8})?)\s+([a-zA-Z]+)$/i,
  // "⚡ username $amount"
  /^⚡\s*([^\s]+)\s+\$(\d+(?:\.\d{1,2})?)$/i
];

// Basename validation regex
const BASENAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]\.base\.eth$|^[a-zA-Z0-9]\.base\.eth$/;

// Ethereum address validation regex
const ETH_ADDRESS_REGEX = /^0x[a-fA-F0-9]{40}$/;

/**
 * Check if a string is a valid basename
 */
function isBasename(recipient: string): boolean {
  return BASENAME_REGEX.test(recipient);
}

/**
 * Check if a string is a valid Ethereum address
 */
function isEthereumAddress(recipient: string): boolean {
  return ETH_ADDRESS_REGEX.test(recipient);
}

/**
 * Normalize currency symbol using the currency map
 */
function normalizeCurrency(currency: string): string {
  const normalized = CURRENCY_MAP[currency.toLowerCase()];
  return normalized || currency.toUpperCase();
}

/**
 * Validate amount string
 */
function isValidAmount(amount: string): boolean {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && num < 1e18; // Reasonable upper bound
}

/**
 * Calculate confidence score for parsed command
 */
function calculateConfidence(components: ParsedComponents): number {
  let confidence = 0;

  // Base confidence for having all required components
  if (components.recipient && components.amount && components.currency) {
    confidence += 40;
  }

  // Recipient validation
  if (components.recipient) {
    if (isBasename(components.recipient)) {
      confidence += 25; // High confidence for valid basename
    } else if (isEthereumAddress(components.recipient)) {
      confidence += 20; // Good confidence for valid address
    } else if (components.recipient.includes('.')) {
      confidence += 10; // Some confidence for domain-like strings
    } else {
      confidence += 5; // Low confidence for plain usernames
    }
  }

  // Amount validation
  if (components.amount && isValidAmount(components.amount)) {
    confidence += 20;
  }

  // Currency validation
  if (components.currency) {
    const normalized = normalizeCurrency(components.currency);
    if (CURRENCY_MAP[components.currency.toLowerCase()]) {
      confidence += 15; // Known currency
    } else if (normalized.length >= 2 && normalized.length <= 10) {
      confidence += 10; // Reasonable currency symbol length
    } else {
      confidence += 5; // Unknown but plausible currency
    }
  }

  return Math.min(confidence, 100);
}

/**
 * Parse tip command from natural language input
 */
export function parseTipCommand(input: string): TipCommand | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmedInput = input.trim();
  if (!trimmedInput) {
    return null;
  }

  let components: ParsedComponents = {
    isBasename: false
  };

  // Try each pattern until we find a match
  for (const pattern of TIP_PATTERNS) {
    const match = trimmedInput.match(pattern);
    if (match) {
      // Extract components based on pattern structure
      if (pattern.source.includes('tip\\s+([^\\s]+)\\s+\\$')) {
        // "tip username $amount"
        components.recipient = match[1];
        components.amount = match[2];
        components.currency = 'USDC'; // Default for $ symbol
      } else if (pattern.source.includes('tip\\s+([^\\s]+)\\s+(\\d+')) {
        if (match[3]) {
          // "tip username amount currency"
          components.recipient = match[1];
          components.amount = match[2];
          components.currency = match[3];
        } else {
          // "tip username amount" (no currency)
          components.recipient = match[1];
          components.amount = match[2];
          components.currency = 'USDC'; // Default currency
        }
      } else if (pattern.source.includes('\\$(.+)\\s+to\\s+')) {
        // "$amount to username"
        components.amount = match[1];
        components.recipient = match[2];
        components.currency = 'USDC';
      } else if (pattern.source.includes('send\\s+(\\d+')) {
        if (match[3]) {
          // "send amount currency to username"
          components.amount = match[1];
          components.currency = match[2];
          components.recipient = match[3];
        } else {
          // "send $amount to username"
          components.amount = match[1];
          components.recipient = match[2];
          components.currency = 'USDC';
        }
      } else if (pattern.source.includes('@([^\\s]+)\\s+')) {
        if (match[3]) {
          // "@username amount currency"
          components.recipient = match[1];
          components.amount = match[2];
          components.currency = match[3];
        } else {
          // "@username $amount"
          components.recipient = match[1];
          components.amount = match[2];
          components.currency = 'USDC';
        }
      } else if (pattern.source.includes('⚡\\s*([^\\s]+)\\s+')) {
        if (match[3]) {
          // "⚡ username amount currency"
          components.recipient = match[1];
          components.amount = match[2];
          components.currency = match[3];
        } else {
          // "⚡ username $amount"
          components.recipient = match[1];
          components.amount = match[2];
          components.currency = 'USDC';
        }
      }

      break; // Found a match, stop trying patterns
    }
  }

  // Validate that we have all required components
  if (!components.recipient || !components.amount || !components.currency) {
    return null;
  }

  // Normalize and validate components
  const normalizedCurrency = normalizeCurrency(components.currency);
  
  if (!isValidAmount(components.amount)) {
    return null;
  }

  // Check if recipient is a basename
  components.isBasename = isBasename(components.recipient);

  // Validate recipient format
  if (!components.isBasename && !isEthereumAddress(components.recipient)) {
    // Allow other formats but with lower confidence
    if (components.recipient.length < 3 || components.recipient.length > 50) {
      return null;
    }
  }

  const confidence = calculateConfidence(components);

  // Require minimum confidence threshold
  if (confidence < 30) {
    return null;
  }

  return {
    action: 'tip',
    recipient: components.recipient,
    amount: components.amount,
    currency: normalizedCurrency,
    confidence,
    isBasename: components.isBasename
  };
}

/**
 * Validate a tip command object
 */
export function validateTipCommand(command: TipCommand): boolean {
  if (!command || command.action !== 'tip') {
    return false;
  }

  if (!command.recipient || !command.amount || !command.currency) {
    return false;
  }

  if (!isValidAmount(command.amount)) {
    return false;
  }

  if (command.isBasename && !isBasename(command.recipient)) {
    return false;
  }

  if (!command.isBasename && !isEthereumAddress(command.recipient)) {
    // Allow other recipient formats but validate length
    if (command.recipient.length < 3 || command.recipient.length > 50) {
      return false;
    }
  }

  if (command.confidence < 0 || command.confidence > 100) {
    return false;
  }

  return true;
}