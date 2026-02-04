// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

contract ContractWithFailingCall {
    event PrefundPaid(uint256 amount);

    function lowLevelCall(uint256 missingFunds) external returns (uint256) {
        if (missingFunds > 0) {
            // Low-level call sending ETH to caller (msg.sender)
            assembly ("memory-safe") {
                pop(call(gas(), caller(), missingFunds, 0, 0, 0, 0))
            }
        }
        // Fails: No operation after CALL - getBalance() returns wrong value
        return 0;
    }

    function lowLevelCallThenEventEmit(
        uint256 missingFunds
    ) external returns (uint256) {
        if (missingFunds > 0) {
            assembly ("memory-safe") {
                pop(call(gas(), caller(), missingFunds, 0, 0, 0, 0))
            }
        }
        // Works
        emit PrefundPaid(missingFunds);
        return 0;
    }

    receive() external payable {}
}
