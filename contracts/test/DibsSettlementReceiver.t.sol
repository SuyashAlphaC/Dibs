// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { Dibs } from "../src/Dibs.sol";
import {
    DibsSettlementReceiver,
    IDibsSettlement,
    IERC165,
    IReceiver
} from "../src/DibsSettlementReceiver.sol";

contract DibsSettlementReceiverTest is Test {
    Dibs internal dibs;
    DibsSettlementReceiver internal receiver;

    address internal forwarder = makeAddr("cre-forwarder");
    address internal scout = makeAddr("scout");
    address internal creator = makeAddr("creator");

    bytes32 internal constant WORKFLOW_ID = keccak256("dibs-settlement-workflow");
    uint96 internal constant CHALLENGE_BOND = 0.05 ether;

    function setUp() public {
        dibs = new Dibs(
            address(this),
            address(this),
            0.01 ether,
            0.001 ether,
            CHALLENGE_BOND,
            2 hours,
            1 hours,
            3 hours,
            1_000,
            2_000
        );
        receiver = new DibsSettlementReceiver(address(this), forwarder, address(dibs));
        dibs.setOracle(address(receiver));
        vm.deal(scout, 1 ether);
    }

    function test_ForwardsAuthenticatedSubmitResultReport() public {
        uint256 marketId = _closedMarket();
        bytes32 evidenceHash = keccak256("quality-filtered-observation");
        bytes memory settlementCalldata =
            abi.encodeCall(IDibsSettlement.submitResult, (marketId, 42, evidenceHash));

        vm.prank(forwarder);
        receiver.onReport(_metadata(WORKFLOW_ID), _report(settlementCalldata));

        (,,,,,, uint256 score,,,, bytes32 storedEvidence,,, bool submitted,,) =
            dibs.markets(marketId);
        assertEq(score, 42);
        assertEq(storedEvidence, evidenceHash);
        assertTrue(submitted);
    }

    function test_ForwardsAuthenticatedChallengeResolutionReport() public {
        uint256 marketId = _closedMarket();
        bytes32 originalEvidence = keccak256("original");
        vm.prank(forwarder);
        receiver.onReport(
            _metadata(WORKFLOW_ID),
            _report(abi.encodeCall(IDibsSettlement.submitResult, (marketId, 100, originalEvidence)))
        );

        vm.prank(scout);
        dibs.challenge{ value: CHALLENGE_BOND }(marketId);

        bytes32 correctedEvidence = keccak256("corrected");
        vm.prank(forwarder);
        receiver.onReport(
            _metadata(WORKFLOW_ID),
            _report(
                abi.encodeCall(
                    IDibsSettlement.resolveChallenge, (marketId, 8, correctedEvidence, true)
                )
            )
        );

        (,,,,,, uint256 score,,,, bytes32 storedEvidence,,,,, bool resolved) =
            dibs.markets(marketId);
        assertEq(score, 8);
        assertEq(storedEvidence, correctedEvidence);
        assertTrue(resolved);
        assertEq(dibs.credits(scout), CHALLENGE_BOND);
    }

    function test_RejectsCallerOtherThanConfiguredForwarder() public {
        vm.expectRevert(DibsSettlementReceiver.Unauthorized.selector);
        receiver.onReport(
            "", _report(abi.encodeCall(IDibsSettlement.submitResult, (1, 1, bytes32(uint256(1)))))
        );
    }

    function test_RejectsWrongWorkflowAfterWorkflowIsPinned() public {
        receiver.setExpectedWorkflowId(WORKFLOW_ID);
        bytes32 wrongWorkflow = keccak256("attacker-workflow");

        vm.prank(forwarder);
        vm.expectRevert(
            abi.encodeWithSelector(
                DibsSettlementReceiver.InvalidWorkflowId.selector, wrongWorkflow, WORKFLOW_ID
            )
        );
        receiver.onReport(
            _metadata(wrongWorkflow),
            _report(abi.encodeCall(IDibsSettlement.submitResult, (1, 1, bytes32(uint256(1)))))
        );
    }

    function test_RejectsReportForAnotherChain() public {
        bytes memory settlementCalldata =
            abi.encodeCall(IDibsSettlement.submitResult, (1, 1, bytes32(uint256(1))));

        vm.prank(forwarder);
        vm.expectRevert(
            abi.encodeWithSelector(
                DibsSettlementReceiver.InvalidTargetChain.selector, block.chainid + 1, block.chainid
            )
        );
        receiver.onReport(_metadata(WORKFLOW_ID), abi.encode(block.chainid + 1, settlementCalldata));
    }

    function test_RejectsNonSettlementFunction() public {
        bytes memory ownerCalldata = abi.encodeCall(Dibs.setOracle, (address(this)));

        vm.prank(forwarder);
        vm.expectRevert(
            abi.encodeWithSelector(
                DibsSettlementReceiver.UnsupportedSettlementSelector.selector,
                Dibs.setOracle.selector
            )
        );
        receiver.onReport(_metadata(WORKFLOW_ID), _report(ownerCalldata));
    }

    function test_ImplementsCreReceiverAndErc165Interfaces() public view {
        assertTrue(receiver.supportsInterface(type(IReceiver).interfaceId));
        assertTrue(receiver.supportsInterface(type(IERC165).interfaceId));
        assertFalse(receiver.supportsInterface(0xffffffff));
    }

    function _closedMarket() internal returns (uint256 marketId) {
        uint256 epochId =
            dibs.createEpoch(uint40(block.timestamp), uint40(block.timestamp + 1 days));
        marketId = dibs.openMarket(epochId, keccak256("cast"), creator, 2);
        uint256 cost = dibs.quote(marketId, 1);
        vm.prank(scout);
        dibs.scout{ value: cost }(marketId, 1);
        vm.warp(block.timestamp + 1 days);
    }

    function _report(bytes memory settlementCalldata) internal view returns (bytes memory) {
        return abi.encode(block.chainid, settlementCalldata);
    }

    function _metadata(bytes32 workflowId) internal pure returns (bytes memory) {
        return abi.encodePacked(workflowId, bytes10("dibs"), address(0xBEEF), bytes2(0));
    }
}
