//--src/lib/services/consolidatedSoapBoxValidation.ts
import { createResilientPublicClient, createFallbackPublicClient, getRPCConfig } from '@/lib/rpc-config'
import { checkWalletAuthorization, getTokenInfoFromVault, tokenUtils } from '@/lib/tokenUtils'
import { checkSetupperAuthorization } from '@/lib/contracts/soapboxSplitsFactory'
import { authorizationCache } from './authorizationCache'
import { tokenInfoResolver, type ResolvedTokenInfo } from './tokenInfoResolver'
import { createPublicClient, erc20Abi, formatUnits, http } from 'viem'
import { base } from 'viem/chains'
import type { Address } from 'viem'

export interface SoapBoxValidationResult {
  isValid: boolean
  isAuthorized: boolean
  hasTokenBalance: boolean
  tokenBalance: string
  tokenSymbol: string
  tokenName?: string
  tokenLogoURI?: string
  tokenVerified?: boolean
  authorizedAddresses: string[]
  isSetupperAuthorized: boolean
  error?: string
  source?: 'blockchain' | 'cache' | 'fallback' | 'emergency' | 'error'
  tokenMetadataSource?: 'vault' | 'tokenUtils' | 'empireApi' | 'fallback' | 'error' | 'cache'
  details: {
    empireVaultAddress: string
    baseTokenAddress: string
    userAddress: string
    minimumTokenBalance: string
    actualTokenBalance: string
    authorizedAddresses: string[]
    isSetupperAuthorized: boolean
    tokenMetadata?: ResolvedTokenInfo
  }
}

export interface AuthorizedAddressesResult {
  addresses: string[]
  source: 'blockchain' | 'cache' | 'fallback' | 'emergency' | 'error'
}

/**
 * Consolidated SoapBox validation service combining comprehensive validation logic 
 * with authorization caching and multiple fallback strategies
 */
export class ConsolidatedSoapboxValidation {
  private publicClient: ReturnType<typeof createResilientPublicClient>
  private fallbackClient: ReturnType<typeof createFallbackPublicClient>
  private emergencyClient: any

  // Empire Vault ABI for getAuthorizedAddresses
  private readonly EMPIRE_VAULT_ABI = [
    {
      inputs: [],
      name: 'getAuthorizedAddresses',
      outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
      stateMutability: 'view',
      type: 'function'
    }
  ] as const

  constructor() {
    this.publicClient = createResilientPublicClient()
    this.fallbackClient = createFallbackPublicClient()
    
    // Create emergency client with private RPC endpoint for critical failures
    const { primary } = getRPCConfig()
    this.emergencyClient = createPublicClient({
      chain: base,
      transport: http(primary, {
        timeout: 15000, // 15s timeout for emergency
        retryCount: 3,
        retryDelay: 3000
      })
    })
    
    console.log('🔍 Consolidated SoapBox validation service initialized with triple-redundant RPC clients and caching')
  }

