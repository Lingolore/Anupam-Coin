use anchor_lang::prelude::*;
use anchor_spl::{
    token::{self, Mint, Token, TokenAccount, Transfer},
    associated_token::AssociatedToken,
};
use std::ops::Deref;

declare_id!("6qSoMSj9qsZW3LHCLDgnC6DY8SQbTEUpyryEDztW9EzX");

// Constants
const DAYS_THRESHOLD: u8 = 7; // 7 days above threshold
const PRICE_THRESHOLD: u64 = 105_000_000; // $1.05 with 8 decimals
const MIN_RESERVE_RATIO: u8 = 110; // 110% minimum reserve ratio
const TRANSFER_FEE_NUMERATOR: u64 = 3;
const TRANSFER_FEE_DENOMINATOR: u64 = 1000; // 0.3% fee
const MAX_PRICE_HISTORY: usize = 30; // Store 30 days of price data

#[program]
pub mod anupam_coin {
    use super::*;

    // Initialize the token and state accounts
    pub fn initialize(ctx: Context<Initialize>, bump: u8) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.authority = ctx.accounts.authority.key();
        state.mint = ctx.accounts.mint.key();
        state.reserve_mint = ctx.accounts.reserve_mint.key();
        state.reserve_ratio = 0; // Start with 0 reserve ratio
        state.price_history = Vec::new();
        state.price_timestamp_history = Vec::new();
        state.latest_price = 0;
        state.days_above_threshold = 0;
        state.bump = bump;
        
        msg!("Anupam Coin initialized with authority: {:?}", state.authority);
        msg!("Token mint: {:?}", state.mint);
        msg!("Reserve mint: {:?}", state.reserve_mint);
        
        Ok(())
    }

    // Update price data
    pub fn update_price(
        ctx: Context<UpdatePrice>,
        new_price: u64,
        timestamp: i64
    ) -> Result<()> {
        let state = &mut ctx.accounts.state;
        
        // Check if caller is the oracle authority
        require!(
            ctx.accounts.authority.key() == state.authority,
            AnupamCoinError::UnauthorizedPriceUpdate
        );
        
        // Add price to history (keeping the last MAX_PRICE_HISTORY prices)
        if state.price_history.len() >= MAX_PRICE_HISTORY {
            state.price_history.remove(0);
            state.price_timestamp_history.remove(0);
        }
        
        state.price_history.push(new_price);
        state.price_timestamp_history.push(timestamp);
        state.latest_price = new_price;
        
        // Update days above threshold
        if new_price >= PRICE_THRESHOLD {
            state.days_above_threshold = state.days_above_threshold.saturating_add(1);
        } else {
            state.days_above_threshold = 0; // Reset counter if price drops below threshold
        }
        
        msg!("Price updated to: {}", new_price);
        msg!("Days above threshold: {}", state.days_above_threshold);
        
        Ok(())
    }

    // Update reserve ratio
    pub fn update_reserve_ratio(
        ctx: Context<UpdateReserveRatio>,
        new_ratio: u8
    ) -> Result<()> {
        let state = &mut ctx.accounts.state;
        
        // Check if caller is the authority
        require!(
            ctx.accounts.authority.key() == state.authority,
            AnupamCoinError::Unauthorized
        );
        
        state.reserve_ratio = new_ratio;
        msg!("Reserve ratio updated to: {}%", new_ratio);
        
        Ok(())
    }

    // Mint tokens (with time-lock and reserve ratio checks)
    pub fn mint(
        ctx: Context<MintTokens>, 
        amount: u64
    ) -> Result<()> {
        let state = &ctx.accounts.state;
        
        // Check price threshold condition
        require!(
            state.days_above_threshold >= DAYS_THRESHOLD,
            AnupamCoinError::PriceConditionNotMet
        );
        
        // Check reserve ratio condition
        require!(
            state.reserve_ratio >= MIN_RESERVE_RATIO,
            AnupamCoinError::InsufficientReserveRatio
        );
        
        // Check if caller is the authority
        require!(
            ctx.accounts.authority.key() == state.authority,
            AnupamCoinError::Unauthorized
        );
        
        // CPI to mint tokens
        let seeds = &[
            b"state".as_ref(),
            state.mint.as_ref(),
            &[state.bump],
        ];
        let signer = &[&seeds[..]];
        
        let cpi_accounts = token::MintTo {
            mint: ctx.accounts.mint.to_account_info(),
            to: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.state.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        
        token::mint_to(cpi_ctx, amount)?;
        
        msg!("Minted {} tokens to {}", amount, ctx.accounts.token_account.key());
        
        Ok(())
    }

    // Burn tokens
    pub fn burn(
        ctx: Context<BurnTokens>, 
        amount: u64
    ) -> Result<()> {
        // Anyone can burn their own tokens
        let cpi_accounts = token::Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        
        token::burn(cpi_ctx, amount)?;
        
        msg!("Burned {} tokens from {}", amount, ctx.accounts.token_account.key());
        
        Ok(())
    }

    // Transfer tokens with fee
    pub fn transfer(
        ctx: Context<TransferTokens>, 
        amount: u64
    ) -> Result<()> {
        // Calculate fee amount
        let fee_amount = amount
            .checked_mul(TRANSFER_FEE_NUMERATOR)
            .unwrap()
            .checked_div(TRANSFER_FEE_DENOMINATOR)
            .unwrap();
        
        let transfer_amount = amount.checked_sub(fee_amount).unwrap();
        
        // Transfer to recipient
        let transfer_accounts = Transfer {
            from: ctx.accounts.from.to_account_info(),
            to: ctx.accounts.to.to_account_info(),
            authority: ctx.accounts.owner.to_account_info(),
        };
        
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let transfer_ctx = CpiContext::new(cpi_program.clone(), transfer_accounts);
        
        token::transfer(transfer_ctx, transfer_amount)?;
        
        // Transfer fee to fee account
        if fee_amount > 0 {
            let fee_transfer_accounts = Transfer {
                from: ctx.accounts.from.to_account_info(),
                to: ctx.accounts.fee_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            };
            
            let fee_transfer_ctx = CpiContext::new(cpi_program, fee_transfer_accounts);
            token::transfer(fee_transfer_ctx, fee_amount)?;
        }
        
        msg!("Transferred {} tokens with {} fee", transfer_amount, fee_amount);
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub mint: Account<'info, Mint>,
    
    pub reserve_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 32 + 1 + 4 + (MAX_PRICE_HISTORY * 8) + 4 + (MAX_PRICE_HISTORY * 8) + 8 + 1 + 1,
        seeds = [b"state", mint.key().as_ref()],
        bump
    )]
    pub state: Account<'info, AnupamCoinState>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct UpdatePrice<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"state", state.mint.as_ref()],
        bump = state.bump
    )]
    pub state: Account<'info, AnupamCoinState>,
}

