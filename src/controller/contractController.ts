import { Request, Response } from 'express';
import { getProvider, program } from '../utils/solanaClient';
import * as anchor from "@coral-xyz/anchor";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

export const initializeContract = async (req: Request, res: Response) => {
  try {
    const { authority, mint } = req.body;
    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      program.programId
    );

    await program.methods
      .initialize(new anchor.web3.PublicKey(authority))
      .accounts({
        config: configPda,
        mint: new anchor.web3.PublicKey(mint),
        payer: getProvider().wallet.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    res.status(200).json({ message: 'Contract initialized' });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

export const updatePrice = async (req: Request, res: Response) => {
  try {
    const { newPrice, authority } = req.body;
    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      program.programId
    );

    await program.methods
      .updatePrice(new anchor.BN(newPrice))
      .accounts({
        config: configPda,
        authority: new anchor.web3.PublicKey(authority),
      })
      .rpc();

    res.status(200).json({ message: 'Price updated' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const mintTokens = async (req: Request, res: Response) => {
  try {
    const { mint, destination, amount } = req.body;
    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      program.programId
    );

    await program.methods
      .mintTokens(new anchor.BN(amount))
      .accounts({
        config: configPda,
        mint: new anchor.web3.PublicKey(mint),
        destination: new anchor.web3.PublicKey(destination),
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    res.status(200).json({ message: 'Tokens minted' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const burnTokens = async (req: Request, res: Response) => {
  try {
    const { mint, source, amount, user } = req.body;
    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      program.programId
    );

    await program.methods
      .burnTokens(new anchor.BN(amount))
      .accounts({
        config: configPda,
        mint: new anchor.web3.PublicKey(mint),
        source: new anchor.web3.PublicKey(source),
        user: new anchor.web3.PublicKey(user),
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    res.status(200).json({ message: 'Tokens burned' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const transferWithFee = async (req: Request, res: Response) => {
  try {
    const { from, to, feeCollector, amount, authority } = req.body;
    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      program.programId
    );

    await program.methods
      .transferWithFee(new anchor.BN(amount))
      .accounts({
        config: configPda,
        from: new anchor.web3.PublicKey(from),
        to: new anchor.web3.PublicKey(to),
        feeCollector: feeCollector ? new anchor.web3.PublicKey(feeCollector) : null,
        authority: new anchor.web3.PublicKey(authority),
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    res.status(200).json({ message: 'Transfer with fee completed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const pauseContract = async (req: Request, res: Response) => {
  try {
    const { authority } = req.body;
    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      program.programId
    );

    await program.methods
      .pauseContract()
      .accounts({
        config: configPda,
        authority: new anchor.web3.PublicKey(authority),
      })
      .rpc();

    res.status(200).json({ message: 'Contract paused' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};

export const resumeContract = async (req: Request, res: Response) => {
  try {
    const { authority } = req.body;
    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from('config')],
      program.programId
    );

    await program.methods
      .resumeContract()
      .accounts({
        config: configPda,
        authority: new anchor.web3.PublicKey(authority),
      })
      .rpc();

    res.status(200).json({ message: 'Contract resumed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
};
