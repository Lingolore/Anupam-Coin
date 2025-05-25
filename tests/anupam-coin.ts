import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AnupamCoinWrapper } from "../target/types/anupam_coin_wrapper";
import { TOKEN_2022_PROGRAM_ID, createMint, createAccount, mintTo } from "@solana/spl-token";
import { assert } from "chai";

describe("anupam_coin_wrapper", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.AnupamCoinWrapper as Program<AnupamCoinWrapper>;

  let configPda: anchor.web3.PublicKey;
  let configBump: number;

  let mint: anchor.web3.PublicKey;
  let userAta: anchor.web3.PublicKey;
  let feeCollectorAta: anchor.web3.PublicKey;

  const user = provider.wallet;
  const connection = provider.connection;

  it("Initializes the wrapper", async () => {
    [configPda, configBump] = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    mint = await createMint(
      connection,
      user.payer,
      configPda,
      null,
      6, // decimals
      undefined,
      { programId: TOKEN_2022_PROGRAM_ID }
    );

    userAta = await createAccount(connection, user.payer, mint, user.publicKey, undefined, {
      programId: TOKEN_2022_PROGRAM_ID,
    });

    feeCollectorAta = await createAccount(connection, user.payer, mint, user.publicKey, undefined, {
      programId: TOKEN_2022_PROGRAM_ID,
    });

    await program.methods
      .initialize(user.publicKey)
      .accounts({
        config: configPda,
        mint: mint,
        payer: user.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .signers([])
      .rpc();

    const config = await program.account.configAccount.fetch(configPda);
    assert.equal(config.authority.toBase58(), user.publicKey.toBase58());
    assert.equal(config.mint.toBase58(), mint.toBase58());
    assert.equal(config.currentPrice.toNumber(), 1_000_000);
  });

  it("Updates the price", async () => {
    await program.methods
      .updatePrice(new anchor.BN(1_100_000)) // $1.10
      .accounts({
        config: configPda,
        authority: user.publicKey,
      })
      .rpc();

    const config = await program.account.configAccount.fetch(configPda);
    assert.equal(config.currentPrice.toNumber(), 1_100_000);
  });

  it("Mints tokens", async () => {
    await program.methods
      .mintTokens(new anchor.BN(1_000_000))
      .accounts({
        config: configPda,
        mint: mint,
        destination: userAta,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    const balance = await connection.getTokenAccountBalance(userAta);
    assert.equal(balance.value.uiAmountString, "1.000000");
  });

  it("Burns tokens", async () => {
    await program.methods
      .burnTokens(new anchor.BN(500_000))
      .accounts({
        config: configPda,
        mint: mint,
        source: userAta,
        user: user.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    const balance = await connection.getTokenAccountBalance(userAta);
    assert.equal(balance.value.uiAmountString, "0.500000");
  });

  it("Transfers with fee", async () => {
    await program.methods
      .transferWithFee(new anchor.BN(500_000)) // Transfers full balance
      .accounts({
        config: configPda,
        from: userAta,
        to: feeCollectorAta,
        feeCollector: feeCollectorAta,
        authority: user.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    const mainBal = await connection.getTokenAccountBalance(userAta);
    const feeBal = await connection.getTokenAccountBalance(feeCollectorAta);
    assert.equal(mainBal.value.uiAmount, 0);
    assert.equal(feeBal.value.uiAmount, 0.0015); // 0.3% of 500_000 = 1500 micro = 0.0015
  });

  it("Pauses and resumes the contract", async () => {
    await program.methods
      .pauseContract()
      .accounts({
        config: configPda,
        authority: user.publicKey,
      })
      .rpc();

    let config = await program.account.configAccount.fetch(configPda);
    assert.equal(config.isPaused, true);

    await program.methods
      .resumeContract()
      .accounts({
        config: configPda,
        authority: user.publicKey,
      })
      .rpc();

    config = await program.account.configAccount.fetch(configPda);
    assert.equal(config.isPaused, false);
  });
});
