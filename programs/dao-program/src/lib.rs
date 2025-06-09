// FIXED IMPORTS - Replace your current imports with these
use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::clock::Clock;
use anchor_spl::token_interface::{
    mint_to,
    set_authority,
    transfer,
    Mint, // Use token_interface for cross-compatibility
    MintTo,
    SetAuthority,
    TokenAccount,   // Use token_interface for cross-compatibility
    TokenInterface, // Use TokenInterface instead of Token2022
    Transfer,
};
use solana_program::program_option::COption;
use spl_token_2022::instruction::AuthorityType;

declare_id!("EGbhsJtKMcSkqPAotLvc3mjPkVLQSFi9LJ7qNx78ey6W");

// Constants for maximum sizes
const MAX_TITLE_LENGTH: usize = 50;
const MAX_DESCRIPTION_LENGTH: usize = 500;
const MAX_VOTERS_PER_PROPOSAL: usize = 200;
const MAX_PROPOSAL_CREATORS: usize = 25;

#[program]
pub mod governance {
    use super::*;

    /// Initializes the governance configuration
    // MODIFIED SECTIONS ONLY

    // 1. MODIFIED INITIALIZE FUNCTION
    // 2. MODIFIED INITIALIZE FUNCTION - Remove authority transfer
    pub fn initialize(
        ctx: Context<Initialize>,
        dao_duration_seconds: i64,
        max_proposals_per_config: u64,
        max_voters_per_proposal: u64,
    ) -> Result<()> {
        require!(
            dao_duration_seconds >= 86400,
            GovernanceError::DaoDurationTooShort
        );
        require!(
            dao_duration_seconds <= 31_536_000,
            GovernanceError::DaoDurationTooLong
        );
        require!(
            max_voters_per_proposal <= MAX_VOTERS_PER_PROPOSAL as u64,
            GovernanceError::MaxVotersExceeded
        );
        require!(
            max_proposals_per_config <= MAX_PROPOSAL_CREATORS as u64,
            GovernanceError::MaxActiveProposalsExceeded
        );

        let governance_config = &mut ctx.accounts.governance_config;
        let current_time = Clock::get()?.unix_timestamp;

        governance_config.apm_mint = ctx.accounts.apm_mint.key();
        governance_config.proposal_count = 0;
        governance_config.active_proposals = 0;
        governance_config.authority = ctx.accounts.authority.key();
        governance_config.dao_end_time = current_time + dao_duration_seconds;
        governance_config.max_proposals_per_config = max_proposals_per_config;
        governance_config.max_voters_per_proposal = max_voters_per_proposal;
        governance_config.proposal_creator_whitelist = vec![ctx.accounts.authority.key()];

        // REMOVED: Token authority transfer - authority/admin keeps mint authority

        emit!(GovernanceConfigInitialized {
            authority: ctx.accounts.authority.key(),
            apm_mint: ctx.accounts.apm_mint.key(),
            dao_end_time: governance_config.dao_end_time,
            timestamp: current_time,
        });

        Ok(())
    }