  /**
   * Get authorized addresses with comprehensive caching and fallback system
   */
  private async getAuthorizedAddresses(
    empireVaultAddress: string,
    walletAddress: string
  ): Promise<AuthorizedAddressesResult> {
    try {
      // Step 1: Try blockchain with primary client
      console.log(`🔍 Fetching authorized addresses from blockchain for vault: ${empireVaultAddress}`)
      
      const addresses = await this.publicClient.readContract({
        address: empireVaultAddress as Address,
        abi: this.EMPIRE_VAULT_ABI,
        functionName: 'getAuthorizedAddresses'
      })

      const addressList = (addresses as string[]).map(addr => addr.toLowerCase())
      
      // Cache the successful result
      const isAuthorized = addressList.includes(walletAddress.toLowerCase())
      authorizationCache.setAuthorization(empireVaultAddress, walletAddress, addressList, isAuthorized)
      
      console.log(`✅ Got ${addressList.length} authorized addresses from blockchain (primary)`)
      return { addresses: addressList, source: 'blockchain' }

    } catch (primaryError) {
      console.log(`❌ Primary client failed, trying fallback:`, primaryError)
      
      try {
        // Step 2: Try fallback client
        console.log('🔄 Using fallback RPC client for authorization check')
        
        const fallbackAddresses = await this.fallbackClient.readContract({
          address: empireVaultAddress as Address,
          abi: this.EMPIRE_VAULT_ABI,
          functionName: 'getAuthorizedAddresses'
        })

        const fallbackAddressList = (fallbackAddresses as string[]).map(addr => addr.toLowerCase())
        
        // Cache the fallback result
        const isAuthorized = fallbackAddressList.includes(walletAddress.toLowerCase())
        authorizationCache.setAuthorization(empireVaultAddress, walletAddress, fallbackAddressList, isAuthorized)
        
        console.log(`✅ Got ${fallbackAddressList.length} authorized addresses from fallback client`)
        return { addresses: fallbackAddressList, source: 'fallback' }

      } catch (fallbackError) {
        console.log(`❌ Fallback client failed, trying emergency client:`, fallbackError)
        
        try {
          // Step 3: Try emergency client
          console.log('🚨 Using emergency RPC client for authorization check (last resort)')
          
          const emergencyAddresses = await this.emergencyClient.readContract({
            address: empireVaultAddress as Address,
            abi: this.EMPIRE_VAULT_ABI,
            functionName: 'getAuthorizedAddresses'
          })

          const emergencyAddressList = (emergencyAddresses as string[]).map(addr => addr.toLowerCase())
          
          // Cache the emergency result
          const isAuthorized = emergencyAddressList.includes(walletAddress.toLowerCase())
          authorizationCache.setAuthorization(empireVaultAddress, walletAddress, emergencyAddressList, isAuthorized)
          
          console.log(`✅ Got ${emergencyAddressList.length} authorized addresses from emergency client`)
          return { addresses: emergencyAddressList, source: 'emergency' }

        } catch (emergencyError) {
          console.log(`❌ Emergency client failed, checking cache fallback:`, emergencyError)
          
          // Step 4: Final fallback to cache
          const cachedAuth = authorizationCache.getAuthorization(empireVaultAddress, walletAddress)
          if (cachedAuth) {
            console.log(`💾 Using cached authorized addresses (${cachedAuth.authorizedAddresses.length} addresses)`)
            return { addresses: cachedAuth.authorizedAddresses, source: 'cache' }
          }

          console.log(`❌ No cache fallback available for ${empireVaultAddress}`)
          throw new Error(`All authorization methods failed. Primary: ${primaryError instanceof Error ? primaryError.message : 'Unknown error'}, Fallback: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}, Emergency: ${emergencyError instanceof Error ? emergencyError.message : 'Unknown error'}`)
        }
      }
    }
  }

  /**
   * Check if wallet is authorized with comprehensive fallback handling
   */
  async checkAuthorization(
    empireVaultAddress: string,
    walletAddress: string
  ): Promise<{ isAuthorized: boolean; authorizedAddresses: string[]; source: string; error?: string }> {
    try {
      const result = await this.getAuthorizedAddresses(empireVaultAddress, walletAddress)
      const isAuthorized = result.addresses.includes(walletAddress.toLowerCase())
      
      console.log(`🔍 Authorization check for ${walletAddress}: ${isAuthorized ? 'AUTHORIZED' : 'NOT AUTHORIZED'} (source: ${result.source})`)
      
      return {
        isAuthorized,
        authorizedAddresses: result.addresses,
        source: result.source
      }
    } catch (error) {
      console.error('❌ Authorization check failed:', error)
      return {
        isAuthorized: false,
        authorizedAddresses: [],
        source: 'error',
        error: error instanceof Error ? error.message : 'Authorization check failed'
      }
    }
  }

  /**
   * Check setupper authorization for splits factory
   */
  async checkSetupperAuthorization(
    empireVaultAddress: string,
    setupperAddress: string
  ): Promise<{ isAuthorized: boolean; authorizedAddresses: string[]; source: string; error?: string }> {
    console.log(`🏭 Checking setupper authorization: ${setupperAddress} for vault: ${empireVaultAddress}`)
    
    try {
      // Try the splits factory specific check first
      const isAuthorized = await checkSetupperAuthorization(
        empireVaultAddress as Address,
        setupperAddress as Address
      )
      
      if (isAuthorized) {
        return {
          isAuthorized: true,
          authorizedAddresses: [setupperAddress.toLowerCase()],
          source: 'blockchain'
        }
      }
    } catch (setupperError) {
      console.warn('⚠️ Splits factory setupper check failed, falling back to vault authorization:', setupperError)
    }
    
    // Fallback to regular vault authorization check
    return this.checkAuthorization(empireVaultAddress, setupperAddress)
  }

