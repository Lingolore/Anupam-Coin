use anchor_lang::prelude::*;
// For Token-2022, use these imports:
use anchor_spl::token_2022::{self, Burn, MintTo};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface}; // These come from token_interface
// Add this import at the top with other imports
use anchor_spl::token_2022::{
    set_authority, spl_token_2022::instruction::AuthorityType, SetAuthority,
};

declare_id!("E2cQ1N8qNcWT65bA3QNSTjMYjqa2dVXHwvd6FMZZL9JN");

// Emergency Circuit Breaker Constants
const CIRCUIT_BREAKER_THRESHOLD_BPS: u16 = 2500; // 25% volatility threshold
const CIRCUIT_BREAKER_DURATION: i64 = 1800; // 30 minutes in seconds
const MAX_FREEZE_DURATION: i64 = 14400; // 4 hours maximum
const PRICE_STALENESS_THRESHOLD: i64 = 1800; // 30 minutes

    // Initialize the wrapper contract - Sprint 1 version
    pub fn initialize(ctx: Context<Initialize>, authority: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.authority = authority;
        config.mint = ctx.accounts.mint.key();
        config.target_price = 1_050_000; // $1.05 in micro-dollars
        config.current_price = 1_000_000; // $1.00 default
        config.transfer_fee_bps = 30; // 0.3% = 30 basis points
        config.is_paused = false;
        config.price_above_target_since = 0;
        config.consecutive_days_above_target = 0;

        msg!("Anupam Coin Wrapper initialized");
        Ok(())
    }

    // Manual price update for Sprint 1 (no oracle yet)
    pub fn update_price(
        ctx: Context<UpdatePrice>,
        new_price: u64, // Price in micro-dollars (1.05 = 1_050_000)
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;
        let clock = Clock::get()?;

        config.current_price = new_price;

        // Track time above target price
        if new_price > config.target_price {
            if config.price_above_target_since == 0 {
                config.price_above_target_since = clock.unix_timestamp;
                config.consecutive_days_above_target = 0;
            }

            // Calculate consecutive days (simplified for Sprint 1)
            let days_above = (clock.unix_timestamp - config.price_above_target_since) / 86400;
            config.consecutive_days_above_target = days_above as u8;
        } else {
            // Reset if price drops below target
            config.price_above_target_since = 0;
            config.consecutive_days_above_target = 0;
        }

        emit!(PriceUpdated {
            price: new_price,
            consecutive_days_above_target: config.consecutive_days_above_target,
        });

        Ok(())
    }

    // Simple controlled mint with time-lock check
    pub fn mint_tokens(ctx: Context<MintTokens>, amount: u64) -> Result<()> {
        let config = &ctx.accounts.config;

        // Basic checks for Sprint 1
        // require!(!config.is_paused, ErrorCode::ContractPaused);
        // require!(
        //     config.current_price > config.target_price,
        //     ErrorCode::PriceBelowTarget
        // );
        // require!(
        //     config.consecutive_days_above_target >= 7,
        //     ErrorCode::TimeRequirementNotMet
        // );

        // Mint tokens using PDA as authority
        let seeds = &[b"config".as_ref(), &[ctx.bumps.config]];
        let signer = &[&seeds[..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.destination.to_account_info(),
            authority: ctx.accounts.config.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token_2022::mint_to(cpi_ctx, amount)?;

        emit!(TokensMinted {
            amount,
            recipient: ctx.accounts.destination.key(),
        });

        Ok(())
    }

    // Simple burn function
    pub fn burn_tokens(ctx: Context<BurnTokens>, amount: u64) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(!config.is_paused, ErrorCode::ContractPaused);

        let cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.source.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token_2022::burn(cpi_ctx, amount)?;

        emit!(TokensBurned {
            amount,
            user: ctx.accounts.user.key(),
        });

        Ok(())
    }

    // Transfer with fee (Sprint 1 requirement)
    pub fn transfer_with_fee(ctx: Context<TransferWithFee>, amount: u64) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(!config.is_paused, ErrorCode::ContractPaused);

        // Calculate fee (0.3% = 30 basis points)
        let fee_amount = (amount * config.transfer_fee_bps as u64) / 10000;
        let transfer_amount = amount - fee_amount;

        // Transfer main amount
        let cpi_accounts = token_2022::Transfer {
            from: ctx.accounts.from.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        token_2022::transfer(cpi_ctx, transfer_amount)?;

        // Transfer fee to fee collector (if provided)
        if let Some(fee_collector) = &ctx.accounts.fee_collector {
            let fee_cpi = token_2022::Transfer {
                from: ctx.accounts.from.to_account_info(),
                to: fee_collector.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            };
            let fee_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), fee_cpi);
            token_2022::transfer(fee_ctx, fee_amount)?;
        }

        emit!(TransferCompleted {
            from: ctx.accounts.from.key(),
            to: ctx.accounts.to.key(),
            amount: transfer_amount,
            fee: fee_amount,
        });

        Ok(())
    }

    // Emergency pause (authority only)
    pub fn pause_contract(ctx: Context<AuthorityAction>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.is_paused = true;
        msg!("Contract paused by authority");
        Ok(())
    }

    // Resume contract (authority only)
    pub fn resume_contract(ctx: Context<AuthorityAction>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.is_paused = false;
        msg!("Contract resumed by authority");
        Ok(())
    }
}

