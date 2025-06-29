import * as anchor from "@coral-xyz/anchor";
import * as web3 from "@solana/web3.js";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import type { Context } from "../target/types/context";

// Configure the client to use the local cluster
anchor.setProvider(anchor.AnchorProvider.env());

const program = anchor.workspace.Context as anchor.Program<Context>;


(async () => {
  // Your inputs
  const walletAddress = new PublicKey("DC3ZJrhjFFMiTCyRwcKLD8HmzqZoyCXXYiHCxN4XJLxu");
  const mintAddress = new PublicKey("9A3BdDctisN5ezCKNNrL6FMdhdA2zT8RDzFxuASr5g89");

  // Connect to cluster (use devnet or mainnet as needed)
  const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

  // Derive ATA address
  const ata = await getAssociatedTokenAddress(
    mintAddress,
    walletAddress,
    false
  );

  console.log("✅ Associated Token Account (ATA):", ata.toBase58());
})();
