use anchor_lang::prelude::*;

declare_id!("Bank11111111111111111111111111111111111111111");

#[program]
pub mod simple_bank {
    use super::*;

    pub fn create_account(ctx: Context<CreateAccount>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.balance = 0;
        vault.owner = ctx.accounts.user.key();
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let user = &mut ctx.accounts.user;

        **user.to_account_info().try_borrow_mut_lamports()? -= amount;
        **vault.to_account_info().try_borrow_mut_lamports()? += amount;
        vault.balance += amount;

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        let user = &mut ctx.accounts.user;

        require!(vault.balance >= amount, BankError::NotEnoughFunds);

        **vault.to_account_info().try_borrow_mut_lamports()? -= amount;
        **user.to_account_info().try_borrow_mut_lamports()? += amount;
        vault.balance -= amount;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreateAccount<'info> {
    #[account(init, payer = user, space = 8 + 8 + 32)] // 8 header + 8 balance + 32 pubkey
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut, has_one = owner)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(mut, has_one = owner)]
    pub vault: Account<'info, Vault>,
    #[account(mut)]
    pub user: Signer<'info>,
}

#[account]
pub struct Vault {
    pub balance: u64,
    pub owner: Pubkey,
}

#[error_code]
pub enum BankError {
    #[msg("Not enough funds to withdraw.")]
    NotEnoughFunds,
}
