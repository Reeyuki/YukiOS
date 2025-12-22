#!/usr/bin/env bash

for i in {1..400}; do
  wget -t 5 -T 10 \
    "https://cdn.dos.zone/vcsky/fetched/audio/sfx.raw/$i.mp3"
done

