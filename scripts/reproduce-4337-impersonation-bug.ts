import { network } from "hardhat";
import { parseEther } from "viem";
import { readFile } from "fs/promises";

async function main() {
  const connection = await network.connect();
  const { viem, networkHelpers } = connection;

  console.log(
    "Impersonating EntryPoint v09 leads to wrong balances bug reproduction",
  );
  console.log(
    "=====================================================================",
  );

  const publicClient = await viem.getPublicClient();
  const testValue = 42n;

  console.log("Step 1: Using hardhat_setCode to setup EntryPoint contract");
  const entrypointAddress = "0x433709009B8330FDa32311DF1C2AFA402eD8D009";
  console.log(`  setCode on Target address: ${entrypointAddress}`);

  // This file is copied from `hardhat-predeploy` from the original test
  const bytecodeBuffer = await readFile(
    "./0x433709009B8330FDa32311DF1C2AFA402eD8D009.bytecode",
  );

  const bytecode = `0x${bytecodeBuffer.toString("hex")}` as `0x${string}`;

  await publicClient.request({
    method: "hardhat_setCode" as any,
    params: [entrypointAddress, bytecode],
  });

  console.log();
  console.log("Step 2: Using impersonateAccount on the entrpoint address");
  const [funder] = await viem.getWalletClients();

  await networkHelpers.impersonateAccount(entrypointAddress);
  await networkHelpers.setBalance(entrypointAddress, parseEther("10"));
  const entrypointClient = await viem.getWalletClient(
    entrypointAddress as `0x${string}`,
  );
  console.log(`  Impersonation of target address:`, entrypointAddress);
  console.log();

  console.log("Step 3: Deploy and fund the ContractWithFailingCall contract");
  const contractWithFailingCall = await viem.deployContract(
    "ContractWithFailingCall",
  );
  await funder.sendTransaction({
    to: contractWithFailingCall.address,
    value: parseEther("1"),
  });
  console.log(
    `  Deployed ContractWithFailingCall at:`,
    contractWithFailingCall.address,
  );

  console.log();
  console.log("Step 4: CALL with ETH as TERMINAL operation (BUG)");
  const balanceBefore = await publicClient.getBalance({
    address: contractWithFailingCall.address,
  });

  // Send the transaction for updating balances
  const txHash = await contractWithFailingCall.write.lowLevelCall([testValue], {
    account: entrypointClient.account,
    chain: entrypointClient.chain,
  });

  // // Switch this call for the above to show that adding an Event
  // // after updates the balances
  // const txHash = await buggyAccount.write.lowLevelCallThenEventEmit(
  //   [testValue],
  //   {
  //     account: entrypointClient.account,
  //     chain: entrypointClient.chain,
  //   },
  // );

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
  });
  const minedBlockNumber = receipt.blockNumber;

  const balanceAtMinedBlock = await publicClient.getBalance({
    address: contractWithFailingCall.address,
    blockNumber: minedBlockNumber,
  });
  const balanceAtLatestBlock = await publicClient.getBalance({
    address: contractWithFailingCall.address,
  });

  console.log(`  ETH sent: ${testValue} wei`);
  console.log(`  Block: ${minedBlockNumber}`);
  console.log();
  console.log(`  Balance before tx:          ${balanceBefore}`);
  console.log(
    `  Balance at block ${minedBlockNumber}:         ${balanceAtMinedBlock}`,
  );
  console.log(`  Balance at latest:          ${balanceAtLatestBlock}`);
  console.log();
  console.log(
    `  Change (at block):  ${balanceAtMinedBlock - balanceBefore} wei  (expected: -${testValue})`,
  );
  console.log(
    `  Change (latest):    ${balanceAtLatestBlock - balanceBefore} wei  (expected: -${testValue})`,
  );
  console.log();

  const hasBug = balanceAtMinedBlock - balanceBefore !== -testValue;
  console.log(
    `  ${hasBug ? "❌" : "✅"} ${hasBug ? "BUG PRESENT" : "WORKS CORRECTLY"}: ${hasBug ? "getBalance(block) returns wrong value!" : "Balance tracking is correct"}`,
  );

  console.log();
  console.log("Reproduction script finished");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