  /**
   * Get token balance with comprehensive error handling (metadata resolved separately)
   */
  async getTokenBalance(
    tokenAddress: string,
    walletAddress: string
  ): Promise<{ balance: string; decimals: number; hasEnoughTokens: boolean; error?: string }> {
    try {
      console.log(`💰 Checking token balance for ${walletAddress} on token ${tokenAddress}`)
      
      let balance: bigint
      let decimals: number
      
      try {
        // Try primary client first
        const primaryResults = await Promise.all([
          this.publicClient.readContract({
            address: tokenAddress as Address,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [walletAddress as Address]
          }),
          this.publicClient.readContract({
            address: tokenAddress as Address,
            abi: erc20Abi,
            functionName: 'decimals'
          })
        ])
        
        balance = primaryResults[0] as bigint
        decimals = primaryResults[1] as number
        
      } catch (primaryError) {
        console.warn('⚠️ Primary client token balance check failed, trying fallback:', primaryError)
        
        try {
          // Try fallback client
          const fallbackResults = await Promise.all([
            this.fallbackClient.readContract({
              address: tokenAddress as Address,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [walletAddress as Address]
            }),
            this.fallbackClient.readContract({
              address: tokenAddress as Address,
              abi: erc20Abi,
              functionName: 'decimals'
            })
          ])
          
          balance = fallbackResults[0] as bigint
          decimals = fallbackResults[1] as number
          
        } catch (fallbackError) {
          console.warn('⚠️ Fallback client token balance check failed, trying emergency:', fallbackError)
          
          // Try emergency client as last resort
          const emergencyResults = await Promise.all([
            this.emergencyClient.readContract({
              address: tokenAddress as Address,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [walletAddress as Address]
            }),
            this.emergencyClient.readContract({
              address: tokenAddress as Address,
              abi: erc20Abi,
              functionName: 'decimals'
            })
          ])
          
          balance = emergencyResults[0] as bigint
          decimals = emergencyResults[1] as number
        }
      }

      const balanceString = formatUnits(balance, decimals)
      const hasEnoughTokens = balance >= BigInt('0') // Minimum requirement (can be adjusted)

      console.log(`💰 Token balance: ${balanceString} (sufficient: ${hasEnoughTokens})`)
      
      return {
        balance: balanceString,
        decimals,
        hasEnoughTokens
      }
    } catch (error) {
      console.error('❌ Token balance check failed:', error)
      return {
        balance: '0',
        decimals: 18,
        hasEnoughTokens: true, // Allow creation even if balance check fails
        error: error instanceof Error ? error.message : 'Token balance check failed'
      }
    }
  }

  /**
   * Resolve comprehensive token metadata with fallback strategies
   */
  async resolveTokenMetadata(
    empireVaultAddress: string,
    baseTokenAddress?: string
  ): Promise<ResolvedTokenInfo> {
    try {
      console.log('🔍 Starting comprehensive token metadata resolution for vault:', empireVaultAddress)
      
      // Use the comprehensive token resolver with multiple fallback strategies
      const tokenMetadata = await tokenInfoResolver.resolveTokenInfo({
        vaultAddress: empireVaultAddress,
        tokenAddress: baseTokenAddress,
        fallbackPrefix: 'VAULT'
      })
      
      console.log('✅ Token metadata resolved:', tokenMetadata)
      return tokenMetadata
      
    } catch (error) {
      console.error('❌ Token metadata resolution failed:', error)
      
      // Final fallback - create structured error response
      const shortAddress = empireVaultAddress.slice(-6)
      return {
        symbol: `ERROR_${shortAddress}`,
        name: `Resolution Failed (${shortAddress})`,
        logoURI: undefined,
        verified: false,
        source: 'error',
        error: error instanceof Error ? error.message : 'Token metadata resolution failed'
      }
    }
  }