    // 2. MODIFIED UPDATE_CONFIG FUNCTION
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_dao_duration_seconds: Option<i64>,
        new_max_proposals: Option<u64>,
        new_max_voters: Option<u64>,
    ) -> Result<()> {
        let governance_config = &mut ctx.accounts.governance_config;
        let current_time = Clock::get()?.unix_timestamp;

        require!(
            current_time < governance_config.dao_end_time,
            GovernanceError::DaoExpired
        );
        require!(
            governance_config.authority == ctx.accounts.authority.key(),
            GovernanceError::UnauthorizedUpdate
        );

        if let Some(dao_duration) = new_dao_duration_seconds {
            require!(dao_duration >= 86400, GovernanceError::DaoDurationTooShort);
            require!(
                dao_duration <= 31_536_000,
                GovernanceError::DaoDurationTooLong
            );
            governance_config.dao_end_time = current_time + dao_duration;
        }

        if let Some(max_proposals) = new_max_proposals {
            require!(
                max_proposals <= 10,
                GovernanceError::MaxActiveProposalsExceeded
            );
            governance_config.max_proposals_per_config = max_proposals;
        }

        if let Some(max_voters) = new_max_voters {
            require!(max_voters <= 1000, GovernanceError::MaxVotersExceeded);
            governance_config.max_voters_per_proposal = max_voters;
        }

        emit!(ConfigUpdated {
            updated_by: ctx.accounts.authority.key(),
            dao_end_time: governance_config.dao_end_time,
            timestamp: current_time,
        });

        Ok(())
    }

    /// Updates the end time of an active proposal (only authority)
    pub fn update_proposal_endtime(
        ctx: Context<UpdateProposalEndtime>,
        new_voting_duration_seconds: i64,
    ) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let governance_config = &ctx.accounts.governance_config;
        let current_time = Clock::get()?.unix_timestamp;

        // Validate basic requirements
        require!(
            current_time < governance_config.dao_end_time,
            GovernanceError::DaoExpired
        );
        require!(
            governance_config.authority == ctx.accounts.authority.key(),
            GovernanceError::UnauthorizedUpdate
        );
        require!(proposal.is_active, GovernanceError::ProposalNotActive);
        require!(!proposal.executed, GovernanceError::ProposalAlreadyExecuted);

        // Validate new voting duration
        require!(
            new_voting_duration_seconds >= 1,
            GovernanceError::VotingDurationTooShort
        );
        require!(
            new_voting_duration_seconds <= 2_592_000,
            GovernanceError::VotingDurationTooLong
        );

        // Calculate new end time
        let new_end_time = proposal.start_time + new_voting_duration_seconds;

        // Ensure new end time doesn't exceed DAO expiration
        require!(
            new_end_time <= governance_config.dao_end_time,
            GovernanceError::VotingDurationTooLong
        );

        // Update the proposal end time
        let old_end_time = proposal.end_time;
        proposal.end_time = new_end_time;

        emit!(ProposalEndtimeUpdated {
            proposal_id: proposal.proposal_id,
            old_end_time,
            new_end_time,
            updated_by: ctx.accounts.authority.key(),
            timestamp: current_time,
        });

        Ok(())
    }

    /// Adds a creator to the proposal creator whitelist (only authority)
    pub fn add_proposal_creator(
        ctx: Context<ManageProposalCreators>,
        creator_to_add: Pubkey,
    ) -> Result<()> {
        let governance_config = &mut ctx.accounts.governance_config;
        let current_time = Clock::get()?.unix_timestamp;

        require!(
            current_time < governance_config.dao_end_time,
            GovernanceError::DaoExpired
        );
        require!(
            governance_config.authority == ctx.accounts.authority.key(),
            GovernanceError::UnauthorizedUpdate
        );
        require!(
            !governance_config
                .proposal_creator_whitelist
                .contains(&creator_to_add),
            GovernanceError::CreatorAlreadyWhitelisted
        );

        governance_config
            .proposal_creator_whitelist
            .push(creator_to_add);

        emit!(ProposalCreatorAdded {
            added_creator: creator_to_add,
            added_by: ctx.accounts.authority.key(),
            timestamp: current_time,
        });

        Ok(())
    }

    /// Removes a creator from the proposal creator whitelist (only authority)
    pub fn remove_proposal_creator(
        ctx: Context<ManageProposalCreators>,
        creator_to_remove: Pubkey,
    ) -> Result<()> {
        let governance_config = &mut ctx.accounts.governance_config;
        let current_time = Clock::get()?.unix_timestamp;

        require!(
            current_time < governance_config.dao_end_time,
            GovernanceError::DaoExpired
        );
        require!(
            governance_config.authority == ctx.accounts.authority.key(),
            GovernanceError::UnauthorizedUpdate
        );
        require!(
            governance_config
                .proposal_creator_whitelist
                .contains(&creator_to_remove),
            GovernanceError::CreatorNotWhitelisted
        );
        require!(
            governance_config.proposal_creator_whitelist.len() > 1,
            GovernanceError::CannotRemoveLastCreator
        );

        governance_config
            .proposal_creator_whitelist
            .retain(|&x| x != creator_to_remove);

        emit!(ProposalCreatorRemoved {
            removed_creator: creator_to_remove,
            removed_by: ctx.accounts.authority.key(),
            timestamp: current_time,
        });

        Ok(())
    }

    /// Creates a new proposal (only whitelisted creators can create)
    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        title: String,
        description: String,
        voting_duration_seconds: i64,
        category: ProposalCategory,
        max_voters: u64,
    ) -> Result<()> {
        let governance_config = &ctx.accounts.governance_config;
        let current_time = Clock::get()?.unix_timestamp;

        // Validate inputs
        require!(
            current_time < governance_config.dao_end_time,
            GovernanceError::DaoExpired
        );
        require!(
            voting_duration_seconds >= 3600,
            GovernanceError::VotingDurationTooShort
        );
        require!(
            voting_duration_seconds <= 2_592_000,
            GovernanceError::VotingDurationTooLong
        );
        require!(
            title.len() <= MAX_TITLE_LENGTH,
            GovernanceError::TitleTooLong
        );
        require!(
            description.len() <= MAX_DESCRIPTION_LENGTH,
            GovernanceError::DescriptionTooLong
        );
        require!(
            max_voters <= governance_config.max_voters_per_proposal,
            GovernanceError::TooManyVoters
        );
        require!(max_voters <= 1000, GovernanceError::MaxVotersExceeded);
        require!(
            governance_config.active_proposals < governance_config.max_proposals_per_config,
            GovernanceError::TooManyActiveProposals
        );
        require!(
            governance_config
                .proposal_creator_whitelist
                .contains(&ctx.accounts.authority.key()),
            GovernanceError::CreatorNotWhitelisted
        );
        require!(
            matches!(
                category,
                ProposalCategory::EmergencyCircuitBreaker
                    | ProposalCategory::TreasuryFundMove
                    | ProposalCategory::YearlyCap
                    | ProposalCategory::TransferFee
            ),
            GovernanceError::InvalidProposalCategory
        );

        let cfg = &mut ctx.accounts.governance_config;
        let proposal = &mut ctx.accounts.proposal;
        let vote_record = &mut ctx.accounts.vote_record;

        // Initialize proposal
        proposal.proposal_id = cfg.proposal_count;
        proposal.title = title;
        proposal.description = description;
        proposal.start_time = current_time;
        proposal.end_time = current_time + voting_duration_seconds;
        proposal.for_votes = 0;
        proposal.against_votes = 0;
        proposal.executed = false;
        proposal.created_by = ctx.accounts.authority.key();
        proposal.proposal_category = category;
        proposal.max_voters = max_voters;
        proposal.current_voters = 0;
        proposal.is_active = true;
        proposal.vote_record = vote_record.key();
        proposal.executed_at = None;
        proposal.executed_by = None;

        // Initialize vote record
        vote_record.proposal_id = cfg.proposal_count;
        vote_record.total_for_votes = 0;
        vote_record.total_against_votes = 0;
        vote_record.total_voters = 0;
        vote_record.voters = Vec::new();
        vote_record.vote_types = Vec::new();

        cfg.proposal_count = cfg.proposal_count.checked_add(1).unwrap();
        cfg.active_proposals = cfg.active_proposals.checked_add(1).unwrap();

        emit!(ProposalCreated {
            proposal_id: proposal.proposal_id,
            category,
            title: proposal.title.clone(),
            created_by: ctx.accounts.authority.key(),
            start_time: proposal.start_time,
            end_time: proposal.end_time,
            max_voters: proposal.max_voters,
            timestamp: current_time,
        });

        Ok(())
    }

    /// Cast vote on a proposal (only whitelisted creators can vote)
    // 3. MODIFIED CAST_VOTE FUNCTION
    pub fn cast_vote(ctx: Context<CastVote>, vote: bool) -> Result<()> {
        let vote_record = &mut ctx.accounts.vote_record;
        let governance_config = &ctx.accounts.governance_config;
        let proposal = &mut ctx.accounts.proposal;
        let current_time = Clock::get()?.unix_timestamp;
        let voter_key = ctx.accounts.voter.key();

        require!(
            current_time < governance_config.dao_end_time,
            GovernanceError::DaoExpired
        );
        require!(proposal.is_active, GovernanceError::ProposalNotActive);
        require!(
            current_time >= proposal.start_time && current_time <= proposal.end_time,
            GovernanceError::InvalidVotingTime
        );
        require!(
            governance_config
                .proposal_creator_whitelist
                .contains(&voter_key),
            GovernanceError::VoterNotWhitelisted
        );
        require!(
            !vote_record.voters.contains(&voter_key),
            GovernanceError::AlreadyVoted
        );
        require!(
            vote_record.total_voters < proposal.max_voters,
            GovernanceError::MaxVotersReached
        );

        vote_record.voters.push(voter_key);
        vote_record.vote_types.push(vote);

        if vote {
            vote_record.total_for_votes = vote_record
                .total_for_votes
                .checked_add(1)
                .ok_or(GovernanceError::VotingOverflow)?;
            proposal.for_votes = vote_record.total_for_votes;
        } else {
            vote_record.total_against_votes = vote_record
                .total_against_votes
                .checked_add(1)
                .ok_or(GovernanceError::VotingOverflow)?;
            proposal.against_votes = vote_record.total_against_votes;
        }

        vote_record.total_voters = vote_record
            .total_voters
            .checked_add(1)
            .ok_or(GovernanceError::VotingOverflow)?;

        proposal.current_voters = vote_record.total_voters;

        emit!(VoteCast {
            proposal_id: proposal.proposal_id,
            voter: voter_key,
            vote_type: vote,
            for_votes: proposal.for_votes,
            against_votes: proposal.against_votes,
            current_voters: proposal.current_voters,
            timestamp: current_time,
        });

        Ok(())
    }

    // Here are the issues in the execute_proposal function that need fixing:

    /// Executes a proposal (only authority) and closes vote record account
    pub fn execute_proposal(ctx: Context<ExecuteProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let vote_record = &mut ctx.accounts.vote_record;
        let current_time = Clock::get()?.unix_timestamp;

        // Get governance_config immutably first for validations
        let governance_config = &ctx.accounts.governance_config;

        // Existing validations
        require!(
            current_time < governance_config.dao_end_time,
            GovernanceError::DaoExpired
        );
        require!(
            governance_config.authority == ctx.accounts.authority.key(),
            GovernanceError::UnauthorizedUpdate
        );
        require!(proposal.is_active, GovernanceError::ProposalNotActive);
        require!(
            current_time > proposal.end_time,
            GovernanceError::VotingStillActive
        );
        require!(!proposal.executed, GovernanceError::ProposalAlreadyExecuted);
        require!(
            proposal.for_votes > proposal.against_votes,
            GovernanceError::ProposalNotPassed
        );

        // Handle YearlyCap proposal execution
        if proposal.proposal_category == ProposalCategory::YearlyCap {
            let treasury_config = &mut ctx.accounts.treasury_config;
            let apm_mint = &ctx.accounts.apm_mint;
            let treasury_wallet = &ctx.accounts.treasury_wallet;

            // Validate treasury wallet is for the correct mint
            require!(
                treasury_wallet.mint == apm_mint.key(),
                GovernanceError::InvalidTreasuryMint
            );

            // Initialize treasury config if needed
            if treasury_config.authority == Pubkey::default() {
                treasury_config.authority = ctx.accounts.authority.key();
                treasury_config.treasury_wallet = treasury_wallet.key();
                treasury_config.last_mint_timestamp = 0;
                treasury_config.total_minted = 0;
            }

            // Check if we can mint (yearly restriction)
            let one_year_seconds = 365 * 24 * 60 * 60;
            // require!(
            //     current_time >= treasury_config.last_mint_timestamp + one_year_seconds,
            //     GovernanceError::YearlyCapNotReached
            // );

            // Calculate 2% of total supply
            let total_supply = apm_mint.supply;
            let mint_amount = total_supply
                .checked_mul(2)
                .ok_or(GovernanceError::MintCalculationOverflow)?
                .checked_div(100)
                .ok_or(GovernanceError::MintCalculationOverflow)?;

            require!(mint_amount > 0, GovernanceError::InvalidMintAmount);

            // Mint tokens using authority (admin keeps mint authority)
            let cpi_accounts = MintTo {
                mint: ctx.accounts.apm_mint.to_account_info(),
                to: treasury_wallet.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

            mint_to(cpi_ctx, mint_amount)?;

            // Update treasury config
            treasury_config.last_mint_timestamp = current_time;
            treasury_config.total_minted = treasury_config
                .total_minted
                .checked_add(mint_amount)
                .ok_or(GovernanceError::MintCalculationOverflow)?;

            emit!(TreasuryMinted {
                proposal_id: proposal.proposal_id,
                mint_amount,
                treasury_wallet: treasury_wallet.key(),
                total_minted: treasury_config.total_minted,
                timestamp: current_time,
            });
        }
        // Replace your TreasuryFundMove section with this enhanced version:
        else if proposal.proposal_category == ProposalCategory::TreasuryFundMove {
            let treasury_wallet_swap = &ctx.accounts.treasury_wallet_swap;
            let allocated_treasury_wallet = &ctx.accounts.allocated_treasury_wallet;
            let apm_mint = &ctx.accounts.apm_mint;

            // Enhanced validations
            require!(
                treasury_wallet_swap.mint == apm_mint.key(),
                GovernanceError::InvalidTreasuryMint
            );
            require!(
                allocated_treasury_wallet.mint == apm_mint.key(),
                GovernanceError::InvalidTreasuryMint
            );

            // Verify the authority can transfer from treasury_wallet_swap
            require!(
                treasury_wallet_swap.owner == ctx.accounts.authority.key(),
                GovernanceError::InvalidTokenOwner
            );

            let transfer_amount = treasury_wallet_swap.amount;
            require!(transfer_amount > 0, GovernanceError::NoFundsToTransfer);

            // Use the correct Transfer struct and transfer function
            let cpi_accounts = Transfer {
                from: treasury_wallet_swap.to_account_info(),
                to: allocated_treasury_wallet.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            };
            let cpi_program = ctx.accounts.token_program.to_account_info();
            let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

            // This should work now with proper imports
            transfer(cpi_ctx, transfer_amount)?;

            emit!(TreasuryFundsMoved {
                proposal_id: proposal.proposal_id,
                from_wallet: treasury_wallet_swap.key(),
                to_wallet: allocated_treasury_wallet.key(),
                amount: transfer_amount,
                timestamp: current_time,
            });
        }

        // NOW get mutable reference to governance_config for final updates
        let governance_config = &mut ctx.accounts.governance_config;

        // Mark proposal as executed
        proposal.executed = true;
        proposal.is_active = false;
        proposal.executed_at = Some(current_time);
        proposal.executed_by = Some(ctx.accounts.authority.key());

        // Decrease active proposals count
        governance_config.active_proposals = governance_config
            .active_proposals
            .checked_sub(1)
            .unwrap_or(0);

        emit!(ProposalExecuted {
            proposal_id: proposal.proposal_id,
            category: proposal.proposal_category.clone(),
            for_votes: proposal.for_votes,
            against_votes: proposal.against_votes,
            executed_by: ctx.accounts.authority.key(),
            executed_at: current_time,
        });

        // Close the vote record account
        let vote_record_info = vote_record.to_account_info();
        let authority_info = ctx.accounts.authority.to_account_info();

        let vote_record_lamports = vote_record_info.lamports();
        **vote_record_info.lamports.borrow_mut() = 0;
        **authority_info.lamports.borrow_mut() = authority_info
            .lamports()
            .checked_add(vote_record_lamports)
            .ok_or(GovernanceError::AccountCloseOverflow)?;

        Ok(())
    }
    /// Cancel a proposal (only authority or creator)
    pub fn cancel_proposal(ctx: Context<CancelProposal>) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let governance_config = &mut ctx.accounts.governance_config;
        let vote_record = &mut ctx.accounts.vote_record;
        let current_time = Clock::get()?.unix_timestamp;

        require!(
            current_time < governance_config.dao_end_time,
            GovernanceError::DaoExpired
        );
        require!(
            governance_config.authority == ctx.accounts.signer.key()
                || proposal.created_by == ctx.accounts.signer.key(),
            GovernanceError::UnauthorizedCancel
        );
        require!(proposal.is_active, GovernanceError::ProposalNotActive);
        require!(!proposal.executed, GovernanceError::ProposalAlreadyExecuted);

        proposal.is_active = false;

        governance_config.active_proposals = governance_config
            .active_proposals
            .checked_sub(1)
            .unwrap_or(0);

        emit!(ProposalCancelled {
            proposal_id: proposal.proposal_id,
            cancelled_by: ctx.accounts.signer.key(),
            timestamp: current_time,
        });

        // Close the vote record account
        let vote_record_info = vote_record.to_account_info();
        let signer_info = ctx.accounts.signer.to_account_info();

        let vote_record_lamports = vote_record_info.lamports();
        **vote_record_info.lamports.borrow_mut() = 0;
        **signer_info.lamports.borrow_mut() = signer_info
            .lamports()
            .checked_add(vote_record_lamports)
            .ok_or(GovernanceError::AccountCloseOverflow)?;

        Ok(())
    }
}

