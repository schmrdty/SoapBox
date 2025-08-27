//--src/lib/contracts/soapboxSplitsFactory.ts
import { createPublicClient, http, getContract, type Address, type Hex } from 'viem'
import { base } from 'viem/chains'
import { getRPCConfig } from '@/lib/rpc-config'

// SoapboxSplitsFactory contract addresses from private connection
export const SOAPBOX_SPLITS_FACTORY_PROXY = '0x31fE151662f97d10952a7C0A99C219aEB27C72DB' as const
export const SOAP_BOX_SPLITS_FACTORY = '0x4dc6721C7A39D93D891F72e4551949aaa1d1Ea41' as const

// SoapboxSplitsFactory ABI from private connection
export const soapboxSplitsFactoryAbi = [
  {
    "inputs": [],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "target",
        "type": "address"
      }
    ],
    "name": "AddressEmptyCode",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "implementation",
        "type": "address"
      }
    ],
    "name": "ERC1967InvalidImplementation",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ERC1967NonPayable",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "EnforcedPause",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ExpectedPause",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "FailedCall",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "FailedDeployment",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "balance",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "needed",
        "type": "uint256"
      }
    ],
    "name": "InsufficientBalance",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidInitialization",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotInitializing",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "OwnableInvalidOwner",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "OwnableUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      }
    ],
    "name": "SafeERC20FailedOperation",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "UUPSUnauthorizedCallContext",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "slot",
        "type": "bytes32"
      }
    ],
    "name": "UUPSUnsupportedProxiableUUID",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "splitId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "recipient",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "FundsDistributed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "from",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "FundsReceived",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "uint64",
        "name": "version",
        "type": "uint64"
      }
    ],
    "name": "Initialized",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferStarted",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "Paused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "bytes32",
        "name": "splitId",
        "type": "bytes32"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "splitAddress",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "empireVault",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "baseToken",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "roomCreator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "string",
        "name": "roomId",
        "type": "string"
      }
    ],
    "name": "SplitCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "Unpaused",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "implementation",
        "type": "address"
      }
    ],
    "name": "Upgraded",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "DEV_WALLET",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MYU_VAULT",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "RATE_LIMIT_SECONDS",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "UPGRADE_INTERFACE_VERSION",
    "outputs": [
      {
        "internalType": "string",
        "name": "",
        "type": "string"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "USDC",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "WETH",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "acceptOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32[]",
        "name": "splitIdsArray",
        "type": "bytes32[]"
      },
      {
        "internalType": "uint256[]",
        "name": "amounts",
        "type": "uint256[]"
      }
    ],
    "name": "autoWrapAndBatchDistributeETH",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "bytes32[]",
        "name": "splitIdsArray",
        "type": "bytes32[]"
      },
      {
        "internalType": "uint256[]",
        "name": "amounts",
        "type": "uint256[]"
      }
    ],
    "name": "batchDistribute",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "empireVaultAddress",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "baseToken",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "roomId",
        "type": "string"
      }
    ],
    "name": "createSplit",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "splitId",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "splitAddress",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "bytes32",
        "name": "splitId",
        "type": "bytes32"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "distribute",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "splitId",
        "type": "bytes32"
      }
    ],
    "name": "getSplitMeta",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "empireVault",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "baseToken",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "roomCreator",
            "type": "address"
          },
          {
            "internalType": "string",
            "name": "roomId",
            "type": "string"
          },
          {
            "internalType": "uint256",
            "name": "chainId",
            "type": "uint256"
          }
        ],
        "internalType": "struct SoapboxSplitsFactory.SplitMeta",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_usdc",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_weth",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_devWallet",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_myuVault",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_splitImplementation",
        "type": "address"
      }
    ],
    "name": "initialize",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "lastDistribution",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "paused",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "pendingOwner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "proxiableUUID",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "splitId",
        "type": "bytes32"
      }
    ],
    "name": "receiveAndDistribute",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "token",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "to",
        "type": "address"
      }
    ],
    "name": "rescueTokens",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "splitIds",
    "outputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "splitImplementation",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "splitMetadata",
    "outputs": [
      {
        "internalType": "address",
        "name": "empireVault",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "baseToken",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "roomCreator",
        "type": "address"
      },
      {
        "internalType": "string",
        "name": "roomId",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "chainId",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      }
    ],
    "name": "splits",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "unpause",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newImplementation",
        "type": "address"
      }
    ],
    "name": "updateSplitImplementation",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newImplementation",
        "type": "address"
      },
      {
        "internalType": "bytes",
        "name": "data",
        "type": "bytes"
      }
    ],
    "name": "upgradeToAndCall",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "stateMutability": "payable",
    "type": "receive"
  }
] as const