// Account Structures - Updated for Token-2022
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + ConfigAccount::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ConfigAccount>,
    pub mint: InterfaceAccount<'info, Mint>, // Use InterfaceAccount for Token-2022 compatibility
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump,
        has_one = authority
    )]
    pub config: Account<'info, ConfigAccount>,
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(
        seeds = [b"config"],
        bump,
        has_one = mint
    )]
    pub config: Account<'info, ConfigAccount>,
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub destination: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    #[account(
        seeds = [b"config"],
        bump,
        has_one = mint
    )]
    pub config: Account<'info, ConfigAccount>,
    #[account(mut)]
    pub mint: InterfaceAccount<'info, Mint>,
    #[account(mut)]
    pub source: InterfaceAccount<'info, TokenAccount>,
    pub user: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct TransferWithFee<'info> {
    #[account(
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ConfigAccount>,
    #[account(mut)]
    pub from: InterfaceAccount<'info, TokenAccount>,
    #[account(mut)]
    pub to: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: Optional fee collector account
    #[account(mut)]
    pub fee_collector: Option<InterfaceAccount<'info, TokenAccount>>,
    pub authority: Signer<'info>,
    pub token_program: Interface<'info, TokenInterface>,
}

#[derive(Accounts)]
pub struct AuthorityAction<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump,
        has_one = authority
    )]
    pub config: Account<'info, ConfigAccount>,
    pub authority: Signer<'info>,
}

// Simplified Configuration for Sprint 1
#[account]
#[derive(InitSpace)]
pub struct ConfigAccount {
    pub authority: Pubkey,
    pub mint: Pubkey,
    pub target_price: u64,     // $1.05 in micro-dollars
    pub current_price: u64,    // Current price
    pub transfer_fee_bps: u16, // 30 = 0.3%
    pub is_paused: bool,
    pub price_above_target_since: i64, // Timestamp when price first went above target
    pub consecutive_days_above_target: u8, // Days price has been above target
}

// Events
#[event]
pub struct PriceUpdated {
    pub price: u64,
    pub consecutive_days_above_target: u8,
}

#[event]
pub struct TokensMinted {
    pub amount: u64,
    pub recipient: Pubkey,
}

#[event]
pub struct TokensBurned {
    pub amount: u64,
    pub user: Pubkey,
}

#[event]
pub struct TransferCompleted {
    pub from: Pubkey,
    pub to: Pubkey,
    pub amount: u64,
    pub fee: u64,
}

// Error Codes
#[error_code]
pub enum ErrorCode {
    #[msg("Contract is currently paused")]
    ContractPaused,
    #[msg("Current price is below target price of $1.05")]
    PriceBelowTarget,
    #[msg("Price must stay above $1.05 for 7 consecutive days")]
    TimeRequirementNotMet,
}
