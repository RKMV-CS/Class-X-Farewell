Set-Location 'D:\ndpify\ndpify\prototype\img\artists\_upscale'
Get-Content 'aishik_aich_prompt.txt' -Raw | codex exec --skip-git-repo-check -s workspace-write -C 'D:\ndpify\ndpify\prototype\img\artists\_upscale' -i 'aishik_aich_in.png' - *> 'aishik_aich_codex.log'