//────────────────────────────────────────────────────────────────────────────
// ACCOUNT STRUCTS
//────────────────────────────────────────────────────────────────────────────

#[account]
#[derive(Default)]
pub struct GovernanceConfig {
    pub apm_mint: Pubkey,                        // 32
    pub proposal_count: u64,                     // 8
    pub active_proposals: u64,                   // 8
    pub authority: Pubkey,                       // 32
    pub dao_end_time: i64,                       // 8
    pub max_proposals_per_config: u64,           // 8
    pub max_voters_per_proposal: u64,            // 8
    pub proposal_creator_whitelist: Vec<Pubkey>, // 4 + (32 * MAX_PROPOSAL_CREATORS)
}

#[account]
#[derive(Default)]
pub struct Proposal {
    pub proposal_id: u64,                    // 8
    pub title: String,                       // 4 + MAX_TITLE_LENGTH
    pub description: String,                 // 4 + MAX_DESCRIPTION_LENGTH
    pub start_time: i64,                     // 8
    pub end_time: i64,                       // 8
    pub for_votes: u64,                      // 8
    pub against_votes: u64,                  // 8
    pub executed: bool,                      // 1
    pub is_active: bool,                     // 1
    pub created_by: Pubkey,                  // 32
    pub executed_by: Option<Pubkey>,         // 1 + 32
    pub executed_at: Option<i64>,            // 1 + 8
    pub proposal_category: ProposalCategory, // 1
    pub max_voters: u64,                     // 8
    pub current_voters: u64,                 // 8
    pub vote_record: Pubkey,                 // 32
}

