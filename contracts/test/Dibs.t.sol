// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Test } from "forge-std/Test.sol";
import { Dibs } from "../src/Dibs.sol";

contract DibsTest is Test {
    Dibs internal dibs;

    address internal oracle = makeAddr("oracle");
    address internal opener = makeAddr("opener");
    address internal scoutA = makeAddr("scout-a");
    address internal scoutB = makeAddr("scout-b");
    address internal creatorA = makeAddr("creator-a");
    address internal creatorB = makeAddr("creator-b");

    uint96 internal constant BASE_PRICE = 0.01 ether;
    uint96 internal constant SLOPE = 0.001 ether;
    uint96 internal constant CHALLENGE_BOND = 0.05 ether;
    uint40 internal constant CHALLENGE_PERIOD = 2 hours;
    uint40 internal constant RESULT_GRACE_PERIOD = 1 hours;
    uint40 internal constant CHALLENGE_RESOLUTION_PERIOD = 3 hours;

    event MarketAllocated(
        uint256 indexed marketId, uint256 scoutAllocation, uint256 creatorAllocation
    );

    function setUp() public {
        dibs = new Dibs(
            address(this),
            oracle,
            BASE_PRICE,
            SLOPE,
            CHALLENGE_BOND,
            CHALLENGE_PERIOD,
            RESULT_GRACE_PERIOD,
            CHALLENGE_RESOLUTION_PERIOD,
            1_000,
            2_000
        );
        dibs.setMarketOpener(opener, true);
        vm.deal(scoutA, 10 ether);
        vm.deal(scoutB, 10 ether);
    }

    function test_EndToEndEpochSettlementAndClaims() public {
        uint256 epochId = _createEpoch(1 ether);
        uint256 marketA = _openMarket(epochId, "cast-a", creatorA, 7);
        uint256 marketB = _openMarket(epochId, "cast-b", creatorB, 11);

        uint256 earlyCost = dibs.quote(marketA, 2);
        assertEq(earlyCost, 0.021 ether);
        vm.prank(scoutA);
        dibs.scout{ value: earlyCost }(marketA, 2);

        uint256 laterCost = dibs.quote(marketA, 1);
        assertEq(laterCost, 0.012 ether);
        vm.prank(scoutB);
        dibs.scout{ value: laterCost }(marketA, 1);

        vm.prank(scoutB);
        dibs.scout{ value: dibs.quote(marketB, 1) }(marketB, 1);

        vm.warp(block.timestamp + 1 days);
        vm.startPrank(oracle);
        dibs.submitResult(marketA, 120, keccak256("observation-a"));
        dibs.submitResult(marketB, 0, keccak256("observation-b"));
        vm.stopPrank();

        // Market A is the only winner, so its allocation is capped at 20% of the pool.
        uint256 totalPool = 1 ether + 0.021 ether + 0.012 ether + 0.01 ether;
        uint256 expectedMarketAllocation = totalPool * 2_000 / 10_000;
        uint256 expectedCreatorAllocation = expectedMarketAllocation / 10;
        uint256 expectedScoutAllocation = expectedMarketAllocation - expectedCreatorAllocation;

        vm.warp(block.timestamp + CHALLENGE_PERIOD);
        vm.expectEmit(true, false, false, true, address(dibs));
        emit MarketAllocated(marketA, expectedScoutAllocation, expectedCreatorAllocation);
        vm.expectEmit(true, false, false, true, address(dibs));
        emit MarketAllocated(marketB, 0, 0);
        dibs.finalizeEpoch(epochId);

        (,,,,,,, uint256 scoutAllocation, uint256 creatorAllocation,,,,,,,) = dibs.markets(marketA);
        assertEq(creatorAllocation, expectedMarketAllocation / 10);
        assertEq(scoutAllocation, expectedMarketAllocation - creatorAllocation);

        uint256 scoutABefore = scoutA.balance;
        vm.prank(scoutA);
        uint256 scoutAPayout = dibs.claimScout(marketA);
        assertEq(scoutAPayout, scoutAllocation * 2 / 3);
        assertEq(scoutA.balance, scoutABefore + scoutAPayout);

        uint256 creatorBefore = creatorA.balance;
        vm.prank(creatorA);
        dibs.claimCreator(marketA);
        assertEq(creatorA.balance, creatorBefore + creatorAllocation);
        assertEq(dibs.protocolReserve(), totalPool - expectedMarketAllocation);
    }

    function test_ChallengeCanCorrectResultAndRefundBond() public {
        uint256 epochId = _createEpoch(0.5 ether);
        uint256 marketId = _openMarket(epochId, "suspicious-cast", creatorA, 3);

        uint256 cost = dibs.quote(marketId, 1);
        vm.prank(scoutA);
        dibs.scout{ value: cost }(marketId, 1);

        vm.warp(block.timestamp + 1 days);
        vm.prank(oracle);
        dibs.submitResult(marketId, 999, keccak256("raw-result"));

        vm.prank(scoutA);
        dibs.challenge{ value: CHALLENGE_BOND }(marketId);

        vm.prank(oracle);
        dibs.resolveChallenge(marketId, 4, keccak256("quality-filtered-result"), true);
        assertEq(dibs.credits(scoutA), CHALLENGE_BOND);

        uint256 balanceBefore = scoutA.balance;
        vm.prank(scoutA);
        dibs.withdrawCredit();
        assertEq(scoutA.balance, balanceBefore + CHALLENGE_BOND);
    }

    function test_RejectedChallengeAddsBondToPool() public {
        uint256 epochId = _createEpoch(0.5 ether);
        uint256 marketId = _openMarket(epochId, "valid-cast", creatorA, 3);
        uint256 cost = dibs.quote(marketId, 1);
        vm.prank(scoutA);
        dibs.scout{ value: cost }(marketId, 1);

        vm.warp(block.timestamp + 1 days);
        vm.prank(oracle);
        dibs.submitResult(marketId, 50, keccak256("result"));
        vm.prank(scoutA);
        dibs.challenge{ value: CHALLENGE_BOND }(marketId);
        vm.prank(oracle);
        dibs.resolveChallenge(marketId, 50, keccak256("second-check"), false);

        (,,,,, uint256 rewardPool,,) = dibs.epochs(epochId);
        assertEq(rewardPool, 0.5 ether + 0.01 ether + CHALLENGE_BOND);
    }

    function test_OnlyAuthorizedOpenerCanCreateMarket() public {
        uint256 epochId = _createEpoch(0);
        vm.prank(scoutA);
        vm.expectRevert(Dibs.Unauthorized.selector);
        dibs.openMarket(epochId, keccak256("cast"), creatorA, 1);
    }

    function test_CommunityPoolSeedsMarketsWithoutMintingScoutUnits() public {
        dibs.setMarketSeed(0.05 ether);
        uint256 epochId = _createEpoch(0.1 ether);

        uint256 firstMarket = _openMarket(epochId, "seeded-one", creatorA, 1);
        (,,,, uint128 totalUnits, uint256 totalStake,,,,,,,,,,) = dibs.markets(firstMarket);
        assertEq(totalStake, 0.05 ether);
        assertEq(totalUnits, 0);
        assertEq(dibs.seedStakeOf(firstMarket), 0.05 ether);
        assertEq(dibs.epochSeedCommitted(epochId), 0.05 ether);

        uint256 cost = dibs.quote(firstMarket, 1);
        assertEq(cost, BASE_PRICE);
        vm.prank(scoutA);
        dibs.scout{ value: cost }(firstMarket, 1);
        (,,,, totalUnits, totalStake,,,,,,,,,,) = dibs.markets(firstMarket);
        assertEq(totalUnits, 1);
        assertEq(totalStake, 0.05 ether + cost);

        _openMarket(epochId, "seeded-two", creatorB, 1);
        vm.prank(opener);
        vm.expectRevert(Dibs.InvalidAmount.selector);
        dibs.openMarket(epochId, keccak256("seeded-three"), creatorA, 1);
    }

    function test_OnlyOwnerCanConfigureMarketSeed() public {
        vm.prank(scoutA);
        vm.expectRevert(Dibs.Unauthorized.selector);
        dibs.setMarketSeed(0.01 ether);
    }

    function test_CannotScoutAfterEpochCloses() public {
        uint256 epochId = _createEpoch(0);
        uint256 marketId = _openMarket(epochId, "cast", creatorA, 1);
        vm.warp(block.timestamp + 1 days);
        vm.prank(scoutA);
        vm.expectRevert(Dibs.InvalidTime.selector);
        dibs.scout{ value: BASE_PRICE }(marketId, 1);
    }

    function test_MissingResultCanExpireAndEpochCanFinalize() public {
        uint256 epochId = _createEpoch(0.5 ether);
        uint256 marketId = _openMarket(epochId, "missing-result", creatorA, 3);
        uint256 cost = dibs.quote(marketId, 1);
        vm.prank(scoutA);
        dibs.scout{ value: cost }(marketId, 1);

        vm.warp(block.timestamp + 1 days + RESULT_GRACE_PERIOD - 1);
        vm.expectRevert(Dibs.InvalidTime.selector);
        dibs.expireMissingResult(marketId);

        vm.warp(block.timestamp + 1);
        dibs.expireMissingResult(marketId);
        (,,,,,, uint256 score,,,, bytes32 evidenceHash,,, bool submitted,,) = dibs.markets(marketId);
        assertEq(score, 0);
        assertTrue(submitted);
        assertTrue(evidenceHash != bytes32(0));

        vm.expectRevert(Dibs.InvalidResult.selector);
        dibs.expireMissingResult(marketId);

        vm.warp(block.timestamp + CHALLENGE_PERIOD);
        dibs.finalizeEpoch(epochId);
        (,,,,,, bool finalized) = _epoch(epochId);
        assertTrue(finalized);
        assertEq(dibs.protocolReserve(), 0.5 ether + cost);
    }

    function test_OracleCannotSubmitAfterGraceDeadline() public {
        uint256 epochId = _createEpoch(0);
        uint256 marketId = _openMarket(epochId, "late-result", creatorA, 1);

        vm.warp(block.timestamp + 1 days + RESULT_GRACE_PERIOD);
        vm.prank(oracle);
        vm.expectRevert(Dibs.InvalidTime.selector);
        dibs.submitResult(marketId, 10, keccak256("late"));
    }

    function test_ExpiredChallengeRefundsBondAndFailsMarketClosed() public {
        uint256 epochId = _createEpoch(0.5 ether);
        uint256 marketId = _openMarket(epochId, "unresolved", creatorA, 2);
        uint256 cost = dibs.quote(marketId, 1);
        vm.prank(scoutA);
        dibs.scout{ value: cost }(marketId, 1);

        vm.warp(block.timestamp + 1 days);
        vm.prank(oracle);
        dibs.submitResult(marketId, 500, keccak256("disputed"));
        vm.prank(scoutA);
        dibs.challenge{ value: CHALLENGE_BOND }(marketId);

        vm.warp(block.timestamp + CHALLENGE_PERIOD + CHALLENGE_RESOLUTION_PERIOD - 1);
        vm.expectRevert(Dibs.InvalidTime.selector);
        dibs.expireChallenge(marketId);

        vm.warp(block.timestamp + 1);
        dibs.expireChallenge(marketId);
        assertEq(dibs.credits(scoutA), CHALLENGE_BOND);
        (,,,,,, uint256 score,,,, bytes32 evidenceHash,,,,, bool resolved) = dibs.markets(marketId);
        assertEq(score, 0);
        assertTrue(evidenceHash != keccak256("disputed"));
        assertTrue(resolved);

        dibs.finalizeEpoch(epochId);
        (,,,,,,, uint256 scoutAllocation, uint256 creatorAllocation,,,,,,,) = dibs.markets(marketId);
        assertEq(scoutAllocation, 0);
        assertEq(creatorAllocation, 0);

        uint256 balanceBefore = scoutA.balance;
        vm.prank(scoutA);
        dibs.withdrawCredit();
        assertEq(scoutA.balance, balanceBefore + CHALLENGE_BOND);
    }

    function test_OracleCannotResolveChallengeAfterResolutionDeadline() public {
        uint256 epochId = _createEpoch(0);
        uint256 marketId = _openMarket(epochId, "late-resolution", creatorA, 2);
        uint256 cost = dibs.quote(marketId, 1);
        vm.prank(scoutA);
        dibs.scout{ value: cost }(marketId, 1);

        vm.warp(block.timestamp + 1 days);
        vm.prank(oracle);
        dibs.submitResult(marketId, 5, keccak256("original"));
        vm.prank(scoutA);
        dibs.challenge{ value: CHALLENGE_BOND }(marketId);

        vm.warp(block.timestamp + CHALLENGE_PERIOD + CHALLENGE_RESOLUTION_PERIOD);
        vm.prank(oracle);
        vm.expectRevert(Dibs.InvalidTime.selector);
        dibs.resolveChallenge(marketId, 4, keccak256("too-late"), true);
    }

    function test_ConstructorRejectsZeroLivenessWindows() public {
        vm.expectRevert(Dibs.InvalidConfiguration.selector);
        new Dibs(
            address(this),
            oracle,
            BASE_PRICE,
            SLOPE,
            CHALLENGE_BOND,
            CHALLENGE_PERIOD,
            0,
            CHALLENGE_RESOLUTION_PERIOD,
            1_000,
            2_000
        );

        vm.expectRevert(Dibs.InvalidConfiguration.selector);
        new Dibs(
            address(this),
            oracle,
            BASE_PRICE,
            SLOPE,
            CHALLENGE_BOND,
            CHALLENGE_PERIOD,
            RESULT_GRACE_PERIOD,
            0,
            1_000,
            2_000
        );
    }

    function _epoch(uint256 epochId)
        internal
        view
        returns (
            uint40 opensAt,
            uint40 closesAt,
            uint40 latestResultAt,
            uint32 marketCount,
            uint32 resultCount,
            uint256 rewardPool,
            bool finalized
        )
    {
        uint256 allocated;
        (
            opensAt,
            closesAt,
            latestResultAt,
            marketCount,
            resultCount,
            rewardPool,
            allocated,
            finalized
        ) = dibs.epochs(epochId);
    }

    function _createEpoch(uint256 seed) internal returns (uint256) {
        return dibs.createEpoch{ value: seed }(
            uint40(block.timestamp), uint40(block.timestamp + 1 days)
        );
    }

    function _openMarket(uint256 epochId, string memory castId, address creator, uint64 baseline)
        internal
        returns (uint256)
    {
        vm.prank(opener);
        return dibs.openMarket(epochId, keccak256(bytes(castId)), creator, baseline);
    }
}
