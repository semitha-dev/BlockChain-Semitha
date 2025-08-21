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
import { clusterApiUrl, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js';
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token';

// ---- Program config ----
const PROGRAM_ID = new PublicKey('ZBRsgBJ3YzdRUi8UFquwxUhxd8VqpicaHKFa4hBHHGf');
const TOKEN_MINT_ADDRESS = new PublicKey('9A3BdDctisN5ezCKNNrL6FMdhdA2zT8RDzFxuASr5g89');

// IDL
import IDL from './idl/faucet.json';

// ---- Small helpers (UI only) ----
function truncate(pk: string, left = 4, right = 4) {
  if (!pk) return '';
  if (pk.length <= left + right) return pk;
  return `${pk.slice(0, left)}…${pk.slice(-right)}`;
}

function Card({
  children,
  className = '',
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <div className={`bg-slate-900/60 border border-slate-700/60 rounded-xl ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="text-center mb-8">
      <h2 className="text-2xl md:text-3xl font-bold text-white">{title}</h2>
      {subtitle && <p className="text-sm md:text-base text-slate-300 mt-1">{subtitle}</p>}
    </div>
  );
}

function Banner({
  tone = 'info',
  children,
}: React.PropsWithChildren<{ tone?: 'info' | 'success' | 'error' }>) {
  const toneMap = {
    info: 'bg-sky-500/10 border border-sky-500/30 text-sky-200',
    success: 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-200',
    error: 'bg-rose-500/10 border border-rose-500/30 text-rose-200',
  } as const;
  return <div className={`rounded-lg px-4 py-3 ${toneMap[tone]}`}>{children}</div>;
}

// ============================== Faucet App ===============================

function FaucetApp() {
  const { connection } = useConnection();
  const { publicKey, signTransaction, sendTransaction } = useWallet();

  const [userBalance, setUserBalance] = useState<number | null>(null);
  const [vaultBalance, setVaultBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const getProgram = useCallback(() => {
    if (!publicKey || !signTransaction) return null;

    try {
      const provider = new AnchorProvider(
        connection,
        { publicKey, signTransaction, signAllTransactions: async (txs) => txs },
        { commitment: 'confirmed' },
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
      const [pda] = PublicKey.findProgramAddressSync([Buffer.from('vault')], PROGRAM_ID);
      return pda;
    } catch (error) {
      console.error('Error generating vault PDA:', error);
      throw error;
    }
  }, []);

  const getVaultAuthorityPDA = useCallback(() => {
    try {
      const [pda] = PublicKey.findProgramAddressSync([Buffer.from('vault_authority')], PROGRAM_ID);
      return pda;
    } catch (error) {
      console.error('Error generating vault authority PDA:', error);
      throw error;
    }
  }, []);

  // ---- Balances ----
  const getUserBalance = useCallback(async () => {
    if (!publicKey) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const userAta = await getAssociatedTokenAddress(TOKEN_MINT_ADDRESS, publicKey);
      const accountInfo = await connection.getAccountInfo(userAta);
      if (!accountInfo) {
        setUserBalance(0);
        return;
      }
      const tokenAccount = await connection.getTokenAccountBalance(userAta);
      const balance = tokenAccount.value.uiAmount || 0;
      setUserBalance(balance);
    } catch (err) {
      console.error('Error getting user balance:', err);
      setUserBalance(0);
    } finally {
      setLoading(false);
    }
  }, [publicKey, connection]);

  const getVaultBalance = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const vaultPDA = getVaultPDA();
      const tokenAccount = await connection.getTokenAccountBalance(vaultPDA);
      const balance = tokenAccount.value.uiAmount || 0;
      setVaultBalance(balance);
    } catch (err) {
      console.error('Error getting vault balance:', err);
      setError('Failed to fetch vault balance.');
    } finally {
      setLoading(false);
    }
  }, [connection, getVaultPDA]);

  // ---- Request tokens ----
  const requestTokens = useCallback(async () => {
    if (!publicKey) {
      setError('Wallet not connected.');
      return;
    }
    const program = getProgram();
    if (!program) {
      setError('Failed to initialize program.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const vaultPDA = getVaultPDA();
      const vaultAuthorityPDA = getVaultAuthorityPDA();
      const userAta = await getAssociatedTokenAddress(TOKEN_MINT_ADDRESS, publicKey);

      if (!vaultPDA || !vaultAuthorityPDA || !publicKey || !userAta) {
        throw new Error('One or more required accounts are undefined.');
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

      const tx = await program.methods.airdropToUser().accounts(accounts).transaction();
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, 'confirmed');

      await getUserBalance();
      await getVaultBalance();

      setSuccess('Request successful. You received 10 tokens.');
    } catch (err: any) {
      console.error('Error requesting tokens:', err);
      const msg = (err?.message || '').toLowerCase();

      if (
        msg.includes('unresolved accounts') ||
        msg.includes('userata') ||
        msg.includes('maximum depth') ||
        msg.includes('cooldown') ||
        msg.includes('limit') ||
        msg.includes('insufficient')
      ) {
        setError('Maximum claim limit reached for now. Please try again later.');
      } else {
        setError(err?.message || 'Failed to request tokens.');
      }
    } finally {
      setLoading(false);
    }
  }, [
    publicKey,
    getProgram,
    connection,
    sendTransaction,
    getUserBalance,
    getVaultBalance,
    getVaultPDA,
    getVaultAuthorityPDA,
  ]);

  // Auto-load on connect
  useEffect(() => {
    if (publicKey) {
      getUserBalance();
      getVaultBalance();
    }
  }, [publicKey, getUserBalance, getVaultBalance]);

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top bar */}
      <header className="border-b border-slate-800/80 bg-slate-950/70 backdrop-blur supports-[backdrop-filter]:bg-slate-950/60">
        <div className="mx-auto max-w-6xl px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-white text-xl font-semibold tracking-tight">Solana Token Faucet</h1>
            <p className="text-slate-400 text-sm">Claim test tokens for demos and development.</p>
          </div>
          <div className="flex items-center gap-3">
            {!publicKey ? (
              <WalletMultiButton className="!bg-slate-800 hover:!bg-slate-700 !text-white !rounded-lg !px-4 !py-2 !h-auto !min-h-0 !font-medium" />
            ) : (
              <div className="flex items-center gap-3">
                <div className="hidden md:block text-slate-300 text-sm font-mono bg-slate-800/80 border border-slate-700/70 rounded-md px-2 py-1">
                  {truncate(publicKey.toString(), 6, 6)}
                </div>
                <WalletDisconnectButton className="!bg-slate-800 hover:!bg-slate-700 !text-white !rounded-lg !px-3 !py-2 !h-auto !min-h-0 !font-medium" />
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-10">
        {/* Banners */}
        <div className="space-y-3 mb-8">
          {success && <Banner tone="success">{success}</Banner>}
          {error && <Banner tone="error">{error}</Banner>}
          {!publicKey && (
            <Banner tone="info">
              Connect a wallet to view your token balance, check the vault, and request tokens.
            </Banner>
          )}
        </div>

        {publicKey && (
          <div className="grid grid-cols-1 gap-8">
            {/* Balances */}
            <section>
              <SectionTitle title="Balances" subtitle="Real-time SPL token balances" />
              <div className="grid md:grid-cols-2 gap-6">
                {/* User Balance */}
                <Card className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-white font-semibold text-lg">Your Balance</h3>
                      <p className="text-slate-400 text-sm mt-1">Associated token account</p>
                    </div>
                    <button
                      onClick={getUserBalance}
                      disabled={loading}
                      className="text-sm bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/60 disabled:cursor-not-allowed text-white px-3 py-2 rounded-md"
                    >
                      {loading ? 'Refreshing…' : 'Refresh'}
                    </button>
                  </div>
                  <div className="mt-5">
                    <p className="text-4xl font-bold tracking-tight text-emerald-400">
                      {userBalance !== null ? `${userBalance.toLocaleString()} TOKENS` : '--'}
                    </p>
                  </div>
                </Card>

                {/* Vault Balance */}
                <Card className="p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-white font-semibold text-lg">Vault Balance</h3>
                      <p className="text-slate-400 text-sm mt-1">Program vault PDA</p>
                    </div>
                    <button
                      onClick={getVaultBalance}
                      disabled={loading}
                      className="text-sm bg-slate-800 hover:bg-slate-700 disabled:bg-slate-800/60 disabled:cursor-not-allowed text-white px-3 py-2 rounded-md"
                    >
                      {loading ? 'Checking…' : 'Check'}
                    </button>
                  </div>
                  <div className="mt-5">
                    <p className="text-4xl font-bold tracking-tight text-amber-300">
                      {vaultBalance !== null ? `${vaultBalance.toLocaleString()} TOKENS` : '--'}
                    </p>
                  </div>
                </Card>
              </div>
            </section>

            {/* Faucet Action */}
            <section>
              <SectionTitle title="Request Tokens" subtitle="Each request sends 10 tokens to your wallet" />
              <Card className="p-8">
                <div className="flex flex-col items-center text-center">
                  <p className="text-slate-300 max-w-2xl">
                    Click the button below to request 10 tokens from the faucet. Transactions are submitted to the
                    network and confirmed before balances refresh.
                  </p>

                  <button
                    onClick={requestTokens}
                    disabled={loading || !vaultBalance || vaultBalance < 10}
                    className="mt-6 inline-flex items-center justify-center bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-semibold transition-colors"
                  >
                    {loading ? 'Processing…' : 'Request 10 Tokens'}
                  </button>

                  {vaultBalance !== null && vaultBalance < 10 && (
                    <p className="text-rose-300 mt-4">
                      Insufficient tokens in the vault. Current vault balance: {vaultBalance}
                    </p>
                  )}
                </div>
              </Card>
            </section>

            {/* How-to */}
            <section>
              <SectionTitle title="How it works" />
              <Card className="p-6">
                <ol className="list-decimal list-inside text-slate-300 space-y-2">
                  <li>Connect your Solana wallet (Phantom, Solflare, Torus, etc.).</li>
                  <li>Review your current SPL token balance.</li>
                  <li>Click <span className="font-medium text-white">Request 10 Tokens</span> to receive an airdrop.</li>
                  <li>Wait for the transaction to confirm on-chain.</li>
                  <li>Your balance and the vault balance will refresh automatically.</li>
                </ol>
              </Card>
            </section>
          </div>
        )}

        {!publicKey && (
          <div className="max-w-3xl mx-auto mt-6">
            <Card className="p-8">
              <div className="text-center">
                <h3 className="text-white font-semibold text-lg">Get started</h3>
                <p className="text-slate-300 mt-2">
                  Use the connect button in the top-right to link your wallet. Once connected, you can view balances and request tokens.
                </p>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

export default function Home() {
  const network = WalletAdapterNetwork.Devnet;
  const endpoint = useMemo(() => clusterApiUrl(network), [network]);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new TorusWalletAdapter()],
    [],
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
