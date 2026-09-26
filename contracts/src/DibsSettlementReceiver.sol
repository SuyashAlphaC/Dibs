// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @notice ERC-165 interface used by the Chainlink CRE KeystoneForwarder.
interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

/// @notice Standard callback used by the Chainlink CRE KeystoneForwarder.
interface IReceiver is IERC165 {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

interface IDibsSettlement {
    function submitResult(uint256 marketId, uint256 score, bytes32 evidenceHash) external;

    function resolveChallenge(
        uint256 marketId,
        uint256 correctedScore,
        bytes32 correctedEvidenceHash,
        bool upheld
    ) external;
}

/// @title DibsSettlementReceiver
/// @notice Authenticates CRE reports and forwards only Dibs settlement operations.
/// @dev Reports are ABI encoded as `(uint256 targetChainId, bytes settlementCalldata)`.
contract DibsSettlementReceiver is IReceiver {
    error Unauthorized();
    error InvalidConfiguration();
    error InvalidWorkflowId(bytes32 received, bytes32 expected);
    error InvalidMetadataLength(uint256 received);
    error InvalidTargetChain(uint256 received, uint256 expected);
    error InvalidSettlementCalldata();
    error UnsupportedSettlementSelector(bytes4 selector);

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event ExpectedWorkflowIdUpdated(bytes32 indexed previousId, bytes32 indexed newId);
    event SettlementReportForwarded(bytes4 indexed selector, bytes32 indexed workflowId);

    address public owner;
    address public immutable forwarder;
    IDibsSettlement public immutable dibs;
    uint256 public immutable targetChainId;
    bytes32 public expectedWorkflowId;

    modifier onlyOwner() {
        if (msg.sender != owner) revert Unauthorized();
        _;
    }

    constructor(address initialOwner, address forwarderAddress, address dibsAddress) {
        if (
            initialOwner == address(0) || forwarderAddress == address(0)
                || dibsAddress == address(0)
        ) revert InvalidConfiguration();

        owner = initialOwner;
        forwarder = forwarderAddress;
        dibs = IDibsSettlement(dibsAddress);
        targetChainId = block.chainid;

        emit OwnershipTransferred(address(0), initialOwner);
    }

    function transferOwnership(address nextOwner) external onlyOwner {
        if (nextOwner == address(0)) revert InvalidConfiguration();
        address previousOwner = owner;
        owner = nextOwner;
        emit OwnershipTransferred(previousOwner, nextOwner);
    }

    /// @notice Restricts delivery to one deployed CRE workflow when non-zero.
    /// @dev Keep zero while using `cre workflow simulate`; the mock forwarder omits metadata.
    function setExpectedWorkflowId(bytes32 workflowId) external onlyOwner {
        bytes32 previousId = expectedWorkflowId;
        expectedWorkflowId = workflowId;
        emit ExpectedWorkflowIdUpdated(previousId, workflowId);
    }

    function onReport(bytes calldata metadata, bytes calldata report) external override {
        if (msg.sender != forwarder) revert Unauthorized();

        bytes32 workflowId;
        if (metadata.length >= 32) {
            assembly {
                workflowId := calldataload(metadata.offset)
            }
        }

        bytes32 requiredWorkflowId = expectedWorkflowId;
        if (requiredWorkflowId != bytes32(0)) {
            if (metadata.length < 32) revert InvalidMetadataLength(metadata.length);
            if (workflowId != requiredWorkflowId) {
                revert InvalidWorkflowId(workflowId, requiredWorkflowId);
            }
        }

        (uint256 reportChainId, bytes memory settlementCalldata) =
            abi.decode(report, (uint256, bytes));
        if (reportChainId != targetChainId) {
            revert InvalidTargetChain(reportChainId, targetChainId);
        }
        if (settlementCalldata.length < 4) revert InvalidSettlementCalldata();

        bytes4 selector;
        assembly {
            selector := mload(add(settlementCalldata, 32))
        }

        bool validSubmit = selector == IDibsSettlement.submitResult.selector
            && settlementCalldata.length == 4 + (32 * 3);
        bool validResolution = selector == IDibsSettlement.resolveChallenge.selector
            && settlementCalldata.length == 4 + (32 * 4);
        if (!validSubmit && !validResolution) revert UnsupportedSettlementSelector(selector);

        (bool success, bytes memory returnData) = address(dibs).call(settlementCalldata);
        if (!success) {
            assembly {
                revert(add(returnData, 32), mload(returnData))
            }
        }

        emit SettlementReportForwarded(selector, workflowId);
    }

    function supportsInterface(bytes4 interfaceId) external pure override returns (bool) {
        return
            interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }
}