#[derive(Accounts)]
pub struct UpdateReserveRatio<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"state", state.mint.as_ref()],
        bump = state.bump
    )]
    pub state: Account<'info, AnupamCoinState>,
}

#[derive(Accounts)]
pub struct MintTokens<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        seeds = [b"state", mint.key().as_ref()],
        bump = state.bump
    )]
    pub state: Account<'info, AnupamCoinState>,
    
    #[account(
        mut,
        address = state.mint
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = recipient
    )]
    pub token_account: Account<'info, TokenAccount>,
    
    /// CHECK: Not reading from this account
    pub recipient: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct BurnTokens<'info> {
    pub owner: Signer<'info>,
    
    #[account(
        mut,
        address = state.mint
    )]
    pub mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner
    )]
    pub token_account: Account<'info, TokenAccount>,
    
    #[account(
        seeds = [b"state", mint.key().as_ref()],
        bump = state.bump
    )]
    pub state: Account<'info, AnupamCoinState>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TransferTokens<'info> {
    pub owner: Signer<'info>,
    
    #[account(
        mut,
        constraint = from.owner == owner.key() @ AnupamCoinError::Unauthorized
    )]
    pub from: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub to: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub fee_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[account]
pub struct AnupamCoinState {
    pub authority: Pubkey,          // Authority that can mint, update prices, etc.
    pub mint: Pubkey,               // The token mint address
    pub reserve_mint: Pubkey,       // Reserve asset mint address
    pub reserve_ratio: u8,          // Reserve ratio in percentage (e.g. 110 for 110%)
    pub price_history: Vec<u64>,    // Price history with 8 decimal places
    pub price_timestamp_history: Vec<i64>, // Timestamps for price entries
    pub latest_price: u64,          // Latest price
    pub days_above_threshold: u8,   // Number of consecutive days above threshold
    pub bump: u8,                   // PDA bump
}

#[error_code]
pub enum AnupamCoinError {
    #[msg("You are not authorized to perform this action")]
    Unauthorized,
    
    #[msg("Price conditions not met for minting")]
    PriceConditionNotMet,
    
    #[msg("Insufficient reserve ratio for minting")]
    InsufficientReserveRatio,
    
    #[msg("Unauthorized price update")]
    UnauthorizedPriceUpdate,
    
    #[msg("Invalid price data")]
    InvalidPriceData,
    
    #[msg("Arithmetic error")]
    ArithmeticError,
}
