# Runs the unattended workday loop with captions if provided.
# Edit $RotationSeconds, $WorkdaySeconds, and $VttMap as needed.

param(
  [int]$RotationSeconds = 600,
  [int]$WorkdaySeconds = 28800,
  [int]$MinViewers = 75,
  [int]$Limit = 10,
  [string]$Language = "en",
  [string]$VttMap = "vtt_map.json",
  # Optional HRM fine-tune after mining (off by default)
  [switch]$HrmTrain = $false,
  [int]$HrmSeqLen = 384,
  [int]$HrmBatch = 24,
  [int]$HrmEpochs = 200,
  [string]$HrmDataOut = "data/text-sft-384",
  [string]$HrmProfile = "3060ti"
)

# Activate venv if present
$venv = Join-Path $PSScriptRoot ".venv\Scripts\Activate.ps1"
if (Test-Path $venv) { . $venv }

# Optional: quick secrets status
python secrets_store.py status

# If a VTT map file is present, include it; otherwise skip captions
$haveVtt = Test-Path (Join-Path $PSScriptRoot $VttMap)

if ($haveVtt) {
  Write-Host "Starting workday with captions map: $VttMap"
  $args = @('--rotation-seconds', $RotationSeconds, '--workday-seconds', $WorkdaySeconds, '--min-viewers', $MinViewers, '--limit', $Limit, '--language', $Language, '--vtt-map', $VttMap)
}
else {
  Write-Host "Starting workday (no VTT map found): $VttMap"
  $args = @('--rotation-seconds', $RotationSeconds, '--workday-seconds', $WorkdaySeconds, '--min-viewers', $MinViewers, '--limit', $Limit, '--language', $Language)
}

# Optionally append HRM training flags
if ($HrmTrain) {
  $args += @('--hrm-train', '--hrm-seq-len', $HrmSeqLen, '--hrm-batch', $HrmBatch, '--hrm-epochs', $HrmEpochs, '--hrm-data-out', $HrmDataOut, '--hrm-profile', $HrmProfile)
}

python auto_train_loop.py @args
