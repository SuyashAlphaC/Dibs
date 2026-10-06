#!/usr/bin/env bash
set -euo pipefail

operation="${1:-}"
qstash_base_url="${QSTASH_BASE_URL:-https://qstash.upstash.io}"
schedule_id="${QSTASH_SCHEDULE_ID:-dibs-market-keeper-production}"
keeper_url="${DIBS_KEEPER_URL:-https://dibs-metropolis.vercel.app/api/markets/open}"
keeper_cron="${DIBS_KEEPER_CRON:-*/5 * * * *}"

if [[ -z "${QSTASH_TOKEN:-}" ]]; then
  echo "QSTASH_TOKEN is required." >&2
  exit 1
fi

configure() {
  if [[ -z "${DIBS_CRON_SECRET:-}" ]]; then
    echo "DIBS_CRON_SECRET is required to configure the authenticated delivery." >&2
    exit 1
  fi

  curl --fail-with-body --silent --show-error \
    --request POST \
    --url "${qstash_base_url}/v2/schedules/${keeper_url}" \
    --header "Authorization: Bearer ${QSTASH_TOKEN}" \
    --header "Content-Type: application/json" \
    --header "Upstash-Cron: ${keeper_cron}" \
    --header "Upstash-Schedule-Id: ${schedule_id}" \
    --header "Upstash-Method: POST" \
    --header "Upstash-Timeout: 120s" \
    --header "Upstash-Retries: 3" \
    --header "Upstash-Retry-Delay: max(1000, pow(2, retried) * 1000)" \
    --header "Upstash-Forward-Authorization: Bearer ${DIBS_CRON_SECRET}" \
    --header "Upstash-Redact-Fields: header[Authorization]" \
    --header "Upstash-Label: dibs,market-keeper,production" \
    --data '{}'
  echo
}

verify() {
  local response
  response="$(curl --fail-with-body --silent --show-error \
    --url "${qstash_base_url}/v2/schedules/${schedule_id}" \
    --header "Authorization: Bearer ${QSTASH_TOKEN}")"

  jq -e \
    --arg schedule_id "${schedule_id}" \
    --arg keeper_url "${keeper_url}" \
    --arg keeper_cron "${keeper_cron}" \
    '.scheduleId == $schedule_id
      and .destination == $keeper_url
      and .cron == $keeper_cron
      and .method == "POST"
      and (.isPaused == false)' <<<"${response}" >/dev/null

  jq '{scheduleId,cron,destination,method,retries,isPaused,lastScheduleTime,nextScheduleTime,lastScheduleStates}' <<<"${response}"
}

delete_schedule() {
  curl --fail-with-body --silent --show-error \
    --request DELETE \
    --url "${qstash_base_url}/v2/schedules/${schedule_id}" \
    --header "Authorization: Bearer ${QSTASH_TOKEN}"
  echo
}

case "${operation}" in
  configure)
    configure
    ;;
  verify)
    verify
    ;;
  delete)
    delete_schedule
    ;;
  *)
    echo "Usage: $0 {configure|verify|delete}" >&2
    exit 2
    ;;
esac
