Set-Location 'D:\ndpify\ndpify\prototype\img\artists\_upscale'
Get-Content 'soumyadeep_biswas_prompt.txt' -Raw | codex exec --skip-git-repo-check -s workspace-write -C 'D:\ndpify\ndpify\prototype\img\artists\_upscale' -i 'soumyadeep_biswas_in.png' - *> 'soumyadeep_biswas_codex.log'
