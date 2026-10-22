param([Parameter(Mandatory = $true)][string]$ArchivePath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
# User-selected operational countries, 2026-10-21.
$asia = 'VN SG MY TH PH CN JP'.Split(' ')
# Curated cruise/exploration gateways; labels are editorial, names remain from UN/LOCODE.
$featured = @{
    VNHLG = @('Hạ Long', 'Ha Long'); VNDAD = @('Đà Nẵng', 'Da Nang'); VNNHA = @('Nha Trang', 'Nha Trang')
    VNPQC = @('Phú Quốc', 'Phu Quoc'); VNPHU = @('Phú Mỹ', 'Phu My')
    SGSIN = @('Singapore', 'Singapore')
    MYPEN = @('Penang / George Town', 'George Town'); MYLGK = @('Langkawi / Kuah', 'Kuah')
    MYPKG = @('Port Klang', 'Klang'); MYBKI = @('Kota Kinabalu', 'Kota Kinabalu')
    THPKT = @('Phuket', 'Phuket'); THKSM = @('Ko Samui', 'Ko Samui')
    THLCH = @('Laem Chabang', 'Laem Chabang'); THBKK = @('Bangkok', 'Bangkok')
    PHBOR = @('Boracay', 'Boracay'); PHCEB = @('Cebu', 'Cebu'); PHMNL = @('Manila', 'Manila')
    PHPPS = @('Puerto Princesa / Palawan', 'Puerto Princesa')
    CNSGH = @('Thượng Hải', 'Shanghai'); CNXAM = @('Hạ Môn', 'Xiamen')
    CNSYA = @('Tam Á', 'Sanya'); CNTNJ = @('Thiên Tân', 'Tianjin')
    JPTYO = @('Tokyo', 'Tokyo'); JPYOK = @('Yokohama', 'Yokohama'); JPOSA = @('Osaka', 'Osaka')
    JPUKB = @('Kobe', 'Kobe'); JPNGS = @('Nagasaki', 'Nagasaki'); JPNAH = @('Naha / Okinawa', 'Naha')
}
$headers = @('change','country','location','name','asciiName','subdivision','function','status','date','iata','coordinates','remarks')
$rows = @{}
$archive = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path -LiteralPath $ArchivePath))
try {
    foreach ($entry in $archive.Entries | Where-Object { $_.FullName -match 'csv/UNLOCODE CodeListPart[123]\.csv$' }) {
        $reader = [System.IO.StreamReader]::new($entry.Open(), [System.Text.Encoding]::UTF8)
        try { $csv = $reader.ReadToEnd() } finally { $reader.Dispose() }
        foreach ($row in ($csv | ConvertFrom-Csv -Header $headers)) {
            if ($row.country -notin $asia -or -not $row.location -or -not $row.function.StartsWith('1') -or $row.change -eq 'X' -or $row.status -eq 'XX') { continue }
            $code = $row.country + $row.location
            if (-not $featured.ContainsKey($code)) { continue }
            if (-not $rows.ContainsKey($code)) {
                $rows[$code] = [ordered]@{ code = $code; country = $row.country; name = $row.name; label = $featured[$code][0]; searchName = $featured[$code][1] }
            }
        }
    }
} finally { $archive.Dispose() }
if ($rows.Count -ne $featured.Count) { throw 'Some curated ports were not found in this release; review the catalogue before publishing.' }
$output = Join-Path $PSScriptRoot '../src/features/itineraries/data/asia-port-locations.json'
$json = ConvertTo-Json -InputObject @($rows.Values | Sort-Object { $_.country }, { $_.name }) -Depth 4 -Compress
[System.IO.File]::WriteAllText([System.IO.Path]::GetFullPath($output), $json + "`n", [System.Text.UTF8Encoding]::new($false))
Write-Output "Generated $($rows.Count) maritime port locations in $(($rows.Values.country | Sort-Object -Unique).Count) countries/areas from UN/LOCODE 2025-1."
