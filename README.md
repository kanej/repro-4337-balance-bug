# EDR wrong balance when impersonating EIP-4337 EntryPoint contract

This is a minimal reproduction repo for a bug in EDR.

There is a test suite fail in porting the OpenZeppelin contracts test suite from 
Hardhat 2 to Hardhat 3. Specifically:

https://github.com/Amxx/openzeppelin-contracts/blob/eb7e57d4aaf3b24baefb0f5a26b8293dc11c0781/test/account/Account.behavior.js#L56-L64

```ts
beforeEach(async function () {
    this.mockFromEntrypoint = this.mock.connect(
        await this.helpers.impersonate(this.ethers.predeploy.entrypoint.v09.target),
    );
});

it('should pay missing account funds for execution', async function () {
    // empty operation (does nothing)
    const operation = await this.mock.createUserOp(this.userOp).then(op => this.signUserOp(op));
    const value = 42n;

    await expect(
        this.mockFromEntrypoint.validateUserOp(operation.packed, operation.hash(), value),
    ).to.changeEtherBalances(this.ethers, [this.mock, this.ethers.predeploy.entrypoint.v09], [-value, value]);
});
```

## The Issue

The OpenZeppelin test does:

1. Sets up the EntryPoint v9 contract using `hardhat_setCode` via OpenZeppelin's 
internal `hardhat-predeploy` plugin.
2. The test then impersonates (`hardhat_impersonateAccount`) the predeploy 
Entrypoint v9 contract address
3. A transaction is sent from the impersonated EntryPoint address to
`validateUserOp`, the validation causes balances to be updated
4. Calls to `getBalance` return the wrong, un-updated balance for that block

Adding a `console.log()` immediately after the balance update in the Solidity
does trigger the update of state such that `getBalance` gives the right result.

My claudian attempts to reproduce suggest that: setCode + impersonation + a
balance update as the terminal operation is needed, so it is quite the edge case.

My exploration also suggested that a contract other than EntryPoint may not
cause the bug (it is a complicated contract).

## Usage

There is a devcontainer for this repo with `pnpm` and `hardhat` + the `viem`
template setup.

To run the reproduction script:

```shell
pnpm install

pnpm hardhat run ./scripts/reproduce-4337-impersonation-bug.ts
```
