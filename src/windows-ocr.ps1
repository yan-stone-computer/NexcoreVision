param([Parameter(Mandatory = $true)][string]$Path)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Storage.FileAccessMode, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]

function Await-WinRt($Operation, [Type]$ResultType) {
  $asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
      $_.Name -eq "AsTask" -and
      $_.IsGenericMethodDefinition -and
      $_.GetParameters().Count -eq 1 -and
      $_.GetParameters()[0].ParameterType.Name -like "IAsyncOperation*"
    } |
    Select-Object -First 1
  $task = $asTask.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $task.Wait()
  return $task.Result
}

$file = Await-WinRt ([Windows.Storage.StorageFile]::GetFileFromPathAsync($Path)) ([Windows.Storage.StorageFile])
$stream = Await-WinRt ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await-WinRt ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

$languages = [Windows.Media.Ocr.OcrEngine]::AvailableRecognizerLanguages
$language = $languages | Where-Object { $_.LanguageTag -like "zh-*" } | Select-Object -First 1
if (-not $language) { $language = $languages | Where-Object { $_.LanguageTag -like "en-*" } | Select-Object -First 1 }
if (-not $language) { throw "Windows OCR has no installed language pack" }

$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
$result = Await-WinRt ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
$lines = @($result.Lines | ForEach-Object {
  $box = $_.Words | ForEach-Object { $_.BoundingRect }
  [ordered]@{
    text = $_.Text
    left = if ($box.Count) { [Math]::Round(($box | Measure-Object -Property X -Minimum).Minimum) } else { 0 }
    top = if ($box.Count) { [Math]::Round(($box | Measure-Object -Property Y -Minimum).Minimum) } else { 0 }
    right = if ($box.Count) { [Math]::Round(($box | ForEach-Object { $_.X + $_.Width } | Measure-Object -Maximum).Maximum) } else { 0 }
    bottom = if ($box.Count) { [Math]::Round(($box | ForEach-Object { $_.Y + $_.Height } | Measure-Object -Maximum).Maximum) } else { 0 }
  }
})

[ordered]@{
  text = [string]$result.Text
  language = [string]$language.LanguageTag
  lines = $lines
} | ConvertTo-Json -Depth 5 -Compress
