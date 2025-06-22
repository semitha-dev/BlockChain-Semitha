use anchor_lang::prelude::*;
use crate::context::GetVaultBalance;

pub fn handle(ctx: Context<GetVaultBalance>) -> Result<u64> {
    let balance = ctx.accounts.vault.amount;
    msg!("Vault balance: {} tokens", balance);
    Ok(balance)
}
