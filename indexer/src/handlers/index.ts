import { indexer } from "envio";

const ZERO = 0n;

indexer.onEvent({contract: "Dibs", event: "EpochCreated"}, async ({event, context}) => {
  context.Epoch.set({
    id: event.params.epochId.toString(),
    opensAt: event.params.opensAt,
    closesAt: event.params.closesAt,
    rewardPool: event.params.seed,
    allocated: ZERO,
    reserve: ZERO,
    marketCount: 0,
    finalized: false,
  });
});

indexer.onEvent({contract: "Dibs", event: "EpochFunded"}, async ({event, context}) => {
  const id = event.params.epochId.toString();
  const epoch = await context.Epoch.get(id);
  if (!epoch) return;
  context.Epoch.set({...epoch, rewardPool: epoch.rewardPool + event.params.amount});
});

indexer.onEvent({contract: "Dibs", event: "MarketOpened"}, async ({event, context}) => {
  const epochId = event.params.epochId.toString();
  const epoch = await context.Epoch.get(epochId);
  if (epoch) context.Epoch.set({...epoch, marketCount: epoch.marketCount + 1});

  context.Market.set({
    id: event.params.marketId.toString(),
    epochId,
    castHash: event.params.castHash,
    creator: event.params.creator.toLowerCase(),
    baselineEngagement: event.params.baselineEngagement,
    openedAt: BigInt(event.block.timestamp),
    closesAt: epoch?.closesAt ?? BigInt(event.block.timestamp),
    seedStake: ZERO,
    totalStake: ZERO,
    totalUnits: ZERO,
    scoutCount: 0,
    qualityGrowthScore: ZERO,
    evidenceHash: undefined,
    resultSubmittedAt: undefined,
    resultExpired: false,
    status: "OPEN",
    challenged: false,
    challenger: undefined,
    challengeBond: ZERO,
    challengeUpheld: undefined,
    challengeExpired: false,
    scoutAllocation: ZERO,
    creatorAllocation: ZERO,
    scoutClaimed: ZERO,
    creatorClaimed: ZERO,
  });
});

indexer.onEvent({contract: "Dibs", event: "MarketSeeded"}, async ({event, context}) => {
  const id = event.params.marketId.toString();
  const market = await context.Market.get(id);
  if (!market) return;
  context.Market.set({...market, seedStake: event.params.amount, totalStake: event.params.amount});
});

indexer.onEvent({contract: "Dibs", event: "Scouted"}, async ({event, context}) => {
  const marketId = event.params.marketId.toString();
  const scoutId = event.params.scout.toLowerCase();
  const positionId = `${marketId}-${scoutId}`;
  const [market, position, scout] = await Promise.all([
    context.Market.get(marketId),
    context.Position.get(positionId),
    context.Scout.get(scoutId),
  ]);
  if (!market) return;

  const epoch = await context.Epoch.get(market.epochId);
  if (epoch) {
    context.Epoch.set({...epoch, rewardPool: epoch.rewardPool + event.params.cost});
  }

  context.Market.set({
    ...market,
    totalStake: event.params.totalStake,
    totalUnits: market.totalUnits + event.params.units,
    scoutCount: market.scoutCount + (position ? 0 : 1),
  });
  context.Position.set({
    id: positionId,
    marketId,
    scout: scoutId,
    units: (position?.units ?? ZERO) + event.params.units,
    spent: (position?.spent ?? ZERO) + event.params.cost,
    claimed: position?.claimed ?? ZERO,
    firstScoutedAt: position?.firstScoutedAt ?? BigInt(event.block.timestamp),
  });
  context.Scout.set({
    id: scoutId,
    calls: (scout?.calls ?? 0) + (position ? 0 : 1),
    successfulCalls: scout?.successfulCalls ?? 0,
    units: (scout?.units ?? ZERO) + event.params.units,
    spent: (scout?.spent ?? ZERO) + event.params.cost,
    claimed: scout?.claimed ?? ZERO,
    withdrawnCredit: scout?.withdrawnCredit ?? ZERO,
  });
});

indexer.onEvent({contract: "Dibs", event: "ResultSubmitted"}, async ({event, context}) => {
  const id = event.params.marketId.toString();
  const market = await context.Market.get(id);
  if (!market) return;
  context.Market.set({
    ...market,
    qualityGrowthScore: event.params.qualityGrowthScore,
    evidenceHash: event.params.evidenceHash,
    resultSubmittedAt: BigInt(event.block.timestamp),
    status: "PENDING",
  });
});

