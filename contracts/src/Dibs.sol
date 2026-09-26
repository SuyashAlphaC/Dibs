// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title Dibs
/// @notice Conviction markets for discovering Farcaster casts early.
/// @dev Native MON is used for the hackathon MVP. An offchain workflow validates
///      cast eligibility and submits quality-weighted engagement results.
contract Dibs {
    uint256 public constant BPS = 10_000;
    uint256 public constant MAX_SCORE = 1e12;
    uint256 public constant MAX_MARKETS_PER_EPOCH = 100;

    struct Epoch {
        uint40 opensAt;
        uint40 closesAt;
        uint40 latestResultAt;
        uint32 marketCount;
        uint32 resultCount;
        uint256 rewardPool;
        uint256 allocated;
        bool finalized;
    }

    struct Market {
        uint32 epochId;
        uint40 openedAt;
        uint40 resultSubmittedAt;
        uint64 baselineEngagement;
        uint128 totalUnits;
        uint256 totalStake;
        uint256 qualityGrowthScore;
        uint256 scoutAllocation;
        uint256 creatorAllocation;
        bytes32 castHash;
        bytes32 evidenceHash;
        address creator;
        address challenger;
        bool resultSubmitted;
        bool challenged;
        bool challengeResolved;
    }

    error Unauthorized();
    error InvalidConfiguration();
    error InvalidEpoch();
    error InvalidMarket();
    error InvalidTime();
    error InvalidAmount();
    error InvalidResult();
    error DuplicateCast();
    error AlreadyClaimed();
    error TransferFailed();
    error Reentrancy();

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event OracleUpdated(address indexed oracle);
    event MarketOpenerUpdated(address indexed opener, bool allowed);
    event MarketSeedUpdated(uint256 amount);
    event EpochCreated(uint256 indexed epochId, uint40 opensAt, uint40 closesAt, uint256 seed);
    event EpochFunded(uint256 indexed epochId, address indexed funder, uint256 amount);
    event MarketOpened(
        uint256 indexed marketId,
        uint256 indexed epochId,
        bytes32 indexed castHash,
        address creator,
        uint64 baselineEngagement
    );
    event MarketSeeded(uint256 indexed marketId, uint256 indexed epochId, uint256 amount);
    event Scouted(
        uint256 indexed marketId,
        address indexed scout,
        uint256 units,
        uint256 cost,
        uint256 totalStake
    );
    event ResultSubmitted(
        uint256 indexed marketId, uint256 qualityGrowthScore, bytes32 evidenceHash
    );
    event ResultExpired(uint256 indexed marketId, bytes32 evidenceHash);
    event MarketChallenged(uint256 indexed marketId, address indexed challenger, uint256 bond);
    event ChallengeResolved(
        uint256 indexed marketId, bool upheld, uint256 qualityGrowthScore, bytes32 evidenceHash
    );
    event ChallengeExpired(
        uint256 indexed marketId, address indexed challenger, bytes32 evidenceHash
    );
    event MarketAllocated(
        uint256 indexed marketId, uint256 scoutAllocation, uint256 creatorAllocation
    );
    event EpochFinalized(uint256 indexed epochId, uint256 allocated, uint256 reserve);
    event ScoutClaimed(uint256 indexed marketId, address indexed scout, uint256 amount);
    event CreatorClaimed(uint256 indexed marketId, address indexed creator, uint256 amount);
    event CreditWithdrawn(address indexed account, uint256 amount);

    address public owner;
    address public oracle;
    uint96 public immutable baseUnitPrice;
    uint96 public immutable unitPriceSlope;
    uint96 public immutable challengeBond;
    uint40 public immutable challengePeriod;
    uint40 public immutable resultSubmissionGracePeriod;
    uint40 public immutable challengeResolutionPeriod;
    uint16 public immutable creatorShareBps;
    uint16 public immutable maxMarketShareBps;

    uint256 public epochCount;
    uint256 public marketCount;
    uint256 public protocolReserve;
    uint256 public marketSeed;

    mapping(address => bool) public marketOpeners;
    mapping(uint256 => Epoch) public epochs;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => uint256[]) private _epochMarkets;
    mapping(bytes32 => uint256) public marketIdByCastHash;
    mapping(uint256 => mapping(address => uint256)) public unitsOf;
    mapping(uint256 => mapping(address => bool)) public scoutClaimed;
    mapping(uint256 => bool) public creatorClaimed;
    mapping(address => uint256) public credits;
    mapping(uint256 => uint256) public seedStakeOf;
    mapping(uint256 => uint256) public epochSeedCommitted;

    uint256 private _locked = 1;

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    modifier onlyOracle() {
        if (msg.sender != oracle) revert Unauthorized();
        _;
    }

    modifier nonReentrant() {
        if (_locked != 1) revert Reentrancy();
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(
        address initialOwner,
        address initialOracle,
        uint96 basePrice,
        uint96 slope,
        uint96 bond,
        uint40 challengeWindow,
        uint40 resultSubmissionGraceWindow,
        uint40 challengeResolutionWindow,
        uint16 creatorBps,
        uint16 marketCapBps
    ) {
        if (
            initialOwner == address(0) || initialOracle == address(0) || basePrice == 0
                || challengeWindow == 0 || resultSubmissionGraceWindow == 0
                || challengeResolutionWindow == 0 || creatorBps > BPS || marketCapBps == 0
                || marketCapBps > BPS
        ) revert InvalidConfiguration();

        owner = initialOwner;
        oracle = initialOracle;
        baseUnitPrice = basePrice;
        unitPriceSlope = slope;
        challengeBond = bond;
        challengePeriod = challengeWindow;
        resultSubmissionGracePeriod = resultSubmissionGraceWindow;
        challengeResolutionPeriod = challengeResolutionWindow;
        creatorShareBps = creatorBps;
        maxMarketShareBps = marketCapBps;
        marketOpeners[initialOwner] = true;

        emit OwnershipTransferred(address(0), initialOwner);
        emit OracleUpdated(initialOracle);
        emit MarketOpenerUpdated(initialOwner, true);
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        if (nextOwner == address(0)) revert InvalidConfiguration();
        address previousOwner = owner;
        owner = nextOwner;
        emit OwnershipTransferred(previousOwner, nextOwner);
    }

    function setOracle(address nextOracle) external onlyOwner {
        if (nextOracle == address(0)) revert InvalidConfiguration();
        oracle = nextOracle;
        emit OracleUpdated(nextOracle);
    }

    function setMarketOpener(address opener, bool allowed) external onlyOwner {
        if (opener == address(0)) revert InvalidConfiguration();
        marketOpeners[opener] = allowed;
        emit MarketOpenerUpdated(opener, allowed);
    }

    /// @notice Sets the sponsor-funded conviction boost reserved for each newly opened market.
    function setMarketSeed(uint256 amount) external onlyOwner {
        marketSeed = amount;
        emit MarketSeedUpdated(amount);
    }

    function createEpoch(uint40 opensAt, uint40 closesAt)
        external
        payable
        onlyOwner
        returns (uint256 epochId)
    {
        if (opensAt >= closesAt || closesAt <= block.timestamp) revert InvalidTime();
        epochId = ++epochCount;
        epochs[epochId] = Epoch({
            opensAt: opensAt,
            closesAt: closesAt,
            latestResultAt: 0,
            marketCount: 0,
            resultCount: 0,
            rewardPool: msg.value,
            allocated: 0,
            finalized: false
        });
        emit EpochCreated(epochId, opensAt, closesAt, msg.value);
    }

    function fundEpoch(uint256 epochId) external payable {
        Epoch storage epoch = epochs[epochId];
        if (epoch.closesAt == 0) revert InvalidEpoch();
        if (epoch.finalized || msg.value == 0) revert InvalidAmount();
        epoch.rewardPool += msg.value;
        emit EpochFunded(epochId, msg.sender, msg.value);
    }

    function openMarket(
        uint256 epochId,
        bytes32 castHash,
        address creator,
        uint64 baselineEngagement
    ) external returns (uint256 marketId) {
        if (!marketOpeners[msg.sender]) revert Unauthorized();
        Epoch storage epoch = epochs[epochId];
        if (epoch.closesAt == 0) revert InvalidEpoch();
        if (block.timestamp < epoch.opensAt || block.timestamp >= epoch.closesAt) {
            revert InvalidTime();
        }
        if (castHash == bytes32(0) || creator == address(0)) revert InvalidConfiguration();
        if (marketIdByCastHash[castHash] != 0) revert DuplicateCast();
        if (epoch.marketCount >= MAX_MARKETS_PER_EPOCH) revert InvalidConfiguration();

        uint256 seed = marketSeed;
        uint256 committed = epochSeedCommitted[epochId];
        if (seed != 0 && epoch.rewardPool < committed + seed) revert InvalidAmount();

        marketId = ++marketCount;
        markets[marketId] = Market({
            epochId: uint32(epochId),
            openedAt: uint40(block.timestamp),
            resultSubmittedAt: 0,
            baselineEngagement: baselineEngagement,
            totalUnits: 0,
            totalStake: seed,
            qualityGrowthScore: 0,
            scoutAllocation: 0,
            creatorAllocation: 0,
            castHash: castHash,
            evidenceHash: bytes32(0),
            creator: creator,
            challenger: address(0),
            resultSubmitted: false,
            challenged: false,
            challengeResolved: false
        });
        marketIdByCastHash[castHash] = marketId;
        _epochMarkets[epochId].push(marketId);
        epoch.marketCount++;
        seedStakeOf[marketId] = seed;
        epochSeedCommitted[epochId] = committed + seed;

        emit MarketOpened(marketId, epochId, castHash, creator, baselineEngagement);
        if (seed != 0) emit MarketSeeded(marketId, epochId, seed);
    }

    /// @notice Returns the exact cost for the next `units` on the linear curve.
    function quote(uint256 marketId, uint256 units) public view returns (uint256) {
        Market storage market = markets[marketId];
        if (market.epochId == 0) revert InvalidMarket();
        if (units == 0 || units > type(uint32).max) revert InvalidAmount();

        uint256 supply = market.totalUnits;
        uint256 arithmeticSeries = units * ((2 * supply) + units - 1) / 2;
        return (units * uint256(baseUnitPrice)) + (arithmeticSeries * uint256(unitPriceSlope));
    }

    function scout(uint256 marketId, uint256 units) external payable {
        Market storage market = markets[marketId];
        if (market.epochId == 0) revert InvalidMarket();
        Epoch storage epoch = epochs[market.epochId];
        if (block.timestamp >= epoch.closesAt) revert InvalidTime();

        uint256 cost = quote(marketId, units);
        if (msg.value != cost) revert InvalidAmount();

        market.totalUnits += uint128(units);
        market.totalStake += cost;
        epoch.rewardPool += cost;
        unitsOf[marketId][msg.sender] += units;

        emit Scouted(marketId, msg.sender, units, cost, market.totalStake);
    }

    function submitResult(uint256 marketId, uint256 score, bytes32 evidenceHash)
        external
        onlyOracle
    {
        Market storage market = markets[marketId];
        if (market.epochId == 0) revert InvalidMarket();
        Epoch storage epoch = epochs[market.epochId];
        if (block.timestamp < epoch.closesAt) revert InvalidTime();
        if (block.timestamp >= uint256(epoch.closesAt) + resultSubmissionGracePeriod) {
            revert InvalidTime();
        }
        if (market.resultSubmitted || score > MAX_SCORE || evidenceHash == bytes32(0)) {
            revert InvalidResult();
        }

        _recordResult(marketId, market, epoch, score, evidenceHash);
    }

    /// @notice Records a zero result after the oracle submission grace period has elapsed.
    /// @dev Anyone may call this to prevent an unavailable oracle from blocking the epoch.
    function expireMissingResult(uint256 marketId) external {
        Market storage market = markets[marketId];
        if (market.epochId == 0) revert InvalidMarket();
        Epoch storage epoch = epochs[market.epochId];
        if (market.resultSubmitted) revert InvalidResult();
        if (block.timestamp < uint256(epoch.closesAt) + resultSubmissionGracePeriod) {
            revert InvalidTime();
        }

        bytes32 evidenceHash =
            keccak256(abi.encode("DIBS_RESULT_TIMEOUT", block.chainid, address(this), marketId));
        _recordResult(marketId, market, epoch, 0, evidenceHash);
        emit ResultExpired(marketId, evidenceHash);
    }

    function _recordResult(
        uint256 marketId,
        Market storage market,
        Epoch storage epoch,
        uint256 score,
        bytes32 evidenceHash
    ) private {
        market.qualityGrowthScore = score;
        market.evidenceHash = evidenceHash;
        market.resultSubmitted = true;
        market.resultSubmittedAt = uint40(block.timestamp);
        epoch.resultCount++;
        if (block.timestamp > epoch.latestResultAt) epoch.latestResultAt = uint40(block.timestamp);

        emit ResultSubmitted(marketId, score, evidenceHash);
    }

    function challenge(uint256 marketId) external payable {
        Market storage market = markets[marketId];
        if (!market.resultSubmitted || market.challenged) revert InvalidResult();
        if (block.timestamp >= uint256(market.resultSubmittedAt) + challengePeriod) {
            revert InvalidTime();
        }
        if (unitsOf[marketId][msg.sender] == 0 || msg.value != challengeBond) {
            revert InvalidAmount();
        }

        market.challenged = true;
        market.challenger = msg.sender;
        emit MarketChallenged(marketId, msg.sender, msg.value);
    }

    function resolveChallenge(
        uint256 marketId,
        uint256 correctedScore,
        bytes32 correctedEvidenceHash,
        bool upheld
    ) external onlyOracle {
        Market storage market = markets[marketId];
        if (!market.challenged || market.challengeResolved) revert InvalidResult();
        if (
            block.timestamp
                >= uint256(market.resultSubmittedAt) + challengePeriod + challengeResolutionPeriod
        ) revert InvalidTime();
        if (correctedScore > MAX_SCORE || correctedEvidenceHash == bytes32(0)) {
            revert InvalidResult();
        }

        market.challengeResolved = true;
        market.qualityGrowthScore = correctedScore;
        market.evidenceHash = correctedEvidenceHash;
        if (upheld) {
            credits[market.challenger] += challengeBond;
        } else {
            epochs[market.epochId].rewardPool += challengeBond;
        }

        emit ChallengeResolved(marketId, upheld, correctedScore, correctedEvidenceHash);
    }

    /// @notice Fails a disputed market closed if the oracle misses its resolution deadline.
    /// @dev The challenger receives its bond back and the market receives a zero score.
    function expireChallenge(uint256 marketId) external {
        Market storage market = markets[marketId];
        if (!market.challenged || market.challengeResolved) revert InvalidResult();
        if (
            block.timestamp
                < uint256(market.resultSubmittedAt) + challengePeriod + challengeResolutionPeriod
        ) revert InvalidTime();

        bytes32 evidenceHash = keccak256(
            abi.encode(
                "DIBS_CHALLENGE_TIMEOUT",
                block.chainid,
                address(this),
                marketId,
                market.evidenceHash
            )
        );
        market.challengeResolved = true;
        market.qualityGrowthScore = 0;
        market.evidenceHash = evidenceHash;
        credits[market.challenger] += challengeBond;

        emit ChallengeResolved(marketId, true, 0, evidenceHash);
        emit ChallengeExpired(marketId, market.challenger, evidenceHash);
    }

    function finalizeEpoch(uint256 epochId) external {
        Epoch storage epoch = epochs[epochId];
        if (epoch.closesAt == 0) revert InvalidEpoch();
        if (epoch.finalized || epoch.resultCount != epoch.marketCount || epoch.marketCount == 0) {
            revert InvalidResult();
        }
        if (block.timestamp < uint256(epoch.latestResultAt) + challengePeriod) {
            revert InvalidTime();
        }

        uint256[] storage ids = _epochMarkets[epochId];
        uint256 totalWeight;
        for (uint256 i; i < ids.length; ++i) {
            Market storage market = markets[ids[i]];
            if (market.challenged && !market.challengeResolved) revert InvalidResult();
            totalWeight += market.qualityGrowthScore * market.totalStake;
        }

        epoch.finalized = true;
        uint256 pool = epoch.rewardPool;
        uint256 cap = pool * maxMarketShareBps / BPS;
        uint256 allocated;

        for (uint256 i; i < ids.length; ++i) {
            Market storage market = markets[ids[i]];
            if (totalWeight != 0) {
                uint256 weight = market.qualityGrowthScore * market.totalStake;
                if (weight != 0 && market.totalUnits != 0) {
                    uint256 marketAllocation = pool * weight / totalWeight;
                    if (marketAllocation > cap) marketAllocation = cap;
                    uint256 creatorAllocation = marketAllocation * creatorShareBps / BPS;

                    market.creatorAllocation = creatorAllocation;
                    market.scoutAllocation = marketAllocation - creatorAllocation;
                    allocated += marketAllocation;
                }
            }
            emit MarketAllocated(ids[i], market.scoutAllocation, market.creatorAllocation);
        }

        epoch.allocated = allocated;
        protocolReserve += pool - allocated;
        emit EpochFinalized(epochId, allocated, pool - allocated);
    }

    function claimScout(uint256 marketId) external nonReentrant returns (uint256 amount) {
        Market storage market = markets[marketId];
        if (!epochs[market.epochId].finalized || scoutClaimed[marketId][msg.sender]) {
            revert AlreadyClaimed();
        }
        uint256 units = unitsOf[marketId][msg.sender];
        if (units == 0 || market.scoutAllocation == 0) revert InvalidAmount();

        scoutClaimed[marketId][msg.sender] = true;
        amount = market.scoutAllocation * units / market.totalUnits;
        _send(msg.sender, amount);
        emit ScoutClaimed(marketId, msg.sender, amount);
    }

    function claimCreator(uint256 marketId) external nonReentrant returns (uint256 amount) {
        Market storage market = markets[marketId];
        if (msg.sender != market.creator) revert Unauthorized();
        if (!epochs[market.epochId].finalized || creatorClaimed[marketId]) revert AlreadyClaimed();
        amount = market.creatorAllocation;
        if (amount == 0) revert InvalidAmount();

        creatorClaimed[marketId] = true;
        _send(msg.sender, amount);
        emit CreatorClaimed(marketId, msg.sender, amount);
    }

    function withdrawCredit() external nonReentrant returns (uint256 amount) {
        amount = credits[msg.sender];
        if (amount == 0) revert InvalidAmount();
        credits[msg.sender] = 0;
        _send(msg.sender, amount);
        emit CreditWithdrawn(msg.sender, amount);
    }

    function epochMarketIds(uint256 epochId) external view returns (uint256[] memory) {
        return _epochMarkets[epochId];
    }

    function _send(address recipient, uint256 amount) private {
        (bool success,) = recipient.call{ value: amount }("");
        if (!success) revert TransferFailed();
    }
}
