use anchor_lang::prelude::*;
use anchor_spl::token::{transfer, Transfer};
use crate::context::AirdropTokens;

pub fn handle(ctx: Context<AirdropTokens>) -> Result<()> {
    let amount: u64 = 10_000_000_000;

    let bump = ctx.bumps.vault_authority;
    let signer_seeds: &[&[&[u8]]] = &[&[b"vault_authority", &[bump]]];

    transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: ctx.accounts.vault_authority.to_account_info(),
            },
            signer_seeds,
        ),
        amount,
    )?;

    msg!("Airdropped 10 tokens to user");
    Ok(())
}
