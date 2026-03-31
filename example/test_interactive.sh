#!/usr/bin/env bash

while true; do
    echo "Enter a value. 'q' to quit"
    IFS= read -r value || exit 0

    if [[ "$value" == "q" ]]; then
        exit 0
    fi

    echo "You entered '$value'"
done
