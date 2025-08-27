//--src/lib/services/soapboxValidation.ts
import { createResilientPublicClient, createFallbackPublicClient, getRPCConfig } from '@/lib/rpc-config'
import { checkWalletAuthorization, getTokenInfoFromVault, tokenUtils } from '@/lib/tokenUtils'
import { checkSetupperAuthorization } from '@/lib/contracts/soapboxSplitsFactory'
import { createPublicClient, erc20Abi, formatUnits, http } from 'viem'
import { base } from 'viem/chains'
import type { Address } from 'viem'

export interface SoapBoxValidationResult {
  isValid: boolean
  isAuthorized: boolean
  hasTokenBalance: boolean
  tokenBalance: string
  tokenSymbol: string
  error?: string
  details: {
    empireVaultAddress: string
    baseTokenAddress: string
    userAddress: string
    minimumTokenBalance: string
    actualTokenBalance: string
    authorizedAddresses: string[]
    isSetupperAuthorized: boolean
  }
}

export class SoapBoxValidationService {
  private publicClient: ReturnType<typeof createResilientPublicClient>
  private fallbackClient: ReturnType<typeof createFallbackPublicClient>
  private emergencyClient: any

  constructor() {
    this.publicClient = createResilientPublicClient()
    this.fallbackClient = createFallbackPublicClient()
    
    // Create emergency client with private RPC endpoint for critical failures  
    const { primary } = getRPCConfig()
    this.emergencyClient = createPublicClient({
      chain: base,
      // Use centralized RPC configuration with private endpoints
      transport: http(primary, {
        timeout: 15000, // 15s timeout for emergency (reduced from 30s)
        retryCount: 3,  // Reduced retries
        retryDelay: 3000 // Reduced delay
      })
    })
    
    console.log('🔍 Enhanced SoapBox validation service initialized with triple-redundant RPC clients')
  }