  /**
   * Comprehensive SoapBox validation with all fallback strategies
   * Combines the best features from both original validation services
   */
  public async validateSoapBoxCreation(
    empireVaultAddress: string,
    userAddress: string,
    minimumTokenBalance: string = '0',
    setupperAddress?: string
  ): Promise<SoapBoxValidationResult> {
    try {
      console.log('🔍 Starting consolidated SoapBox validation:', {
        empireVaultAddress,
        userAddress,
        minimumTokenBalance,
        setupperAddress
      })

      // Step 1: Get base token address and resolve comprehensive token metadata
      let baseTokenAddress: string
      let tokenMetadata: ResolvedTokenInfo
      
      try {
        // First try to get base token address from vault
        console.log('🏛️ Fetching base token from Empire Vault:', empireVaultAddress)
        const tokenInfo = await getTokenInfoFromVault(empireVaultAddress)
        baseTokenAddress = tokenInfo.address
        console.log('✅ Base token address resolved:', baseTokenAddress)
        
      } catch (vaultError) {
        console.warn('⚠️ Failed to get base token from vault, will resolve metadata anyway:', vaultError)
        baseTokenAddress = ''
      }
      
      // Resolve comprehensive token metadata using our advanced resolver
      tokenMetadata = await this.resolveTokenMetadata(empireVaultAddress, baseTokenAddress)
      
      console.log('🎯 Token metadata resolution complete:', {
        symbol: tokenMetadata.symbol,
        name: tokenMetadata.name,
        source: tokenMetadata.source,
        verified: tokenMetadata.verified
      })
      
      // If we couldn't get base token address, this is likely an invalid vault
      if (!baseTokenAddress) {
        return {
          isValid: false,
          isAuthorized: false,
          hasTokenBalance: false,
          tokenBalance: '0',
          tokenSymbol: tokenMetadata.symbol,
          tokenName: tokenMetadata.name,
          tokenLogoURI: tokenMetadata.logoURI,
          tokenVerified: tokenMetadata.verified,
          tokenMetadataSource: tokenMetadata.source,
          authorizedAddresses: [],
          isSetupperAuthorized: false,
          error: 'Invalid Empire vault address or unable to fetch base token address',
          source: 'error',
          details: {
            empireVaultAddress,
            baseTokenAddress: '',
            userAddress,
            minimumTokenBalance,
            actualTokenBalance: '0',
            authorizedAddresses: [],
            isSetupperAuthorized: false,
            tokenMetadata
          }
        }
      }

      // Step 2: Check wallet authorization with comprehensive fallback system
      console.log('🔐 Checking wallet authorization with enhanced fallback system...')
      const authCheck = await this.checkAuthorization(empireVaultAddress, userAddress)
      
      if (authCheck.error && !authCheck.isAuthorized) {
        return {
          isValid: false,
          isAuthorized: false,
          hasTokenBalance: false,
          tokenBalance: '0',
          tokenSymbol: tokenMetadata.symbol,
          tokenName: tokenMetadata.name,
          tokenLogoURI: tokenMetadata.logoURI,
          tokenVerified: tokenMetadata.verified,
          tokenMetadataSource: tokenMetadata.source,
          authorizedAddresses: authCheck.authorizedAddresses,
          isSetupperAuthorized: false,
          error: `Authorization check failed: ${authCheck.error}`,
          source: authCheck.source as any,
          details: {
            empireVaultAddress,
            baseTokenAddress,
            userAddress,
            minimumTokenBalance,
            actualTokenBalance: '0',
            authorizedAddresses: authCheck.authorizedAddresses,
            isSetupperAuthorized: false,
            tokenMetadata
          }
        }
      }

      // Step 3: Check setupper authorization if different from user
      console.log('🏭 Checking setupper authorization...')
      let isSetupperAuthorized = true // Default to true if same as user
      let setupperAuthAddresses: string[] = []
      
      const actualSetupperAddress = setupperAddress || userAddress
      if (actualSetupperAddress !== userAddress) {
        const setupperCheck = await this.checkSetupperAuthorization(empireVaultAddress, actualSetupperAddress)
        isSetupperAuthorized = setupperCheck.isAuthorized
        setupperAuthAddresses = setupperCheck.authorizedAddresses
      } else {
        isSetupperAuthorized = authCheck.isAuthorized
        setupperAuthAddresses = authCheck.authorizedAddresses
      }

      // Step 4: Check token balance with comprehensive fallback
      console.log('💰 Checking token balance with enhanced reliability...')
      const tokenBalanceInfo = await this.getTokenBalance(baseTokenAddress, userAddress)
      
      // Check if balance meets minimum requirement
      const minBalance = parseFloat(minimumTokenBalance)
      const actualBalance = parseFloat(tokenBalanceInfo.balance)
      const hasTokenBalance = actualBalance >= minBalance && tokenBalanceInfo.hasEnoughTokens

      console.log('💰 Token balance check:', {
        tokenSymbol: tokenMetadata.symbol,
        tokenName: tokenMetadata.name,
        actualBalance: tokenBalanceInfo.balance,
        minimumRequired: minimumTokenBalance,
        hasEnoughTokens: hasTokenBalance
      })

      // Final validation result
      const isValid = authCheck.isAuthorized && hasTokenBalance
      
      console.log('✅ Consolidated SoapBox validation complete:', {
        isValid,
        isAuthorized: authCheck.isAuthorized,
        hasTokenBalance,
        tokenBalance: tokenBalanceInfo.balance,
        isSetupperAuthorized,
        source: authCheck.source
      })

      return {
        isValid,
        isAuthorized: authCheck.isAuthorized,
        hasTokenBalance,
        tokenBalance: tokenBalanceInfo.balance,
        tokenSymbol: tokenMetadata.symbol,
        tokenName: tokenMetadata.name,
        tokenLogoURI: tokenMetadata.logoURI,
        tokenVerified: tokenMetadata.verified,
        tokenMetadataSource: tokenMetadata.source,
        authorizedAddresses: authCheck.authorizedAddresses,
        isSetupperAuthorized,
        source: authCheck.source as any,
        details: {
          empireVaultAddress,
          baseTokenAddress,
          userAddress,
          minimumTokenBalance,
          actualTokenBalance: tokenBalanceInfo.balance,
          authorizedAddresses: authCheck.authorizedAddresses,
          isSetupperAuthorized,
          tokenMetadata
        }
      }

    } catch (error) {
      console.error('❌ Consolidated SoapBox validation failed:', error)
      
      // Even in error case, try to resolve some token metadata
      let errorTokenMetadata: ResolvedTokenInfo
      try {
        errorTokenMetadata = await this.resolveTokenMetadata(empireVaultAddress)
      } catch {
        const shortAddress = empireVaultAddress.slice(-6)
        errorTokenMetadata = {
          symbol: `ERROR_${shortAddress}`,
          name: `Validation Error (${shortAddress})`,
          logoURI: undefined,
          verified: false,
          source: 'error',
          error: 'Complete validation failure'
        }
      }
      
      return {
        isValid: false,
        isAuthorized: false,
        hasTokenBalance: false,
        tokenBalance: '0',
        tokenSymbol: errorTokenMetadata.symbol,
        tokenName: errorTokenMetadata.name,
        tokenLogoURI: errorTokenMetadata.logoURI,
        tokenVerified: errorTokenMetadata.verified,
        tokenMetadataSource: errorTokenMetadata.source,
        authorizedAddresses: [],
        isSetupperAuthorized: false,
        error: error instanceof Error ? error.message : 'Unknown validation error',
        source: 'error',
        details: {
          empireVaultAddress,
          baseTokenAddress: '',
          userAddress,
          minimumTokenBalance,
          actualTokenBalance: '0',
          authorizedAddresses: [],
          isSetupperAuthorized: false,
          tokenMetadata: errorTokenMetadata
        }
      }
    }
  }

  /**
   * Quick authorization-only check for existing SoapBoxes
   */
  public async checkSoapBoxAccess(
    empireVaultAddress: string,
    userAddress: string
  ): Promise<{ hasAccess: boolean; error?: string; source?: string }> {
    try {
      const authCheck = await this.checkAuthorization(empireVaultAddress, userAddress)
      return {
        hasAccess: authCheck.isAuthorized,
        error: authCheck.error,
        source: authCheck.source
      }
    } catch (error) {
      return {
        hasAccess: false,
        error: error instanceof Error ? error.message : 'Access check failed',
        source: 'error'
      }
    }
  }

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return authorizationCache.getStats()
  }

  /**
   * Clear cache (for testing/debugging)
   */
  clearCache() {
    authorizationCache.clear()
  }
}

// Singleton instance
export const consolidatedSoapboxValidation = new ConsolidatedSoapboxValidation()

// Export backward-compatible interfaces for migration
export const soapBoxValidationService = consolidatedSoapboxValidation
export const enhancedSoapboxValidation = consolidatedSoapboxValidation