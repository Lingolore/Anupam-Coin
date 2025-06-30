import { IdlAccounts, IdlTypes } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';

export interface GovernanceConfig {
  apmMint: PublicKey;
  proposalCount: number;
  activeProposals: number;
  authority: PublicKey;
  daoEndTime: number;
  maxProposalsPerConfig: number;
  maxVotersPerProposal: number;
  proposalCreatorWhitelist: PublicKey[];
}

export interface Proposal {
  proposalId: number;
  title: string;
  description: string;
  startTime: number;
  endTime: number;
  forVotes: number;
  againstVotes: number;
  executed: boolean;
  isActive: boolean;
  createdBy: PublicKey;
  executedBy: PublicKey | null;
  executedAt: number | null;
  proposalCategory: number;
  maxVoters: number;
  currentVoters: number;
  voteRecord: PublicKey;
}

export interface VoteRecord {
  proposalId: number;
  totalForVotes: number;
  totalAgainstVotes: number;
  totalVoters: number;
  voters: PublicKey[];
  voteTypes: boolean[];
}

export interface TreasuryConfig {
  treasuryWallet: PublicKey;
  lastMintTimestamp: number;
  totalMinted: number;
  authority: PublicKey;
}

export type GovernanceAccounts = {
  governanceConfig: GovernanceConfig;
  proposal: Proposal;
  voteRecord: VoteRecord;
  treasuryConfig: TreasuryConfig;
};

export type GovernanceTypes = {
  ProposalCategory: {
    EmergencyCircuitBreaker: 0;
    TreasuryFundMove: 1;
    YearlyCap: 2;
    TransferFee: 3;
  };
};

declare module '@coral-xyz/anchor' {
  interface Program {
    account: {
      governanceConfig: IdlAccounts<GovernanceAccounts>['governanceConfig'];
      proposal: IdlAccounts<GovernanceAccounts>['proposal'];
      voteRecord: IdlAccounts<GovernanceAccounts>['voteRecord'];
      treasuryConfig: IdlAccounts<GovernanceAccounts>['treasuryConfig'];
    };
  }
} 