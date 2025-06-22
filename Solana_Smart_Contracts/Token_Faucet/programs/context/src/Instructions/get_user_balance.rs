use anchor_lang::prelude::*;
use crate::context::GetUserBalance;

pub fn handle(ctx: Context<GetUserBalance>) -> Result<u64> {
    let balance = ctx.accounts.user_token_account.amount;
    msg!("User balance: {} tokens", balance);
    Ok(balance)
}
