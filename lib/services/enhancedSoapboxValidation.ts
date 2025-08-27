//--src/lib/services/enhancedSoapboxValidation.ts
import { authorizationCache } from './authorizationCache';
import { createResilientPublicClient } from '@/lib/rpc-config';
import type { Address } from 'viem';

interface ValidationResult {
  isValid: boolean;
  isAuthorized: boolean;
  hasTokenBalance: boolean;
  tokenBalance: string;
  tokenSymbol: string;
  authorizedAddresses: string[];
  isSetupperAuthorized: boolean;
  error?: string;
  source?: string; // 'blockchain' | 'cache' | 'fallback'
}

interface AuthorizedAddressesResult {
  addresses: string[];
  source: 'blockchain' | 'cache';
}

/**
 * Enhanced SoapBox validation with authorization caching and multiple fallback strategies
 */
export class EnhancedSoapboxValidation {
  private rpcClient = createResilientPublicClient();

  /**
   * Get authorized addresses with caching fallback
   */
  private async getAuthorizedAddresses(
    empireVaultAddress: string,
    walletAddress: string
  ): Promise<AuthorizedAddressesResult> {
    try {
      // Try blockchain first
      console.log(`🔍 Fetching authorized addresses from blockchain for vault: ${empireVaultAddress}`);
      
      const addresses = await this.rpcClient.readContract({
        address: empireVaultAddress as Address,
        abi: [
          {
            inputs: [],
            name: 'getAuthorizedAddresses',
            outputs: [{ name: '', type: 'address[]' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'getAuthorizedAddresses',
      });

      const addressList = (addresses as string[]).map(addr => addr.toLowerCase());
      
      // Cache the result
      const isAuthorized = addressList.includes(walletAddress.toLowerCase());
      authorizationCache.setAuthorization(empireVaultAddress, walletAddress, addressList, isAuthorized);
      
      console.log(`✅ Got ${addressList.length} authorized addresses from blockchain`);
      return { addresses: addressList, source: 'blockchain' };

    } catch (error) {
      console.log(`❌ Blockchain call failed, checking cache fallback:`, error);
      
      // Fallback to cache
      const cachedAuth = authorizationCache.getAuthorization(empireVaultAddress, walletAddress);
      if (cachedAuth) {
        console.log(`💾 Using cached authorized addresses (${cachedAuth.authorizedAddresses.length} addresses)`);
        return { addresses: cachedAuth.authorizedAddresses, source: 'cache' };
      }

      console.log(`❌ No cache fallback available for ${empireVaultAddress}`);
      throw error;
    }
  }

  /**
   * Check if wallet is authorized to create SoapBoxes for an Empire vault
   */
  async checkAuthorization(
    empireVaultAddress: string,
    walletAddress: string
  ): Promise<{ isAuthorized: boolean; authorizedAddresses: string[]; source: string }> {
    try {
      const result = await this.getAuthorizedAddresses(empireVaultAddress, walletAddress);
      const isAuthorized = result.addresses.includes(walletAddress.toLowerCase());
      
      console.log(`🔍 Authorization check for ${walletAddress}: ${isAuthorized ? 'AUTHORIZED' : 'NOT AUTHORIZED'} (source: ${result.source})`);
      
      return {
        isAuthorized,
        authorizedAddresses: result.addresses,
        source: result.source,
      };
    } catch (error) {
      console.error('❌ Authorization check failed:', error);
      return {
        isAuthorized: false,
        authorizedAddresses: [],
        source: 'error',
      };
    }
  }

  /**
   * Check setupper authorization for splits factory
   */
  async checkSetupperAuthorization(
    empireVaultAddress: string,
    setupperAddress: string
  ): Promise<{ isAuthorized: boolean; authorizedAddresses: string[]; source: string }> {
    console.log(`🏭 Checking setupper authorization: ${setupperAddress} for vault: ${empireVaultAddress}`);
    return this.checkAuthorization(empireVaultAddress, setupperAddress);
  }

  /**
   * Get token balance and info
   */
  async getTokenInfo(
    tokenAddress: string,
    walletAddress: string
  ): Promise<{ balance: string; symbol: string; hasEnoughTokens: boolean }> {
    try {
      console.log(`💰 Checking token balance for ${walletAddress} on token ${tokenAddress}`);
      
      // Get token symbol
      const symbol = await this.rpcClient.readContract({
        address: tokenAddress as Address,
        abi: [
          {
            inputs: [],
            name: 'symbol',
            outputs: [{ name: '', type: 'string' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'symbol',
      });

      // Get token balance
      const balance = await this.rpcClient.readContract({
        address: tokenAddress as Address,
        abi: [
          {
            inputs: [{ name: 'account', type: 'address' }],
            name: 'balanceOf',
            outputs: [{ name: '', type: 'uint256' }],
            stateMutability: 'view',
            type: 'function',
          },
        ],
        functionName: 'balanceOf',
        args: [walletAddress as Address],
      });

      const balanceString = balance.toString();
      const hasEnoughTokens = BigInt(balanceString) >= BigInt('0'); // Minimum requirement

      console.log(`💰 Token info: ${balanceString} ${symbol} (sufficient: ${hasEnoughTokens})`);
      
      return {
        balance: balanceString,
        symbol: symbol as string,
        hasEnoughTokens,
      };
    } catch (error) {
      console.error('❌ Token info check failed:', error);
      return {
        balance: '0',
        symbol: 'ERROR',
        hasEnoughTokens: true, // Allow creation even if token check fails
      };
    }
  }

  /**
   * Comprehensive SoapBox validation with caching fallbacks
   */
  async validateSoapBoxCreation(
    empireVaultAddress: string,
    tokenAddress: string,
    walletAddress: string,
    setupperAddress?: string
  ): Promise<ValidationResult> {
    console.log(`🔍 Starting enhanced SoapBox validation for ${walletAddress}`);
    
    try {
      // 1. Check wallet authorization with caching fallback
      const authResult = await this.checkAuthorization(empireVaultAddress, walletAddress);
      
      // 2. Check setupper authorization if provided
      let setupperAuthResult = { isAuthorized: true, source: 'not-required' };
      if (setupperAddress && setupperAddress !== walletAddress) {
        setupperAuthResult = await this.checkSetupperAuthorization(empireVaultAddress, setupperAddress);
      }
      
      // 3. Check token balance
      const tokenInfo = await this.getTokenInfo(tokenAddress, walletAddress);
      
      const isValid = authResult.isAuthorized && setupperAuthResult.isAuthorized && tokenInfo.hasEnoughTokens;
      
      const result: ValidationResult = {
        isValid,
        isAuthorized: authResult.isAuthorized,
        hasTokenBalance: tokenInfo.hasEnoughTokens,
        tokenBalance: tokenInfo.balance,
        tokenSymbol: tokenInfo.symbol,
        authorizedAddresses: authResult.authorizedAddresses,
        isSetupperAuthorized: setupperAuthResult.isAuthorized,
        source: authResult.source,
      };

      console.log(`✅ Enhanced validation complete:`, {
        isValid,
        authSource: authResult.source,
        setupperAuth: setupperAuthResult.isAuthorized,
        tokenBalance: `${tokenInfo.balance} ${tokenInfo.symbol}`,
      });

      return result;
    } catch (error) {
      console.error('❌ Enhanced validation failed:', error);
      
      return {
        isValid: false,
        isAuthorized: false,
        hasTokenBalance: false,
        tokenBalance: '0',
        tokenSymbol: 'ERROR',
        authorizedAddresses: [],
        isSetupperAuthorized: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        source: 'error',
      };
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return authorizationCache.getStats();
  }

  /**
   * Clear cache (for testing/debugging)
   */
  clearCache() {
    authorizationCache.clear();
  }
}

// Singleton instance
export const enhancedSoapboxValidation = new EnhancedSoapboxValidation();