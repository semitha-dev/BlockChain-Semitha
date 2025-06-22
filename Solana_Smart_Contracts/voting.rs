use anchor_lang::prelude::*;

declare_id!("Vote11111111111111111111111111111111111111111");

#[program]
pub mod voting_system {
    use super::*;

    pub fn create_poll(ctx: Context<CreatePoll>, question: String) -> Result<()> {
        let poll = &mut ctx.accounts.poll;
        poll.question = question;
        poll.option1_votes = 0;
        poll.option2_votes = 0;
        Ok(())
    }

    pub fn vote(ctx: Context<Vote>, option: u8) -> Result<()> {
        let poll = &mut ctx.accounts.poll;
        match option {
            1 => poll.option1_votes += 1,
            2 => poll.option2_votes += 1,
            _ => return Err(error!(VotingError::InvalidOption)),
        }
        Ok(())
    }
}

#[derive(Accounts)]
pub struct CreatePoll<'info> {
    #[account(init, payer = user, space = 8 + 64 + 8 + 8)]
    pub poll: Account<'info, Poll>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Vote<'info> {
    #[account(mut)]
    pub poll: Account<'info, Poll>,
}

#[account]
pub struct Poll {
    pub question: String,
    pub option1_votes: u64,
    pub option2_votes: u64,
}

#[error_code]
pub enum VotingError {
    #[msg("Invalid voting option.")]
    InvalidOption,
}