#[account]
#[derive(Default)]
pub struct VoteRecord {
    pub proposal_id: u64,         // 8
    pub total_for_votes: u64,     // 8
    pub total_against_votes: u64, // 8
    pub total_voters: u64,        // 8
    pub voters: Vec<Pubkey>,      // 4 + (32 * MAX_VOTERS_PER_PROPOSAL)
    pub vote_types: Vec<bool>,    // 4 + (1 * MAX_VOTERS_PER_PROPOSAL)
}

// 2. ADD TREASURY ACCOUNT STRUCT (with other account structs)
#[account]
#[derive(Default)]
pub struct TreasuryConfig {
    pub treasury_wallet: Pubkey,  // 32
    pub last_mint_timestamp: i64, // 8
    pub total_minted: u64,        // 8
    pub authority: Pubkey,        // 32
}

//────────────────────────────────────────────────────────────────────────────
// ENUMS
//────────────────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Debug)]
#[repr(u8)]
pub enum ProposalCategory {
    EmergencyCircuitBreaker,
    TreasuryFundMove, // Changed from TreasuryFundRemove
    YearlyCap,
    TransferFee,
}

impl Default for ProposalCategory {
    fn default() -> Self {
        ProposalCategory::EmergencyCircuitBreaker
    }
}

//────────────────────────────────────────────────────────────────────────────
// EVENTS
//────────────────────────────────────────────────────────────────────────────

