# Renders the Pulse app icon (gradient squircle + play glyph) to PNG sizes and
# a multi-resolution .ico. Run once; outputs go to /public.
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$public = Join-Path $root 'public'

function New-IconBitmap([int]$size) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  # Rounded square ("squircle-ish") with a diagonal rose -> violet gradient.
  $r = [single]($size * 0.235)
  $rect = New-Object System.Drawing.RectangleF 0, 0, $size, $size
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = $r * 2
  $path.AddArc(0, 0, $d, $d, 180, 90)
  $path.AddArc($size - $d, 0, $d, $d, 270, 90)
  $path.AddArc($size - $d, $size - $d, $d, $d, 0, 90)
  $path.AddArc(0, $size - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, ([System.Drawing.Color]::FromArgb(255, 255, 61, 110)), ([System.Drawing.Color]::FromArgb(255, 124, 92, 255)), 45
  $g.FillPath($brush, $path)

  # Soft top highlight for a glassy sheen.
  $hiRect = New-Object System.Drawing.RectangleF 0, 0, $size, ($size * 0.55)
  $hi = New-Object System.Drawing.Drawing2D.LinearGradientBrush $hiRect, ([System.Drawing.Color]::FromArgb(70, 255, 255, 255)), ([System.Drawing.Color]::FromArgb(0, 255, 255, 255)), 90
  $g.SetClip($path)
  $g.FillRectangle($hi, $hiRect)
  $g.ResetClip()

  # Play triangle, optically centered.
  $s = [single]$size
  $pts = @(
    (New-Object System.Drawing.PointF ($s * 0.40), ($s * 0.29)),
    (New-Object System.Drawing.PointF ($s * 0.40), ($s * 0.71)),
    (New-Object System.Drawing.PointF ($s * 0.74), ($s * 0.50))
  )
  $tri = New-Object System.Drawing.Drawing2D.GraphicsPath
  $tri.AddPolygon($pts)
  $white = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
  $pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), ([single]($size * 0.06))
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $g.FillPath($white, $tri)
  $g.DrawPath($pen, $tri)

  $g.Dispose()
  return $bmp
}

function Get-PngBytes($bmp) {
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  return , $ms.ToArray()
}

foreach ($size in 512, 192) {
  $bmp = New-IconBitmap $size
  $bmp.Save((Join-Path $public "icon-$size.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

# Multi-size ICO with PNG-compressed entries (supported since Windows Vista).
$sizes = 256, 64, 48, 32, 16
$images = foreach ($size in $sizes) { $b = New-IconBitmap $size; , (Get-PngBytes $b); $b.Dispose() }
$out = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter $out
$w.Write([UInt16]0); $w.Write([UInt16]1); $w.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $dim = if ($sizes[$i] -ge 256) { 0 } else { $sizes[$i] }
  $w.Write([byte]$dim); $w.Write([byte]$dim); $w.Write([byte]0); $w.Write([byte]0)
  $w.Write([UInt16]1); $w.Write([UInt16]32)
  $w.Write([UInt32]$images[$i].Length); $w.Write([UInt32]$offset)
  $offset += $images[$i].Length
}
foreach ($img in $images) { $w.Write($img) }
$w.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $public 'pulse.ico'), $out.ToArray())
Write-Output "Icons written to $public"
