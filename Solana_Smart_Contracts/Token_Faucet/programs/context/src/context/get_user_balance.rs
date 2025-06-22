use anchor_lang::prelude::*;
use anchor_spl::token::TokenAccount;

#[derive(Accounts)]
pub struct GetUserBalance<'info> {
    pub user_token_account: Account<'info, TokenAccount>,
}