#[event]
pub struct GovernanceConfigInitialized {
    pub authority: Pubkey,
    pub apm_mint: Pubkey,
    pub dao_end_time: i64,
    pub timestamp: i64,
}

#[event]
pub struct ConfigUpdated {
    pub updated_by: Pubkey,
    pub dao_end_time: i64,
    pub timestamp: i64,
}

#[event]
pub struct ProposalCreated {
    pub proposal_id: u64,
    pub category: ProposalCategory,
    pub title: String,
    pub created_by: Pubkey,
    pub start_time: i64,
    pub end_time: i64,
    pub max_voters: u64,
    pub timestamp: i64,
}

#[event]
pub struct VoteCast {
    pub proposal_id: u64,
    pub voter: Pubkey,
    pub vote_type: bool,
    pub for_votes: u64,
    pub against_votes: u64,
    pub current_voters: u64,
    pub timestamp: i64,
}

#[event]
pub struct ProposalExecuted {
    pub proposal_id: u64,
    pub category: ProposalCategory,
    pub for_votes: u64,
    pub against_votes: u64,
    pub executed_by: Pubkey,
    pub executed_at: i64,
}

#[event]
pub struct ProposalCancelled {
    pub proposal_id: u64,
    pub cancelled_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ProposalCreatorAdded {
    pub added_creator: Pubkey,
    pub added_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ProposalCreatorRemoved {
    pub removed_creator: Pubkey,
    pub removed_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct TreasuryMinted {
    pub proposal_id: u64,
    pub mint_amount: u64,
    pub treasury_wallet: Pubkey,
    pub total_minted: u64,
    pub timestamp: i64,
}

// Event for proposal end time updates
#[event]
pub struct ProposalEndtimeUpdated {
    pub proposal_id: u64,
    pub old_end_time: i64,
    pub new_end_time: i64,
    pub updated_by: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct TreasuryFundsMoved {
    pub proposal_id: u64,
    pub from_wallet: Pubkey,
    pub to_wallet: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

//────────────────────────────────────────────────────────────────────────────
// CONTEXT STRUCTS
//────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        seeds = [b"governance_config"],
        bump,
        payer = authority,
        space = 8 + 32 + 8 + 8 + 32 + 8 + 8 + 8 + 4 + (32 * MAX_PROPOSAL_CREATORS)
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    #[account(mut)]
    pub apm_mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"governance_config"],
        bump,
    )]
    pub governance_config: Account<'info, GovernanceConfig>,
    pub authority: Signer<'info>,
}

// Context struct for update_proposal_endtime
#[derive(Accounts)]
pub struct UpdateProposalEndtime<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,

