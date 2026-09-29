#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${DIBS_ENV_FILE:-${ROOT_DIR}/.env}"
OBSERVATION_URL="${DIBS_OBSERVATION_URL:-https://dibs-metropolis.vercel.app/api/oracle/observations}"
CORE="${DIBS_CONTRACT_ADDRESS:-${NEXT_PUBLIC_DIBS_CONTRACT_ADDRESS:-0x0fFd42613e0Bd0f328C23DeCB7c33f81B2490F84}}"
PRODUCTION_RECEIVER="${CRE_SETTLEMENT_RECEIVER_ADDRESS:-0x78B87B938cbdd9453F2dA6adA043d74d792C9A81}"
SIMULATION_RECEIVER="${CRE_SIMULATION_RECEIVER_ADDRESS:-0x3D0AC36a876fB3bB077F115DC48F1Ae692BA7F01}"
MOCK_FORWARDER="${CRE_MOCK_FORWARDER_ADDRESS:-0xB9F79d863261869B234c481D1f9A7af84AeAd192}"
ZERO_WORKFLOW_ID="0x0000000000000000000000000000000000000000000000000000000000000000"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing environment file: ${ENV_FILE}" >&2
  exit 2
fi

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

RPC_URL="${MONAD_RPC_URL:-${NEXT_PUBLIC_MONAD_RPC_URL:-}}"
OWNER_KEY="${CRE_RECEIVER_OWNER_PRIVATE_KEY:-${DEPLOYER_PRIVATE_KEY:-}}"

if [[ -z "${RPC_URL}" || -z "${OWNER_KEY}" ]]; then
  echo "MONAD_RPC_URL/NEXT_PUBLIC_MONAD_RPC_URL and DEPLOYER_PRIVATE_KEY are required." >&2
  exit 2
fi

# CRE requires this exact variable name when --broadcast signs the simulator's
# testnet write. Reuse the receiver-owner key already validated below.
export CRE_ETH_PRIVATE_KEY="${CRE_ETH_PRIVATE_KEY:-${OWNER_KEY}}"

for command in curl jq cast cre; do
  command -v "${command}" >/dev/null || {
    echo "Required command is unavailable: ${command}" >&2
    exit 2
  }
done

observations="$(curl --fail --silent --show-error --retry 3 "${OBSERVATION_URL}")"
if ! jq -e '.observations | type == "array"' >/dev/null <<<"${observations}"; then
  echo "Observation endpoint did not return an observations array." >&2
  exit 2
fi
observation_count="$(jq -r '.observations | length' <<<"${observations}")"

if [[ "${observation_count}" -eq 0 ]]; then
  echo "No settlement observations are ready; no onchain state was changed."
  exit 3
fi

wallet_address="$(cast wallet address --private-key "${OWNER_KEY}")"
core_owner="$(cast call "${CORE}" 'owner()(address)' --rpc-url "${RPC_URL}")"
receiver_owner="$(cast call "${SIMULATION_RECEIVER}" 'owner()(address)' --rpc-url "${RPC_URL}")"
receiver_forwarder="$(cast call "${SIMULATION_RECEIVER}" 'forwarder()(address)' --rpc-url "${RPC_URL}")"
receiver_core="$(cast call "${SIMULATION_RECEIVER}" 'dibs()(address)' --rpc-url "${RPC_URL}")"
receiver_workflow_id="$(cast call "${SIMULATION_RECEIVER}" 'expectedWorkflowId()(bytes32)' --rpc-url "${RPC_URL}")"

if [[ "${wallet_address,,}" != "${core_owner,,}" || "${wallet_address,,}" != "${receiver_owner,,}" ]]; then
  echo "Configured key must own both the Dibs core and simulation receiver." >&2
  exit 2
fi
if [[ "${receiver_forwarder,,}" != "${MOCK_FORWARDER,,}" ]]; then
  echo "Simulation receiver does not trust the configured CRE MockForwarder." >&2
  exit 2
fi
if [[ "${receiver_core,,}" != "${CORE,,}" ]]; then
  echo "Simulation receiver points to an unexpected Dibs core contract." >&2
  exit 2
fi
if [[ "${receiver_workflow_id}" != "${ZERO_WORKFLOW_ID}" ]]; then
  echo "Simulation receiver workflow guard must be zero for simulate --broadcast." >&2
  exit 2
fi

original_oracle="$(cast call "${CORE}" 'oracle()(address)' --rpc-url "${RPC_URL}")"
oracle_switched=false

restore_oracle() {
  if [[ "${oracle_switched}" == true ]]; then
    echo "Restoring Dibs oracle to ${original_oracle}..."
    cast send "${CORE}" 'setOracle(address)' "${original_oracle}" \
      --rpc-url "${RPC_URL}" --private-key "${OWNER_KEY}" --json \
      | jq -r '"Oracle restore tx: " + .transactionHash'
    oracle_switched=false
    echo "Dibs production oracle restored."
  fi
}
trap restore_oracle EXIT INT TERM

if [[ "${original_oracle,,}" != "${PRODUCTION_RECEIVER,,}" ]]; then
  echo "Dibs core is not currently using the expected production receiver." >&2
  exit 2
fi

echo "Temporarily routing Dibs settlement through the isolated CRE simulation receiver..."
oracle_switched=true
cast send "${CORE}" 'setOracle(address)' "${SIMULATION_RECEIVER}" \
  --rpc-url "${RPC_URL}" --private-key "${OWNER_KEY}" --json \
  | jq -r '"Oracle switch tx: " + .transactionHash'

echo "Broadcasting ${observation_count} CRE settlement observation(s)..."
(
  cd "${ROOT_DIR}/oracle"
  printf '\n' | cre workflow simulate . --target broadcast-settings --broadcast --evm-receipt-timeout 2m
)

echo "CRE broadcast completed with confirmed EVM write status. Envio may take a short time to index the result."
