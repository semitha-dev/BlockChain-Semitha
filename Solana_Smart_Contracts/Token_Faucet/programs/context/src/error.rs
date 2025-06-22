use anchor_lang::prelude::*;

#[error_code]
pub enum CustomError {
    #[msg("Insufficient balance for transfer.")]
    InsufficientBalance,
}
