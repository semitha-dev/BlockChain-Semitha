use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{transfer, Mint, Token, TokenAccount, Transfer};

declare_id!("ZBRsgBJ3YzdRUi8UFquwxUhxd8VqpicaHKFa4hBHHGf");

#[program]
pub mod faucet {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        airdrop_amount: u64,
        cooldown_seconds: i64,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = *ctx.accounts.authority.key;
        config.airdrop_amount = airdrop_amount;
        config.cooldown = cooldown_seconds;
        msg!("Faucet initialized by {}", ctx.accounts.authority.key);
        Ok(())
    }

    pub fn airdrop_to_user(ctx: Context<AirdropTokens>) -> Result<()> {
        let clock = Clock::get()?;
        let config = &ctx.accounts.config;
        let user_state = &mut ctx.accounts.user_state;

        // Cooldown enforcement
        if clock.unix_timestamp < user_state.last_claim + config.cooldown {
            return err!(FaucetError::CooldownNotElapsed);
        }

        // Check vault balance
        let vault_balance = ctx.accounts.vault.amount;
        require!(
            vault_balance >= config.airdrop_amount,
            FaucetError::InsufficientVault
        );

        // Signer seeds for PDA
        let bump: u8 = ctx.bumps.vault_authority;
        let seeds = &[b"vault_authority".as_ref(), &[bump]];
        let signer = &[&seeds[..]];

        // Transfer tokens
        transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.user_ata.to_account_info(),
                    authority: ctx.accounts.vault_authority.to_account_info(),
                },
                signer,
            ),
            config.airdrop_amount,
        )?;

        user_state.last_claim = clock.unix_timestamp;
        msg!(
            "Airdropped {} tokens to {}",
            config.airdrop_amount,
            ctx.accounts.user.key
        );
        Ok(())
    }

    pub fn get_vault_balance(ctx: Context<GetVaultBalance>) -> Result<u64> {
        let balance = ctx.accounts.vault.amount;
        msg!("Vault balance: {} tokens", balance);
        Ok(balance)
    }

    pub fn get_user_balance(ctx: Context<GetUserBalance>) -> Result<u64> {
        let balance = ctx.accounts.user_token_account.amount;
        msg!("User balance: {} tokens", balance);
        Ok(balance)
    }
}

#[account]
pub struct FaucetConfig {
    pub authority: Pubkey,
    pub airdrop_amount: u64,
    pub cooldown: i64,
}

#[account]
pub struct UserClaim {
    pub last_claim: i64,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [b"config"],
        bump,
        payer = authority,
        space = 8 + 32 + 8 + 8,
    )]
    pub config: Account<'info, FaucetConfig>,

    #[account(
        init,
        seeds = [b"vault"],
        bump,
        payer = authority,
        token::mint = mint,
        token::authority = vault_authority,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: This is a PDA
    #[account(
        seeds = [b"vault_authority"],
        bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct AirdropTokens<'info> {
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, FaucetConfig>,

    #[account(
        mut,
        seeds = [b"vault"],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: This is a PDA
    #[account(
        seeds = [b"vault_authority"],
        bump,
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        seeds = [b"user", user.key().as_ref()],
        bump,
        payer = user,
        space = 8 + 8,
    )]
    pub user_state: Account<'info, UserClaim>,

    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = mint,
        associated_token::authority = user,
    )]
    pub user_ata: Account<'info, TokenAccount>,

    #[account(mut)]
    pub mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct GetVaultBalance<'info> {
    #[account(seeds = [b"vault"], bump)]
    pub vault: Account<'info, TokenAccount>,
}

#[derive(Accounts)]
pub struct GetUserBalance<'info> {
    pub user_token_account: Account<'info, TokenAccount>,
}

#[error_code]
pub enum FaucetError {
    #[msg("Cooldown period has not elapsed yet")]
    CooldownNotElapsed,

    #[msg("Vault has insufficient tokens")]
    InsufficientVault,
}
