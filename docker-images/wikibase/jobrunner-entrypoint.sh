#!/usr/bin/env bash

# Originally inspired by Brennen Bearnes jobrunner entrypoint
# https://gerrit.wikimedia.org/r/plugins/gitiles/releng/dev-images/+/refs/heads/master/common/jobrunner/entrypoint.sh

kill_runner() {
	kill "$PID" 2> /dev/null
}
trap kill_runner SIGTERM

while true; do
	php maintenance/runJobs.php --wait --maxjobs="${JOBRUNNER_MAX_JOBS:-5}" --conf /config/LocalSettings.php &
	PID=$!
	wait "$PID"
done
