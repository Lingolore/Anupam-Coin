import * as anchor from "@coral-xyz/anchor";
// import { AnupamCoinWrapper } from "../../target/types/anupam_coin_wrapper";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";

const keypair = anchor.web3.Keypair.fromSecretKey(new Uint8Array());
const connection = new anchor.web3.Connection("https://api.devnet.solana.com");
const provider :any  = new anchor.AnchorProvider(connection, new anchor.Wallet(keypair), {});
anchor.setProvider(provider);

const idl = require("../../target/idl/anupam_coin_wrapper.json");
const programId : any = new anchor.web3.PublicKey(idl.metadata.address);

export const program = new anchor.Program(idl, programId, provider);
export const getProvider = () => provider;
