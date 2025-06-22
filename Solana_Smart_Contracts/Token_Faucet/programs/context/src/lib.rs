use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

pub mod context;
pub mod instructions;

use instructions::*;
use context::*;

declare_id!("ZBRsgBJ3YzdRUi8UFquwxUhxd8VqpicaHKFa4hBHHGf");

#[program]
pub mod hello_anchor {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        initialize::handle(ctx)
    }

    pub fn get_vault_balance(ctx: Context<GetVaultBalance>) -> Result<u64> {
        get_vault_balance::handle(ctx)
    }

    pub fn airdrop_to_user(ctx: Context<AirdropTokens>) -> Result<()> {
        airdrop_tokens::handle(ctx)
    }

    pub fn get_user_balance(ctx: Context<GetUserBalance>) -> Result<u64> {
        get_user_balance::handle(ctx)
    }
}