  /**
   * Comprehensive validation for SoapBox creation
   * Checks:
   * 1. Empire vault validity
   * 2. User wallet authorization via getAuthorizedAddresses  
   * 3. User token balance of baseToken
   * 4. Setupper authorization for splits factory
   */
  public async validateSoapBoxCreation(
    empireVaultAddress: string,
    userAddress: string,
    minimumTokenBalance: string = '0'
  ): Promise<SoapBoxValidationResult> {
    try {
      console.log('🔍 Starting SoapBox validation:', {
        empireVaultAddress,
        userAddress,
        minimumTokenBalance
      })

      // Step 1: Validate Empire Vault and get base token
      const tokenInfo = await getTokenInfoFromVault(empireVaultAddress)
      if (!tokenInfo || !tokenInfo.address) {
        return {
          isValid: false,
          isAuthorized: false,
          hasTokenBalance: false,
          tokenBalance: '0',
          tokenSymbol: 'UNKNOWN',
          error: 'Invalid Empire vault address or unable to fetch token info',
          details: {
            empireVaultAddress,
            baseTokenAddress: '',
            userAddress,
            minimumTokenBalance,
            actualTokenBalance: '0',
            authorizedAddresses: [],
            isSetupperAuthorized: false
          }
        }
      }

      const baseTokenAddress = tokenInfo.address

      // Step 2: Enhanced wallet authorization check with triple fallback
      console.log('🔐 Checking wallet authorization with enhanced triple-redundant validation...')
      let authCheck = await checkWalletAuthorization(empireVaultAddress, userAddress)
      
      // If authorization check failed, try with fallback client
      if (authCheck.error && !authCheck.isAuthorized) {
        console.warn('⚠️ Primary authorization check failed, trying fallback client:', authCheck.error)
        try {
          // Try authorization with fallback client
          const fallbackAuthCheck = await this.checkAuthorizationWithFallback(empireVaultAddress, userAddress)
          if (fallbackAuthCheck.isAuthorized) {
            authCheck = fallbackAuthCheck
            console.log('✅ Fallback authorization check succeeded')
          } else {
            // Try emergency client as last resort
            console.warn('⚠️ Fallback also failed, trying emergency client')
            const emergencyAuthCheck = await this.checkAuthorizationWithEmergency(empireVaultAddress, userAddress)
            if (emergencyAuthCheck.isAuthorized) {
              authCheck = emergencyAuthCheck
              console.log('✅ Emergency authorization check succeeded')
            }
          }
        } catch (fallbackError) {
          console.error('❌ All authorization methods failed:', fallbackError)
        }
      }
      
      if (authCheck.error && !authCheck.isAuthorized) {
        return {
          isValid: false,
          isAuthorized: false,
          hasTokenBalance: false,
          tokenBalance: '0',
          tokenSymbol: tokenInfo.symbol,
          error: `Authorization check failed: ${authCheck.error}`,
          details: {
            empireVaultAddress,
            baseTokenAddress,
            userAddress,
            minimumTokenBalance,
            actualTokenBalance: '0',
            authorizedAddresses: authCheck.authorizedAddresses || [],
            isSetupperAuthorized: false
          }
        }
      }

      // Step 3: Check setupper authorization for splits factory
      console.log('🏭 Checking setupper authorization for splits factory...')
      let isSetupperAuthorized = false
      try {
        isSetupperAuthorized = await checkSetupperAuthorization(
          empireVaultAddress as Address,
          userAddress as Address
        )
      } catch (setupperError) {
        console.warn('⚠️ Setupper authorization check failed:', setupperError)
        // Continue validation - splits factory auth is not critical for basic validation
      }

      // Step 4: Check token balance with fallback handling
      console.log('💰 Checking token balance with enhanced reliability...')
      let tokenBalance = '0'
      let hasTokenBalance = false

      try {
        let balance: bigint
        let decimals: number
        
        try {
          // Try primary client first
          const primaryResults = await Promise.all([
            this.publicClient.readContract({
              address: baseTokenAddress as Address,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [userAddress as Address]
            }),
            this.publicClient.readContract({
              address: baseTokenAddress as Address,
              abi: erc20Abi,
              functionName: 'decimals'
            })
          ])
          balance = primaryResults[0] as bigint
          decimals = primaryResults[1] as number
        } catch (primaryError) {
          console.warn('⚠️ Primary client token balance check failed, trying fallback:', primaryError)
          // Try fallback client
          const fallbackResults = await Promise.all([
            this.fallbackClient.readContract({
              address: baseTokenAddress as Address,
              abi: erc20Abi,
              functionName: 'balanceOf',
              args: [userAddress as Address]
            }),
            this.fallbackClient.readContract({
              address: baseTokenAddress as Address,
              abi: erc20Abi,
              functionName: 'decimals'
            })
          ])
          balance = fallbackResults[0] as bigint
          decimals = fallbackResults[1] as number
        }

        tokenBalance = formatUnits(balance as bigint, decimals as number)
        
        // Check if balance meets minimum requirement
        const minBalance = parseFloat(minimumTokenBalance)
        const actualBalance = parseFloat(tokenBalance)
        hasTokenBalance = actualBalance >= minBalance

        console.log('💰 Token balance check:', {
          tokenSymbol: tokenInfo.symbol,
          actualBalance: tokenBalance,
          minimumRequired: minimumTokenBalance,
          hasEnoughTokens: hasTokenBalance
        })

      } catch (balanceError) {
        console.error('❌ Failed to check token balance:', balanceError)
        return {
          isValid: false,
          isAuthorized: authCheck.isAuthorized,
          hasTokenBalance: false,
          tokenBalance: '0',
          tokenSymbol: tokenInfo.symbol,
          error: 'Failed to check token balance - may not be a valid ERC20 token',
          details: {
            empireVaultAddress,
            baseTokenAddress,
            userAddress,
            minimumTokenBalance,
            actualTokenBalance: '0',
            authorizedAddresses: authCheck.authorizedAddresses || [],
            isSetupperAuthorized
          }
        }
      }

      // Final validation result
      const isValid = authCheck.isAuthorized && hasTokenBalance
      
      console.log('✅ SoapBox validation complete:', {
        isValid,
        isAuthorized: authCheck.isAuthorized,
        hasTokenBalance,
        tokenBalance,
        isSetupperAuthorized
      })

      return {
        isValid,
        isAuthorized: authCheck.isAuthorized,
        hasTokenBalance,
        tokenBalance,
        tokenSymbol: tokenInfo.symbol,
        details: {
          empireVaultAddress,
          baseTokenAddress,
          userAddress,
          minimumTokenBalance,
          actualTokenBalance: tokenBalance,
          authorizedAddresses: authCheck.authorizedAddresses || [],
          isSetupperAuthorized
        }
      }

    } catch (error) {
      console.error('❌ SoapBox validation failed:', error)
      return {
        isValid: false,
        isAuthorized: false,
        hasTokenBalance: false,
        tokenBalance: '0',
        tokenSymbol: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown validation error',
        details: {
          empireVaultAddress,
          baseTokenAddress: '',
          userAddress,
          minimumTokenBalance,
          actualTokenBalance: '0',
          authorizedAddresses: [],
          isSetupperAuthorized: false
        }
      }
    }
  }

