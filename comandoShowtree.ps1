function Show-Tree {
    param (
        [string]$Path = ".",
        [int]$Indent = 0
    )

    $items = Get-ChildItem -LiteralPath $Path -Force | Where-Object {
        $_.Name -ne "node_modules" -and
        $_.Name -ne ".git" -and
        $_.Extension -ne ".txt"
    } | Sort-Object @{Expression = { -not $_.PSIsContainer } }, Name

    foreach ($item in $items) {
        $prefix = " " * ($Indent * 2) + "├─ "

        Write-Output "$prefix$item"

        if ($item.PSIsContainer) {
            Show-Tree -Path $item.FullName -Indent ($Indent + 1)
        }
    }
}

Show-Tree
