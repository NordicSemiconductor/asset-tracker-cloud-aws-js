---
run: never
needs:
  - Connect a tracker
---

# Device Update Shadow

> Devices can update their shadow

## Publish device information to reported state

Given I store `$millis()` into `updateShadowTs`

Then the tracker updates its reported state with

```json
{
  "dev": {
    "v": {
      "imei": "352656106111232",
      "iccid": "89882806660004909182",
      "modV": "mfw_nrf9160_1.0.0",
      "brdV": "thingy91_nrf9160",
      "appV": "0.14.6"
    },
    "ts": "$number{updateShadowTs}"
  },
  "roam": {
    "v": {
      "nw": "LTE-M",
      "band": 3
    },
    "ts": "$number{updateShadowTs}"
  },
  "bat": {
    "v": 3781,
    "ts": "$number{updateShadowTs}"
  },
  "cfg": {
    "act": false,
    "actwt": 60,
    "mvres": 60,
    "mvt": 3600,
    "loct": 1000,
    "accath": 10.5,
    "accith": 5.2,
    "accito": 1.7
  }
}
```
