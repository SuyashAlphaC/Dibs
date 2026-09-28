#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${DIBS_ENV_FILE:-${ROOT_DIR}/.env}"
OBSERVATION_URL="${DIBS_OBSERVATION_URL:-https://dibs-metropolis.vercel.app/api/oracle/observations}"
RECEIVER="${CRE_SETTLEMENT_RECEIVER_ADDRESS:-0x78B87B938cbdd9453F2dA6adA043d74d792C9A81}"
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
  echo "No settlement observations are ready; receiver guard was not changed."
  exit 3
fi

wallet_address="$(cast wallet address --private-key "${OWNER_KEY}")"
receiver_owner="$(cast call "${RECEIVER}" 'owner()(address)' --rpc-url "${RPC_URL}")"
if [[ "${wallet_address,,}" != "${receiver_owner,,}" ]]; then
  echo "Configured key does not own the settlement receiver." >&2
  exit 2
fi

original_workflow_id="$(cast call "${RECEIVER}" 'expectedWorkflowId()(bytes32)' --rpc-url "${RPC_URL}")"
guard_unlocked=false

restore_guard() {
  if [[ "${guard_unlocked}" == true ]]; then
    echo "Restoring receiver workflow guard to ${original_workflow_id}..."
    cast send "${RECEIVER}" 'setExpectedWorkflowId(bytes32)' "${original_workflow_id}" \
      --rpc-url "${RPC_URL}" --private-key "${OWNER_KEY}" >/dev/null
    guard_unlocked=false
    echo "Receiver workflow guard restored."
  fi
}
trap restore_guard EXIT INT TERM

if [[ "${original_workflow_id}" != "${ZERO_WORKFLOW_ID}" ]]; then
  echo "Temporarily allowing the CRE broadcast simulator..."
  guard_unlocked=true
  cast send "${RECEIVER}" 'setExpectedWorkflowId(bytes32)' "${ZERO_WORKFLOW_ID}" \
    --rpc-url "${RPC_URL}" --private-key "${OWNER_KEY}" >/dev/null
fi

echo "Broadcasting ${observation_count} CRE settlement observation(s)..."
(
  cd "${ROOT_DIR}/oracle"
  cre workflow simulate . --target staging-settings --broadcast --evm-receipt-timeout 2m
)

echo "CRE broadcast completed. Envio may take a short time to index the result."
