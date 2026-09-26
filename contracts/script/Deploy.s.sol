// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { Script } from "forge-std/Script.sol";
import { console2 } from "forge-std/console2.sol";
import { Dibs } from "../src/Dibs.sol";
import { DibsSettlementReceiver } from "../src/DibsSettlementReceiver.sol";

contract DeployDibs is Script {
    function run() external returns (Dibs dibs, DibsSettlementReceiver receiver) {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address creForwarder = vm.envAddress("CRE_FORWARDER_ADDRESS");

        vm.startBroadcast(deployerKey);
        dibs = new Dibs(
            deployer,
            deployer,
            0.01 ether,
            0.001 ether,
            0.05 ether,
            2 hours,
            1 hours,
            3 hours,
            1_000,
            2_000
        );
        dibs.setMarketSeed(0.002 ether);
        receiver = new DibsSettlementReceiver(deployer, creForwarder, address(dibs));
        dibs.setOracle(address(receiver));
        vm.stopBroadcast();

        console2.log("DIBS_CONTRACT_ADDRESS", address(dibs));
        console2.log("DIBS_RECEIVER_ADDRESS", address(receiver));
        console2.log("CRE_FORWARDER_ADDRESS", creForwarder);
        console2.log("DEPLOYER_ADDRESS", deployer);
    }
}
