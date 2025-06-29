'use client';

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { ConnectionProvider, WalletProvider, useConnection, useWallet } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
  TorusWalletAdapter,
} from '@solana/wallet-adapter-wallets';
import {
  WalletModalProvider,
  WalletDisconnectButton,
  WalletMultiButton
} from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl, Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { Program, AnchorProvider, web3, utils, BN } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';


const PROGRAM_ID = new PublicKey('ZBRsgBJ3YzdRUi8UFquwxUhxd8VqpicaHKFa4hBHHGf');
const TOKEN_MINT_ADDRESS = new PublicKey('9A3BdDctisN5ezCKNNrL6FMdhdA2zT8RDzFxuASr5g89'); 

// IDL file 
import IDL from './idl/faucet.json';

function FaucetApp() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, sendTransaction } = useWallet();
  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [vaultBalance, setVaultBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getProgram = useCallback(() => {
    if (!publicKey || !signTransaction) return null;
    
    try {
      const provider = new AnchorProvider(
        connection,
        { publicKey, signTransaction, signAllTransactions: async (txs) => txs },
        { commitment: 'confirmed' }
      );
      
      // @ts-ignore
      const program = new Program(IDL, PROGRAM_ID, provider);
      return program;
    } catch (error) {
      console.error('Error creating program:', error);
      return null;
    }
  }, [connection, publicKey, signTransaction]);


  const getVaultPDA = useCallback(() => {
    try {
      const [pda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault')],
        PROGRAM_ID
      );
      console.log('Vault PDA:', pda.toString());
      return pda;
    } catch (error) {
      console.error('Error generating vault PDA:', error);
      throw error;
    }
  }, []);

  const getVaultAuthorityPDA = useCallback(() => {
    try {
      const [pda, bump] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault_authority')],
        PROGRAM_ID
      );
      console.log('Vault Authority PDA:', pda.toString());
      return pda;
    } catch (error) {
      console.error('Error generating vault authority PDA:', error);
      throw error;
    }
  }, []);

  // Get user token balance
  const getUserBalance = useCallback(async () => {
    if (!publicKey) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const userAta = await getAssociatedTokenAddress(
        TOKEN_MINT_ADDRESS,
        publicKey
      );
      
      console.log('User ATA:', userAta.toString());
      
      const accountInfo = await connection.getAccountInfo(userAta);
      
      if (!accountInfo) {
        setUserBalance(0);
        return;
      }
      
      const tokenAccount = await connection.getTokenAccountBalance(userAta);
      const balance = tokenAccount.value.uiAmount || 0;
      setUserBalance(balance);
    } catch (err: any) {
      console.error('Error getting user balance:', err);
      setUserBalance(0);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  // Get vault balance
  const getVaultBalance = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const vaultPDA = getVaultPDA();
      const tokenAccount = await connection.getTokenAccountBalance(vaultPDA);
      const balance = tokenAccount.value.uiAmount || 0;
      setVaultBalance(balance);
    } catch (err: any) {
      console.error('Error getting vault balance:', err);
      setError('Failed to get vault balance');
    } finally {
      setLoading(false);
    }
  }, [connection, getVaultPDA]);

  // Request tokens from faucet
  const requestTokens = useCallback(async () => {
    if (!publicKey) {
      setError('Wallet not connected');
      return;
    }
    
    const program = getProgram();
    if (!program) {
      setError('Failed to initialize program');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const vaultPDA = getVaultPDA();
      const vaultAuthorityPDA = getVaultAuthorityPDA();
      
      const userAta = await getAssociatedTokenAddress(
        TOKEN_MINT_ADDRESS,
        publicKey
      );
      
      // Debug logging
      console.log('Program methods:', Object.keys(program.methods));
      console.log('Vault PDA:', vaultPDA?.toString());
      console.log('Vault Authority PDA:', vaultAuthorityPDA?.toString());
      console.log('User Wallet:', publicKey?.toString());
      console.log('User ATA:', userAta?.toString());
      console.log('Token Mint:', TOKEN_MINT_ADDRESS?.toString());
      
      // Validate all accounts are defined
      if (!vaultPDA || !vaultAuthorityPDA || !publicKey || !userAta) {
        throw new Error('One or more required accounts are undefined');
      }
      
      console.log('Attempting to call airdropToUser...');
      
      if (!program.methods.airdropToUser) {
        throw new Error('airdropToUser method not found in program');
      }
      
      const accounts = {
  vault: vaultPDA,
  vault_authority: vaultAuthorityPDA,
  user_ata: userAta,                  
  user_wallet: publicKey,             
  payer: publicKey,
  mint: TOKEN_MINT_ADDRESS,
  token_program: TOKEN_PROGRAM_ID,
  associated_token_program: ASSOCIATED_TOKEN_PROGRAM_ID,
  system_program: SystemProgram.programId,
  rent: SYSVAR_RENT_PUBKEY,
};

      
      console.log('Accounts being passed:', accounts);
      
      // Validate each account
      Object.entries(accounts).forEach(([key, value]) => {
        if (!value) {
          throw new Error(`Account ${key} is undefined or null`);
        }
        console.log(`${key}:`, value.toString());
      });
      
      const tx = await program.methods.airdropToUser()
        .accounts(accounts)
        .transaction();
      
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');
      
      // Refresh balances
      await getUserBalance();
      await getVaultBalance();
      
      alert('Successfully received 10 tokens!');
    } catch (err: any) {
      console.error('Error requesting tokens:', err);
      setError(err.message || 'Failed to request tokens');
    } finally {
      setLoading(false);
    }
  }, [publicKey, getProgram, connection, sendTransaction, getUserBalance, getVaultBalance, getVaultPDA, getVaultAuthorityPDA]);

  // Auto-load balances when wallet connects
  useEffect(() => {
    if (publicKey) {
      getUserBalance();
      getVaultBalance();
    }
  }, [publicKey, getUserBalance, getVaultBalance]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4">
            🚰 Solana Token Faucet
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Connect your wallet and claim free tokens from our faucet. Get 10 tokens per request!
          </p>
        </div>

        {/* Wallet Connection */}
        <div className="flex justify-center mb-8">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
            {!publicKey ? (
              <div className="text-center">
                <p className="text-white mb-4">Connect your wallet to get started</p>
                <WalletMultiButton className="!bg-gradient-to-r !from-purple-500 !to-pink-500 hover:!from-purple-600 hover:!to-pink-600" />
              </div>
            ) : (
              <div className="text-center">
                <p className="text-green-400 mb-4">✅ Wallet Connected</p>
                <p className="text-gray-300 text-sm mb-4 break-all">
                  {publicKey.toString()}
                </p>
                <WalletDisconnectButton className="!bg-red-500 hover:!bg-red-600" />
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        {publicKey && (
          <div className="max-w-4xl mx-auto">
            {/* Error Display */}
            {error && (
              <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 mb-6">
                <p className="text-red-200">❌ {error}</p>
              </div>
            )}

            {/* Balance Cards */}
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              {/* User Balance Card */}
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <div className="text-center">
                  <h3 className="text-2xl font-semibold text-white mb-4">
                    💰 Your Balance
                  </h3>
                  <div className="text-4xl font-bold text-green-400 mb-4">
                    {userBalance !== null ? `${userBalance} TOKENS` : '--'}
                  </div>
                  <button
                    onClick={getUserBalance}
                    disabled={loading}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    {loading ? '⏳' : '🔄'} Refresh Balance
                  </button>
                </div>
              </div>

              {/* Vault Balance Card */}
              <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6 border border-white/20">
                <div className="text-center">
                  <h3 className="text-2xl font-semibold text-white mb-4">
                    🏦 Vault Balance
                  </h3>
                  <div className="text-4xl font-bold text-yellow-400 mb-4">
                    {vaultBalance !== null ? `${vaultBalance} TOKENS` : '--'}
                  </div>
                  <button
                    onClick={getVaultBalance}
                    disabled={loading}
                    className="bg-yellow-500 hover:bg-yellow-600 disabled:bg-gray-500 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg font-medium transition-colors"
                  >
                    {loading ? '⏳' : '🔄'} Check Vault
                  </button>
                </div>
              </div>
            </div>

            {/* Faucet Action */}
            <div className="bg-white/10 backdrop-blur-lg rounded-xl p-8 border border-white/20 text-center">
              <h3 className="text-3xl font-semibold text-white mb-4">
                🚰 Token Faucet
              </h3>
              <p className="text-gray-300 mb-6">
                Click the button below to receive 10 free tokens. Each request gives you exactly 10 tokens.
              </p>
              <button
                onClick={requestTokens}
                disabled={loading || !vaultBalance || vaultBalance < 10}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:from-gray-500 disabled:to-gray-600 disabled:cursor-not-allowed text-white px-8 py-4 rounded-xl font-bold text-lg transition-all transform hover:scale-105 disabled:transform-none"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  '🎁 Request 10 Tokens'
                )}
              </button>
              
              {vaultBalance !== null && vaultBalance < 10 && (
                <p className="text-red-400 mt-4">
                  ⚠️ Insufficient tokens in vault. Current vault balance: {vaultBalance}
                </p>
              )}
            </div>

            {/* Instructions */}
            <div className="mt-8 bg-white/5 backdrop-blur-lg rounded-xl p-6 border border-white/10">
              <h4 className="text-xl font-semibold text-white mb-4">📋 How to Use:</h4>
              <ol className="list-decimal list-inside text-gray-300 space-y-2">
                <li>Connect your Solana wallet (Phantom, Solflare, etc.)</li>
                <li>Check your current token balance</li>
                <li>Click "Request 10 Tokens" to receive tokens from the faucet</li>
                <li>Wait for the transaction to confirm</li>
                <li>Your balance will automatically update</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Home() {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);
  
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TorusWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <FaucetApp />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}