    #[account(
        seeds = [b"governance_config"],
        bump,
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ManageProposalCreators<'info> {
    #[account(
        mut,
        seeds = [b"governance_config"],
        bump,
    )]
    pub governance_config: Account<'info, GovernanceConfig>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 8 + 4 + MAX_TITLE_LENGTH + 4 + MAX_DESCRIPTION_LENGTH + 8 + 8 + 8 + 8 + 1 + 1 + 32 + 1 + 32 + 1 + 8 + 1 + 8 + 8 + 32
    )]
    pub proposal: Account<'info, Proposal>,

    #[account(
        mut,
        seeds = [b"governance_config"],
        bump,
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    #[account(
        init,
        payer = authority,
        space = 8 + 8 + 8 + 8 + 8 + 4 + (32 * MAX_VOTERS_PER_PROPOSAL) + 4 + (1 * MAX_VOTERS_PER_PROPOSAL)
    )]
    pub vote_record: Account<'info, VoteRecord>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CastVote<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    #[account(
        seeds = [b"governance_config"],
        bump,
    )]
    pub governance_config: Account<'info, GovernanceConfig>,
    #[account(
        mut,
        constraint = vote_record.key() == proposal.vote_record @ GovernanceError::InvalidVoteRecord
    )]
    pub vote_record: Account<'info, VoteRecord>,
    #[account(mut)]
    pub voter: Signer<'info>,
}