indexer.onEvent({contract: "Dibs", event: "ResultExpired"}, async ({event, context}) => {
  const id = event.params.marketId.toString();
  const market = await context.Market.get(id);
  if (!market) return;
  // ResultExpired is emitted immediately after ResultSubmitted in the same
  // transaction. Write the complete terminal result state so parallel handler
  // reads cannot restore the earlier OPEN snapshot.
  context.Market.set({
    ...market,
    resultExpired: true,
    resultSubmittedAt: BigInt(event.block.timestamp),
    qualityGrowthScore: ZERO,
    evidenceHash: event.params.evidenceHash,
    status: "PENDING",
  });
});

indexer.onEvent({contract: "Dibs", event: "MarketChallenged"}, async ({event, context}) => {
  const id = event.params.marketId.toString();
  const market = await context.Market.get(id);
  if (!market) return;
  context.Market.set({
    ...market,
    challenged: true,
    challenger: event.params.challenger.toLowerCase(),
    challengeBond: event.params.bond,
    status: "CHALLENGED",
  });
});

indexer.onEvent({contract: "Dibs", event: "ChallengeResolved"}, async ({event, context}) => {
  const id = event.params.marketId.toString();
  const market = await context.Market.get(id);
  if (!market) return;
  if (!event.params.upheld) {
    const epoch = await context.Epoch.get(market.epochId);
    if (epoch) context.Epoch.set({...epoch, rewardPool: epoch.rewardPool + market.challengeBond});
  }
  context.Market.set({
    ...market,
    qualityGrowthScore: event.params.qualityGrowthScore,
    evidenceHash: event.params.evidenceHash,
    challengeUpheld: event.params.upheld,
    status: "PENDING",
  });
});

indexer.onEvent({contract: "Dibs", event: "ChallengeExpired"}, async ({event, context}) => {
  const id = event.params.marketId.toString();
  const market = await context.Market.get(id);
  if (!market) return;
  context.Market.set({
    ...market,
    challengeExpired: true,
    challengeUpheld: true,
    evidenceHash: event.params.evidenceHash,
    status: "PENDING",
  });
});

indexer.onEvent({contract: "Dibs", event: "MarketAllocated"}, async ({event, context}) => {
  const id = event.params.marketId.toString();
  const market = await context.Market.get(id);
  if (!market) return;
  context.Market.set({
    ...market,
    scoutAllocation: event.params.scoutAllocation,
    creatorAllocation: event.params.creatorAllocation,
    status: "SETTLED",
  });
});

indexer.onEvent({contract: "Dibs", event: "EpochFinalized"}, async ({event, context}) => {
  const id = event.params.epochId.toString();
  const epoch = await context.Epoch.get(id);
  if (!epoch) return;
  context.Epoch.set({
    ...epoch,
    allocated: event.params.allocated,
    reserve: event.params.reserve,
    finalized: true,
  });
});

indexer.onEvent({contract: "Dibs", event: "ScoutClaimed"}, async ({event, context}) => {
  const marketId = event.params.marketId.toString();
  const scoutId = event.params.scout.toLowerCase();
  const positionId = `${marketId}-${scoutId}`;
  const [market, position, scout] = await Promise.all([
    context.Market.get(marketId),
    context.Position.get(positionId),
    context.Scout.get(scoutId),
  ]);
  if (!market || !position || !scout) return;
  context.Market.set({...market, scoutClaimed: market.scoutClaimed + event.params.amount});
  context.Position.set({...position, claimed: position.claimed + event.params.amount});
  context.Scout.set({
    ...scout,
    successfulCalls: scout.successfulCalls + (position.claimed === ZERO ? 1 : 0),
    claimed: scout.claimed + event.params.amount,
  });
});

indexer.onEvent({contract: "Dibs", event: "CreatorClaimed"}, async ({event, context}) => {
  const id = event.params.marketId.toString();
  const market = await context.Market.get(id);
  if (!market) return;
  context.Market.set({
    ...market,
    creatorClaimed: market.creatorClaimed + event.params.amount,
  });
});

indexer.onEvent({contract: "Dibs", event: "CreditWithdrawn"}, async ({event, context}) => {
  const id = event.params.account.toLowerCase();
  const scout = await context.Scout.get(id);
  if (!scout) return;
  context.Scout.set({...scout, withdrawnCredit: scout.withdrawnCredit + event.params.amount});
});
