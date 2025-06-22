use anchor_lang::prelude::*;

declare_id!("7DxH6CWg56Kp8ehbGB8hVCh5iGiJvApArXZnHYZYidKP");

#[program]
pub mod favorite_book {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, name: String) -> Result<()> {
        let book_account = &mut ctx.accounts.book;
        book_account.name = name;
        book_account.authority = *ctx.accounts.user.key;
        Ok(())
    }

    pub fn update_name(ctx: Context<UpdateName>, new_name: String) -> Result<()> {
        let book_account = &mut ctx.accounts.book;
        require_keys_eq!(book_account.authority, ctx.accounts.user.key(), CustomError::Unauthorized);
        book_account.name = new_name;
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(init, payer = user, space = 8 + 32 + 64)] // 8 bytes header + 32 bytes authority + 64 bytes for name
    pub book: Account<'info, Book>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateName<'info> {
    #[account(mut)]
    pub book: Account<'info, Book>,
    pub user: Signer<'info>,
}

#[account]
pub struct Book {
    pub authority: Pubkey,  // Who owns this book
    pub name: String,       // Name of the book
}

#[error_code]
pub enum CustomError {
    #[msg("You are not authorized to update this book.")]
    Unauthorized,
}