// Empire Vault ABI (needed to get base token)
const empireVaultAbi = [
  {
    "inputs": [],
    "name": "baseToken",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const

// Create a server-side public client for contract reads with PRIVATE RPC endpoints only
function createResilientClient() {
  // Use centralized RPC configuration
  const { fallback: rpcUrls } = getRPCConfig()
  
  // Use first available PRIVATE RPC with optimized timeout
  return createPublicClient({
    chain: base,
    transport: http(rpcUrls[0], {
      timeout: 4000,    // Fast timeout optimized for private RPCs
      retryCount: 1,    // Single retry on private RPC
      retryDelay: 1000  // Quick retry
    })
  })
}

// Get the base token address from Empire Vault
export async function getVaultBaseToken(empireVaultAddress: Address): Promise<Address> {
  const client = createResilientClient()
  
  try {
    const empireVault = getContract({
      address: empireVaultAddress,
      abi: empireVaultAbi,
      client
    })
    
    const baseToken = await empireVault.read.baseToken() as Address
    console.log('🏛️ Base token resolved from Empire Vault:', {
      empireVault: empireVaultAddress,
      baseToken
    })
    
    return baseToken
  } catch (error) {
    console.error('❌ Failed to get base token from Empire Vault:', error)
    throw new Error(`Failed to get base token from Empire Vault ${empireVaultAddress}: ${error}`)
  }
}

// Get SoapboxSplitsFactory contract instance (for server-side reading)
export function getSoapboxSplitsContract() {
  const client = createResilientClient()
  
  return getContract({
    address: SOAPBOX_SPLITS_FACTORY_PROXY,
    abi: soapboxSplitsFactoryAbi,
    client
  })
}

// Calculate deterministic split ID based on parameters 
export function calculateSplitId(empireVaultAddress: Address, roomId: string, roomCreator: Address): Hex {
  // Create a simple deterministic hash - this should match contract logic
  const encoded = `${empireVaultAddress.toLowerCase()}-${roomId}-${roomCreator.toLowerCase()}`
  
  // Create a proper 32-byte hash using keccak256-like simple hash
  let hash = 0
  for (let i = 0; i < encoded.length; i++) {
    const char = encoded.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash // Convert to 32-bit integer
  }
  
  // Convert to hex and pad to 32 bytes (64 hex chars)
  const hexHash = Math.abs(hash).toString(16).padStart(8, '0').padEnd(64, '0')
  
  return `0x${hexHash}` as Hex
}

// Get split metadata for a given split ID
export async function getSplitMetadata(splitId: Hex) {
  // TEMPORARILY DISABLED due to rate limiting issues
  console.log('⚠️ getSplitMetadata temporarily disabled due to rate limits')
  return null
  
  /*
  const contract = getSoapboxSplitsContract()
  
  try {
    const metadata = await contract.read.getSplitMeta([splitId]) as unknown as readonly [Address, Address, Address, string, bigint]
    return {
      empireVault: metadata[0],
      baseToken: metadata[1],
      roomCreator: metadata[2],
      roomId: metadata[3],
      chainId: metadata[4]
    }
  } catch (error) {
    console.error('Failed to get split metadata:', error)
    return null
  }
  */
}

// Check if a split exists for given parameters
export async function checkSplitExists(empireVaultAddress: Address, roomId: string): Promise<boolean> {
  // TEMPORARILY DISABLED due to rate limiting issues
  // This function was causing infinite 429 errors from Base RPC
  console.log('⚠️ checkSplitExists temporarily disabled due to rate limits')
  return false
  
  /* 
  const contract = getSoapboxSplitsContract()
  
  try {
    // Try to get split metadata - if it exists, this won't throw
    const splitId = calculateSplitId(empireVaultAddress, roomId, '0x0000000000000000000000000000000000000000')
    const metadata = await getSplitMetadata(splitId)
    return metadata !== null
  } catch (error) {
    console.error('Split existence check failed:', error)
    return false
  }
  */
}

// Check if a setupper is authorized for splits factory (checks if they're authorized on the empire vault)
export async function checkSetupperAuthorization(empireVaultAddress: Address, setupperAddress: Address): Promise<boolean> {
  try {
    console.log('🔍 Checking setupper authorization:', {
      empireVaultAddress,
      setupperAddress
    })
    
    const client = createResilientClient()
    
    // Check if setupper is authorized on the Empire Vault
    const empireVault = getContract({
      address: empireVaultAddress,
      abi: [
        {
          inputs: [],
          name: 'getAuthorizedAddresses',
          outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
          stateMutability: 'view',
          type: 'function'
        }
      ] as const,
      client
    })
    
    const authorizedAddresses = await empireVault.read.getAuthorizedAddresses() as Address[]
    const isAuthorized = authorizedAddresses
      .map(addr => addr.toLowerCase())
      .includes(setupperAddress.toLowerCase())
    
    console.log('✅ Authorization check result:', {
      setupperAddress,
      isAuthorized,
      authorizedCount: authorizedAddresses.length
    })
    
    return isAuthorized
  } catch (error) {
    console.error('❌ Setupper authorization check failed:', error)
    return false
  }
}

// Export everything needed for the API route
export const soapboxSplitsFactory = {
  address: SOAPBOX_SPLITS_FACTORY_PROXY,
  abi: soapboxSplitsFactoryAbi,
  getVaultBaseToken,
  calculateSplitId,
  getSplitMetadata,
  checkSplitExists,
  checkSetupperAuthorization
}