Set-Location 'D:\ndpify\ndpify\prototype\img\artists\_upscale'
Get-Content 'abhijnan_adhikary_prompt.txt' -Raw | codex exec --skip-git-repo-check -s workspace-write -C 'D:\ndpify\ndpify\prototype\img\artists\_upscale' -i 'abhijnan_adhikary_in.png' - *> 'abhijnan_adhikary_codex.log'