// Replace the ExecuteProposal context struct:

// Replace the ExecuteProposal context struct with this fixed version:

#[derive(Accounts)]
pub struct ExecuteProposal<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,

    #[account(
        mut,
        seeds = [b"governance_config"],
        bump,
    )]
    pub governance_config: Account<'info, GovernanceConfig>,

    #[account(
        mut,
        constraint = vote_record.key() == proposal.vote_record @ GovernanceError::InvalidVoteRecord
    )]
    pub vote_record: Account<'info, VoteRecord>,

    #[account(mut)]
    pub authority: Signer<'info>,

    // Accounts for YearlyCap proposals (can be dummy accounts for other proposal types)
    #[account(
        init_if_needed,
        seeds = [b"treasury_config"],
        bump,
        payer = authority,
        space = 8 + 32 + 8 + 8 + 32
    )]
    pub treasury_config: Account<'info, TreasuryConfig>,

    #[account(mut)]
    pub treasury_wallet: InterfaceAccount<'info, TokenAccount>,

    // Accounts for TreasuryFundMove proposals (can be dummy accounts for other proposal types)
    #[account(mut)]
    pub treasury_wallet_swap: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub allocated_treasury_wallet: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub apm_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelProposal<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    #[account(
        mut,
        seeds = [b"governance_config"],
        bump,
    )]
    pub governance_config: Account<'info, GovernanceConfig>,
    #[account(
        mut,
        constraint = vote_record.key() == proposal.vote_record @ GovernanceError::InvalidVoteRecord
    )]
    pub vote_record: Account<'info, VoteRecord>,
    #[account(mut)]
    pub signer: Signer<'info>,
}

