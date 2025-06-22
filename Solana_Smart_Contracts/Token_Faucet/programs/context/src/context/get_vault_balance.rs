use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
pub struct GetVaultBalance<'info> {
    #[account(
        seeds = [b"vault"],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,
}
