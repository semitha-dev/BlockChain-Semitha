use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount};

#[derive(Accounts)]
pub struct AirdropTokens<'info> {
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"vault_authority"],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}