//────────────────────────────────────────────────────────────────────────────
// ERROR TYPES
//────────────────────────────────────────────────────────────────────────────

#[error_code]
pub enum GovernanceError {
    #[msg("DAO duration must be at least 1 day")]
    DaoDurationTooShort,
    #[msg("DAO duration cannot exceed 1 year")]
    DaoDurationTooLong,
    #[msg("Maximum voters per proposal cannot exceed 1000")]
    MaxVotersExceeded,
    #[msg("Maximum active proposals cannot exceed 10")]
    MaxActiveProposalsExceeded,
    #[msg("DAO has expired")]
    DaoExpired,
    #[msg("Unauthorized to update configuration")]
    UnauthorizedUpdate,
    #[msg("Creator is already whitelisted")]
    CreatorAlreadyWhitelisted,
    #[msg("Creator is not whitelisted")]
    CreatorNotWhitelisted,
    #[msg("Cannot remove the last creator from whitelist")]
    CannotRemoveLastCreator,
    #[msg("Voting duration must be at least 1 hour")]
    VotingDurationTooShort,
    #[msg("Voting duration cannot exceed 30 days")]
    VotingDurationTooLong,
    #[msg("Title is too long (max 50 characters)")]
    TitleTooLong,
    #[msg("Description is too long (max 500 characters)")]
    DescriptionTooLong,
    #[msg("Too many voters specified for this proposal")]
    TooManyVoters,
    #[msg("Too many active proposals (max 10)")]
    TooManyActiveProposals,
    #[msg("Invalid proposal category")]
    InvalidProposalCategory,
    #[msg("Proposal is not active")]
    ProposalNotActive,
    #[msg("Invalid voting time window")]
    InvalidVotingTime,
    #[msg("Voter is not whitelisted")]
    VoterNotWhitelisted,
    #[msg("Already voted on this proposal")]
    AlreadyVoted,
    #[msg("Maximum voters reached for this proposal")]
    MaxVotersReached,
    #[msg("Voting calculation overflow")]
    VotingOverflow,
    #[msg("Insufficient tokens to vote")]
    InsufficientTokens,
    #[msg("Voting is still active")]
    VotingStillActive,
    #[msg("Proposal has already been executed")]
    ProposalAlreadyExecuted,
    #[msg("Proposal did not pass")]
    ProposalNotPassed,
    #[msg("Account close operation overflow")]
    AccountCloseOverflow,
    #[msg("Unauthorized to cancel proposal")]
    UnauthorizedCancel,
    #[msg("Invalid vote record")]
    InvalidVoteRecord,
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    #[msg("Invalid token owner")]
    InvalidTokenOwner,
    #[msg("Yearly cap period not reached yet")]
    YearlyCapNotReached,
    #[msg("Mint calculation overflow")]
    MintCalculationOverflow,
    #[msg("Invalid treasury mint - treasury wallet must be for the APM token")]
    InvalidTreasuryMint,
    #[msg("Invalid mint amount")]
    InvalidMintAmount,
    #[msg("Governance config must be the mint authority")]
    InvalidMintAuthority,
    #[msg("Treasury config account is required for YearlyCap proposals")]
    MissingTreasuryConfig,
    #[msg("Treasury wallet account is required for YearlyCap proposals")]
    MissingTreasuryWallet,
    #[msg("Treasury wallet swap account is required for TreasuryFundMove proposals")]
    MissingTreasuryWalletSwap,
    #[msg("Allocated treasury wallet account is required for TreasuryFundMove proposals")]
    MissingAllocatedTreasuryWallet,
    #[msg("No funds available to transfer")]
    NoFundsToTransfer,
}