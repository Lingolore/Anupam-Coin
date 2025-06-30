import { Connection, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import { useWallet } from '@/contexts/wallet-context';
import IDL from '../abi/dao.json';


// Constants
const PROGRAM_ID  = new PublicKey(process.env.NEXT_PUBLIC_DAO_PROGRAM_ID as any  );

// Types
export enum ProposalCategory {
  EmergencyCircuitBreaker = 0,
  TreasuryFundMove = 1,
  YearlyCap = 2,
  TransferFee = 3,
}

interface CreateProposalParams {
  title: string;
  description: string;
  votingDurationSeconds: number;
  category: ProposalCategory;
  maxVoters: number;
}

interface VoteParams {
  proposalId: number;
  vote: boolean;
}

interface PhantomWallet {
  isPhantom: boolean;
  publicKey: PublicKey | null;
  isConnected: boolean;
  connect(): Promise<{ publicKey: PublicKey }>;
  disconnect(): Promise<void>;
  signTransaction(transaction: Transaction): Promise<Transaction>;
  signAllTransactions(transactions: Transaction[]): Promise<Transaction[]>;
  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>;
}

// Helper Functions
export const getGovernanceConfigPDA = async () => {
  const [pda] = await PublicKey.findProgramAddressSync(
    [Buffer.from('governance_config')],
    PROGRAM_ID
  );
  return pda;
};

// export const voteRecordPDA = async () => {
//   const [pda] = await PublicKey.findProgramAddressSync(
//     [Buffer.from('vote_record')],
//     PROGRAM_ID
//   );
//   return pda;
// }

export const getProposalPDA = async (proposalId: number) => {
  const [pda] = await PublicKey.findProgramAddressSync(
    [Buffer.from('proposal'), new Uint8Array([proposalId])],
    PROGRAM_ID
  );
  return pda;
};

export const getVoteRecordPDA = async (proposalId: number) => {
  const [pda] = await PublicKey.findProgramAddressSync(
    [Buffer.from('vote_record'), new Uint8Array([proposalId])],
    PROGRAM_ID
  );
  return pda;
};

// Main Functions
export const createProposal = async (
  connection: Connection,
  wallet: PhantomWallet,
  params: CreateProposalParams
) => {
  try {
    if (!wallet.publicKey) throw new Error('Wallet public key is null');
    
    const provider = new AnchorProvider(connection, wallet as any, {});
    const program = new Program(IDL, provider);

    const governanceConfigPDA = await getGovernanceConfigPDA();
    const proposalPDA = await getProposalPDA(0); // You'll need to get the next proposal ID
    const voteRecordPDA = await getVoteRecordPDA(0);

    const tx = await program.methods
      .createProposal(
        params.title,
        params.description,
        params.votingDurationSeconds,
        params.category,
        params.maxVoters
      )
      .accounts({
        proposal: proposalPDA,
        governanceConfig: governanceConfigPDA,
        voteRecord: voteRecordPDA,
        authority: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { success: true, tx };
  } catch (error) {
    console.error('Error creating proposal:', error);
    return { success: false, error };
  }
};

export const castVote = async (
  connection: Connection,
  wallet: PhantomWallet,
  params: VoteParams
) => {
  try {
    if (!wallet.publicKey) throw new Error('Wallet public key is null');
    
    const provider = new AnchorProvider(connection, wallet as any, {});
    const program = new Program(IDL as any , provider);

    const governanceConfigPDA = await getGovernanceConfigPDA();
    const proposalPDA = await getProposalPDA(params.proposalId);
    const voteRecordPDA = await getVoteRecordPDA(params.proposalId);

    const tx = await program.methods
      .castVote(params.vote)
      .accounts({
        proposal: proposalPDA,
        governanceConfig: governanceConfigPDA,
        voteRecord: voteRecordPDA,
        voter: wallet.publicKey,
      })
      .rpc();

    return { success: true, tx };
  } catch (error) {
    console.error('Error casting vote:', error);
    return { success: false, error };
  }
};

export const checkWhitelistStatus = async (
  connection: Connection,
  wallet: PhantomWallet
) => {
  try {
    if (!wallet.publicKey) throw new Error('Wallet public key is null');
    
    const provider = new AnchorProvider(connection, wallet as any, {});
    const program = new Program(IDL as any , provider);

    const governanceConfigPDA = await getGovernanceConfigPDA();
    console.log(governanceConfigPDA);
    // const result = await program.account.(governanceConfigPDA);
    // const governanceConfig = await program.account.methods.fetch(governanceConfigPDA);

    // return governanceConfig.proposalCreatorWhitelist.includes(wallet.publicKey);
  } catch (error) {
    console.error('Error checking whitelist status:', error);
    return false;
  }
};

export const executeProposal = async (
  connection: Connection,
  wallet: PhantomWallet,
  proposalId: number
) => {
  try {
    if (!wallet.publicKey) throw new Error('Wallet public key is null');
    
    const provider = new AnchorProvider(connection, wallet as any, {});
    const program = new Program(IDL, provider);

    const governanceConfigPDA = await getGovernanceConfigPDA();
    const proposalPDA = await getProposalPDA(proposalId);
    const voteRecordPDA = await getVoteRecordPDA(proposalId);

    const tx = await program.methods
      .executeProposal()
      .accounts({
        proposal: proposalPDA,
        governanceConfig: governanceConfigPDA,
        voteRecord: voteRecordPDA,
        authority: wallet.publicKey,
      })
      .rpc();

    return { success: true, tx };
  } catch (error) {
    console.error('Error executing proposal:', error);
    return { success: false, error };
  }
};

export const cancelProposal = async (
  connection: Connection,
  wallet: PhantomWallet,
  proposalId: number
) => {
  try {
    if (!wallet.publicKey) throw new Error('Wallet public key is null');
    
    const provider = new AnchorProvider(connection, wallet as any, {});
    const program = new Program(IDL as any , provider);

    const governanceConfigPDA = await getGovernanceConfigPDA();
    const proposalPDA = await getProposalPDA(proposalId);
    const voteRecordPDA = await getVoteRecordPDA(proposalId);

    const tx = await program.methods
      .cancelProposal()
      .accounts({
        proposal: proposalPDA,
        governanceConfig: governanceConfigPDA,
        voteRecord: voteRecordPDA,
        signer: wallet.publicKey,
      })
      .rpc();

    return { success: true, tx };
  } catch (error) {
    console.error('Error canceling proposal:', error);
    return { success: false, error };
  }
};

// Hook for using DAO functions
export const useDao = () => {
  const { wallet, connected, walletAddress, connection } = useWallet();

  const createNewProposal = async (params: CreateProposalParams) => {
    if (!connected || !wallet) throw new Error('Wallet not connected');
    return createProposal(connection, wallet, params);
  };

  const voteOnProposal = async (params: VoteParams) => {
    if (!connected || !wallet) throw new Error('Wallet not connected');
    return castVote(connection, wallet, params);
  };

  const checkIsWhitelisted = async () => {
    if (!connected || !wallet) return false;
    return checkWhitelistStatus(connection, wallet);
  };

  const executeProposalAction = async (proposalId: number) => {
    if (!connected || !wallet) throw new Error('Wallet not connected');
    return executeProposal(connection, wallet, proposalId);
  };

  const cancelProposalAction = async (proposalId: number) => {
    if (!connected || !wallet) throw new Error('Wallet not connected');
    return cancelProposal(connection, wallet, proposalId);
  };

  return {
    createNewProposal,
    voteOnProposal,
    checkIsWhitelisted,
    executeProposalAction,
    cancelProposalAction,
    isConnected: connected,
    walletAddress,
  };
}; 