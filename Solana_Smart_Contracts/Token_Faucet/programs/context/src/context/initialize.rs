use anchor_lang::prelude::*;
use anchor_spl::token::{Token, TokenAccount, Mint};

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [b"vault"],
        bump,
        payer = user,
        token::mint = mint,
        token::authority = vault_authority
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        seeds = [b"vault_authority"],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}