  /**
   * Fallback authorization check using different RPC client
   */
  private async checkAuthorizationWithFallback(
    empireVaultAddress: string,
    userAddress: string
  ): Promise<{ isAuthorized: boolean; authorizedAddresses: string[]; error?: string }> {
    try {
      console.log('🔄 Using fallback RPC client for authorization check')
      
      // Empire Vault ABI for getAuthorizedAddresses
      const EMPIRE_VAULT_ABI = [
        {
          inputs: [],
          name: 'getAuthorizedAddresses',
          outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
          stateMutability: 'view',
          type: 'function'
        }
      ] as const

      // Get authorized addresses using fallback client
      const authorizedAddresses = await this.fallbackClient.readContract({
        address: empireVaultAddress as Address,
        abi: EMPIRE_VAULT_ABI,
        functionName: 'getAuthorizedAddresses'
      }) as string[]

      // Check if wallet address is in the authorized list (case-insensitive)
      const isAuthorized = authorizedAddresses
        .map(addr => addr.toLowerCase())
        .includes(userAddress.toLowerCase())

      console.log('🔍 Fallback authorization result:', {
        walletAddress: userAddress,
        isAuthorized,
        authorizedAddresses: authorizedAddresses.length,
        addresses: authorizedAddresses
      })

      return {
        isAuthorized,
        authorizedAddresses
      }

    } catch (error) {
      console.error('❌ Fallback authorization check failed:', error)
      return {
        isAuthorized: false,
        authorizedAddresses: [],
        error: error instanceof Error ? error.message : 'Fallback authorization failed'
      }
    }
  }

  /**
   * Emergency authorization check using direct Base RPC endpoint as last resort
   */
  private async checkAuthorizationWithEmergency(
    empireVaultAddress: string,
    userAddress: string
  ): Promise<{ isAuthorized: boolean; authorizedAddresses: string[]; error?: string }> {
    try {
      console.log('🚨 Using emergency RPC client for authorization check (last resort)')
      
      // Empire Vault ABI for getAuthorizedAddresses
      const EMPIRE_VAULT_ABI = [
        {
          inputs: [],
          name: 'getAuthorizedAddresses',
          outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
          stateMutability: 'view',
          type: 'function'
        }
      ] as const

      // Get authorized addresses using emergency client
      const authorizedAddresses = await this.emergencyClient.readContract({
        address: empireVaultAddress as Address,
        abi: EMPIRE_VAULT_ABI,
        functionName: 'getAuthorizedAddresses'
      }) as string[]

      // Check if wallet address is in the authorized list (case-insensitive)
      const isAuthorized = authorizedAddresses
        .map(addr => addr.toLowerCase())
        .includes(userAddress.toLowerCase())

      console.log('🔍 Emergency authorization result:', {
        walletAddress: userAddress,
        isAuthorized,
        authorizedAddresses: authorizedAddresses.length,
        addresses: authorizedAddresses
      })

      return {
        isAuthorized,
        authorizedAddresses
      }

    } catch (error) {
      console.error('❌ Emergency authorization check failed:', error)
      return {
        isAuthorized: false,
        authorizedAddresses: [],
        error: error instanceof Error ? error.message : 'Emergency authorization failed'
      }
    }
  }

  /**
   * Quick authorization-only check for existing SoapBoxes
   */
  public async checkSoapBoxAccess(
    empireVaultAddress: string,
    userAddress: string
  ): Promise<{ hasAccess: boolean; error?: string }> {
    try {
      const authCheck = await checkWalletAuthorization(empireVaultAddress, userAddress)
      return {
        hasAccess: authCheck.isAuthorized,
        error: authCheck.error
      }
    } catch (error) {
      return {
        hasAccess: false,
        error: error instanceof Error ? error.message : 'Access check failed'
      }
    }
  }
}

export const soapBoxValidationService = new SoapBoxValidationService()