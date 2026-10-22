# Engine Contracts (v1.0.0)

## Generate request

```json
{
  "version": "1.0.0",
  "context": {
    "occasion": "office|casual|dinner|weekend|gym|party",
    "tempC": 17,
    "rainProb": 15,
    "windKph": null,
    "dualJourney": { "enabled": false, "type": null },
    "lang": "es|en|ca"
  },
  "candidates": [
    { "id": "g_01", "category": "top", "state": "available", "formality": 6, "thermalRange": { "minTempC": 10, "maxTempC": 24 } }
  ]
}
```

## Generate response

```json
{
  "version": "1.0.0",
  "provider": "local|remote",
  "result": {
    "status": "success|error",
    "outfit": { "top": {}, "bottom": {}, "footwear": {}, "outerwear": null },
    "score": {
      "overall": 78,
      "factors": {
        "formality": { "score": 0.8, "reason": "...", "coverage": 1, "limitations": [] }
      },
      "coverage": 0.85,
      "limitations": ["heuristic_not_scientific"],
      "explanation": "..."
    },
    "editorial": "...",
    "transitionLayer": null,
    "explanation": "..."
  },
  "diagnostics": {
    "errors": [{ "code": "...", "message": "...", "path": "..." }],
    "warnings": [{ "code": "...", "message": "...", "path": "..." }]
  }
}
```

Hard constraints are always validated outside model decisions and re-validated for remote responses.
